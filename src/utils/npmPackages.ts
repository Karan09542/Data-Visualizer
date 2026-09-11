/**
 * npm packages for JS/TS nodes, from the esm.sh CDN and kept on the device.
 *
 * Node code runs as CommonJS - Sucrase turns `import` into a synchronous `require` - so every
 * package must be in hand before the code starts. Before a run, the package names the code
 * requires are collected, and each is fetched from esm.sh together with every module it imports,
 * reading the device copy first. The modules then become blob: URLs whose imports point at each
 * other, so the worker imports the whole graph without touching the network. Once a package has
 * been fetched it keeps working offline, and stays at the version first fetched.
 *
 * Kept in OPFS (`js_packages/modules`), or IndexedDB where OPFS cannot be written - the same
 * storage layer as the Python packages (deviceFileStore). A record per package - version, files,
 * size - is what the npm packages panel lists and removes.
 */
import Dexie, { type Table } from "dexie";
import { createDeviceFileStore, type StorageBackend, type StoredFileRecord } from "./deviceFileStore";
import { isOffline } from "./offlineErrors";
import {
  clearPackageTypes,
  downloadPackageTypes,
  forgetPackageTypes,
  packageNameOf,
  typesStorageSize,
} from "./packageTypes";

const CDN = "https://esm.sh";
const REGISTRY = "https://registry.npmjs.org";
/** How long npm's description of a package is trusted before asking again. */
const INFO_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface NpmPackageInfo {
  description?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  /** Latest version on npm when last asked. */
  latest?: string;
  fetchedAt: number;
}

export interface NpmPackageRecord {
  /** As imported: "lodash", "lodash/get", "zod@3". */
  name: string;
  /** The version esm.sh resolved it to. */
  version?: string;
  /** Module URLs of its code kept on the device (keys in the module store). */
  files: string[];
  /** Size of those files; files shared with other packages count for each. */
  bytes: number;
  /** Whether it has a default export - decides the import line to suggest. */
  hasDefault: boolean;
  /** The esm.sh URL its code comes from. */
  esmUrl: string;
  installedAt: number;
  lastUsedAt: number;
  info?: NpmPackageInfo;
}

class JsPackageDatabase extends Dexie {
  modules!: Table<StoredFileRecord, string>;
  packages!: Table<NpmPackageRecord, string>;

  constructor() {
    super("js_package_cache");
    this.version(1).stores({ modules: "url" });
    this.version(2).stores({ modules: "url", packages: "name" });
  }
}

let db: JsPackageDatabase | null = null;
const database = () => (db ??= new JsPackageDatabase());

const moduleStore = createDeviceFileStore({
  opfsPath: ["js_packages", "modules"],
  table: () => database().modules,
});

// ------------------------------------------------------------------ change notifications

const listeners = new Set<() => void>();

/** Called whenever packages are added, used, removed or cleared. Returns an unsubscribe. */
export function subscribeNpmPackages(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const notify = () => listeners.forEach((listener) => {
  try {
    listener();
  } catch {
    // A listener's failure is its own.
  }
});

// ------------------------------------------------------------------ package names in code

/**
 * Node built-ins with nothing to stand in for them in a browser. Others - path, events, util,
 * buffer - resolve to their npm polyfills on esm.sh.
 */
const NODE_ONLY = new Set([
  "fs", "fs/promises", "child_process", "cluster", "dgram", "dns", "http2", "inspector",
  "module", "net", "readline", "repl", "tls", "v8", "vm", "worker_threads",
]);

export const isPackageSpecifier = (specifier: string) => !specifier.startsWith(".") && !specifier.startsWith("/");

/** Package names the compiled code requires. Comments may add a few; those only load, never fail a run. */
export function collectPackageImports(compiled: Record<string, string>): string[] {
  const found = new Set<string>();
  const pattern = /\brequire\(\s*(['"])([^'"\n]+)\1\s*\)/g;
  for (const [path, code] of Object.entries(compiled)) {
    if (path.endsWith(".json")) continue;
    for (const match of code.matchAll(pattern)) {
      if (isPackageSpecifier(match[2])) found.add(match[2]);
    }
  }
  return [...found];
}

export const packageUrl = (specifier: string, bundle = false) =>
  `${CDN}/${specifier.replace(/^node:/, "")}?target=es2022${bundle ? "&bundle" : ""}`;

// ------------------------------------------------------------------ fetching module graphs

/** A module's code and the URL it really came from - its imports resolve against that. */
interface ModuleSource {
  url: string;
  code: string;
}

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

/** A module graph that imports itself in a loop, which blob: URLs cannot express. */
class CircularModules extends Error {}

interface LoadStats {
  downloaded: number;
  announce: () => void;
  /** Module URLs this package's graph used, and their size. */
  files: Set<string>;
  bytes: number;
  entryCode?: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function fetchModule(url: string, stats: LoadStats): Promise<ModuleSource> {
  stats.files.add(url);
  const kept = await moduleStore.read(url).catch(() => null);
  if (kept) {
    try {
      const source = JSON.parse(decoder.decode(kept));
      stats.bytes += kept.byteLength;
      return source;
    } catch {
      // Unreadable copy: fetch it again.
    }
  }

  stats.announce();
  const response = await fetch(url);
  if (!response.ok) throw new HttpError(response.status);
  const source: ModuleSource = { url: response.url || url, code: await response.text() };
  stats.downloaded++;
  const data = encoder.encode(JSON.stringify(source));
  stats.bytes += data.byteLength;
  try {
    await moduleStore.write(url, data.buffer as ArrayBuffer);
  } catch (err) {
    console.warn("[npm] Could not keep", url, err);
  }
  return source;
}

/** Static imports, re-exports and literal dynamic imports, with where each specifier sits. */
const IMPORT_PATTERN = /(?:\bfrom\s*|\bimport\s*\(?\s*)(["'])([^"'\n]+)\1/g;

function importsOf(code: string) {
  const found: { start: number; end: number; specifier: string }[] = [];
  for (const match of code.matchAll(IMPORT_PATTERN)) {
    const specifier = match[2];
    const end = match.index! + match[0].length - 1;
    found.push({ start: end - specifier.length, end, specifier });
  }
  return found;
}

const resolveImport = (specifier: string, base: string): string | null => {
  if (/^(\/|\.\.?\/)/.test(specifier)) return new URL(specifier, base).href;
  if (/^https?:\/\//.test(specifier)) return specifier;
  return null; // esm.sh output has no bare names; anything else is left alone
};

/** Loads a module and everything it imports; returns the blob: URL of the entry. */
async function loadGraph(entryUrl: string, blobUrls: string[], stats: LoadStats): Promise<string> {
  const loaded = new Map<string, Promise<string>>();

  const load = (url: string, chain: string[]): Promise<string> => {
    if (chain.includes(url)) return Promise.reject(new CircularModules(url));
    const existing = loaded.get(url);
    if (existing) return existing;

    const task = (async () => {
      const source = await fetchModule(url, stats);
      if (url === entryUrl) stats.entryCode = source.code;
      let code = "";
      let last = 0;
      for (const found of importsOf(source.code)) {
        const target = resolveImport(found.specifier, source.url);
        if (!target) continue;
        const blobUrl = await load(target, [...chain, url]);
        code += source.code.slice(last, found.start) + blobUrl;
        last = found.end;
      }
      code += source.code.slice(last);
      const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      blobUrls.push(blobUrl);
      return blobUrl;
    })();
    loaded.set(url, task);
    return task;
  };

  return load(entryUrl, []);
}

function explainFailure(specifier: string, err: unknown): string {
  if (err instanceof HttpError) {
    return err.status === 404
      ? `There is no npm package "${specifier}" (esm.sh returned 404).`
      : `esm.sh could not provide "${specifier}" (HTTP ${err.status}).`;
  }
  if (isOffline()) {
    return `"${specifier}" hasn't been downloaded on this device yet. Connect to the internet and run again once; it is kept for offline use after that.`;
  }
  return `Could not download "${specifier}" from esm.sh: ${err instanceof Error ? err.message : String(err)}`;
}

/** Updates the package's record after a successful load. */
async function recordPackage(name: string, entryUrl: string, stats: LoadStats) {
  try {
    const existing = await database().packages.get(name);
    // esm.sh opens each entry with `/* esm.sh - name@version[/subpath] */`.
    const banner = /\/\*\s*esm\.sh\s*-\s*(\S+?)\s*\*\//.exec(stats.entryCode || "")?.[1];
    const resolved = banner ? /^((?:@[^/@]+\/)?[^/@]+)@([^/]+)(\/.*)?$/.exec(banner) : null;
    await database().packages.put({
      name,
      version: resolved?.[2] ?? existing?.version,
      files: [...stats.files],
      bytes: stats.bytes,
      hasDefault: /\bexport\s*\{\s*default\b|\bexport\s+default\b/.test(stats.entryCode || ""),
      esmUrl: banner ? `${CDN}/${banner}` : entryUrl,
      installedAt: existing?.installedAt ?? Date.now(),
      lastUsedAt: Date.now(),
      info: existing?.info,
    });
    notify();
  } catch {
    // No IndexedDB: the package still works, it is just not listed.
  }
}

export interface LoadedPackages {
  /** Package name -> blob: URL of its entry module. */
  modules: Record<string, string>;
  /** Package name -> why it is unavailable. Reported only if the code really requires it. */
  errors: Record<string, string>;
  /** Frees the blob: URLs once the run is over. */
  release: () => void;
}

export async function loadPackages(
  specifiers: string[],
  log: (type: "log" | "warn" | "error", message: string) => void = () => {},
): Promise<LoadedPackages> {
  const blobUrls: string[] = [];
  const modules: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const specifier of specifiers) {
    if (NODE_ONLY.has(specifier.replace(/^node:/, ""))) {
      errors[specifier] = `"${specifier}" is part of Node.js and has no browser version; code in this node runs in the browser.`;
      continue;
    }

    let announced = false;
    const stats: LoadStats = {
      downloaded: 0,
      files: new Set(),
      bytes: 0,
      announce: () => {
        if (announced) return;
        announced = true;
        log("log", `[npm] Downloading "${specifier}" from esm.sh...`);
      },
    };

    try {
      let entryUrl = packageUrl(specifier);
      let entry: string;
      try {
        entry = await loadGraph(entryUrl, blobUrls, stats);
      } catch (err) {
        if (!(err instanceof CircularModules)) throw err;
        // Its modules import each other in a loop: take esm.sh's single-file build instead.
        entryUrl = packageUrl(specifier, true);
        stats.files.clear();
        stats.bytes = 0;
        entry = await loadGraph(entryUrl, blobUrls, stats);
      }
      modules[specifier] = entry;
      await recordPackage(specifier, entryUrl, stats);
      log(
        "log",
        stats.downloaded
          ? `[npm] "${specifier}" saved on this device (${stats.downloaded} file${stats.downloaded === 1 ? "" : "s"}); it loads offline from now on.`
          : `[npm] "${specifier}" loaded from this device (no download).`,
      );
    } catch (err) {
      errors[specifier] = explainFailure(specifier, err);
    }
  }

  return {
    modules,
    errors,
    release: () => blobUrls.forEach((url) => URL.revokeObjectURL(url)),
  };
}

// ------------------------------------------------------------------ managing what is kept

let lastKnownList: NpmPackageRecord[] | null = null;

/** The list as last read, or null before the first read - lets a panel open in its final state. */
export const cachedNpmPackages = () => lastKnownList;

export async function listNpmPackages(): Promise<NpmPackageRecord[]> {
  try {
    lastKnownList = (await database().packages.toArray()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    lastKnownList = [];
  }
  return lastKnownList;
}

/**
 * Downloads a package - code and editor types - without running anything, so it is ready
 * offline. Returns null on success, or what went wrong.
 */
export async function downloadNpmPackage(name: string): Promise<string | null> {
  const loaded = await loadPackages([name]);
  loaded.release();
  if (loaded.errors[name]) return loaded.errors[name];
  await downloadPackageTypes(name).catch(() => false);
  return null;
}

/**
 * Deletes a package's kept code and types. Files another kept package also uses stay. A node
 * that still imports it downloads it again on its next run.
 */
export async function removeNpmPackage(name: string): Promise<void> {
  try {
    const all = await database().packages.toArray();
    const record = all.find((p) => p.name === name);
    if (record) {
      const shared = new Set(all.filter((p) => p.name !== name).flatMap((p) => p.files));
      for (const url of record.files) {
        if (!shared.has(url)) await moduleStore.remove(url).catch(() => {});
      }
      await database().packages.delete(name);
    }
  } finally {
    await forgetPackageTypes(name).catch(() => {});
    notify();
  }
}

/** Deletes every kept npm package, code and types. */
export async function clearNpmPackages(): Promise<void> {
  try {
    await moduleStore.clear();
    await database().packages.clear().catch(() => {});
    await clearPackageTypes();
  } finally {
    notify();
  }
}

/** What kept npm packages - code and types - take up on this device, and where. */
export async function npmStorageInfo(): Promise<{ bytes: number; backend: StorageBackend }> {
  const [code, types, backend] = await Promise.all([
    moduleStore.size().catch(() => 0),
    typesStorageSize().catch(() => 0),
    moduleStore.backend(),
  ]);
  return { bytes: code + types, backend };
}

// ------------------------------------------------------------------ what npm says about a package

/** Description, license and links from the npm registry; kept with the package's record. */
export async function fetchNpmInfo(name: string): Promise<NpmPackageInfo | null> {
  const record = await database().packages.get(name).catch(() => undefined);
  if (record?.info && Date.now() - record.info.fetchedAt < INFO_MAX_AGE_MS) return record.info;
  if (isOffline()) return record?.info ?? null;
  try {
    const response = await fetch(`${REGISTRY}/${packageNameOf(name).replace("/", "%2F")}/latest`);
    if (!response.ok) return record?.info ?? null;
    const data = await response.json();
    const repository = typeof data.repository === "string" ? data.repository : data.repository?.url;
    const info: NpmPackageInfo = {
      description: data.description,
      license: typeof data.license === "string" ? data.license : data.license?.type,
      homepage: data.homepage,
      repository: repository ? String(repository).replace(/^git\+/, "").replace(/\.git$/, "") : undefined,
      latest: data.version,
      fetchedAt: Date.now(),
    };
    if (record) await database().packages.update(name, { info }).catch(() => {});
    return info;
  } catch {
    return record?.info ?? null;
  }
}

export interface NpmSearchResult {
  name: string;
  version: string;
  description: string;
}

const searches = new Map<string, Promise<NpmSearchResult[]>>();

/** Package names on npm matching some text. Empty offline or for very short text. */
export function searchNpm(text: string): Promise<NpmSearchResult[]> {
  const query = text.trim().toLowerCase();
  if (query.length < 2 || isOffline()) return Promise.resolve([]);
  let pending = searches.get(query);
  if (!pending) {
    pending = fetch(`${REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=8`)
      .then((response) => (response.ok ? response.json() : { objects: [] }))
      .then((data) =>
        (data.objects || []).map((o: any) => ({
          name: o.package.name,
          version: o.package.version,
          description: o.package.description || "",
        })),
      )
      .catch(() => {
        searches.delete(query); // try again next time
        return [];
      });
    if (searches.size > 200) searches.delete(searches.keys().next().value as string);
    searches.set(query, pending);
  }
  return pending;
}

// ------------------------------------------------------------------ how to import it

/** Names a package is usually bound to, where the camel-cased name would read oddly. */
const USUAL_BINDINGS: Record<string, string> = {
  lodash: "_",
  "lodash-es": "_",
  underscore: "_",
  jquery: "$",
  ramda: "R",
};

/** A variable name for a package: "date-fns" -> "dateFns", "lodash/get" -> "get". */
export function bindingFor(name: string): string {
  const base = packageNameOf(name);
  const subpath = name.slice(base.length).replace(/^@[^/]*/, "").replace(/^\//, "");
  if (!subpath && USUAL_BINDINGS[base]) return USUAL_BINDINGS[base];
  const last = (subpath || base).split("/").pop()!.replace(/@.*$/, "");
  const camel = last.replace(/[-_.]+([a-zA-Z0-9])/g, (_m, c: string) => c.toUpperCase()).replace(/^[^a-zA-Z_$]+/, "");
  return camel || "pkg";
}

/** The import and require lines for a package. */
export function importSnippets(pkg: Pick<NpmPackageRecord, "name" | "hasDefault">) {
  const binding = bindingFor(pkg.name);
  return {
    binding,
    esm: pkg.hasDefault ? `import ${binding} from "${pkg.name}";` : `import * as ${binding} from "${pkg.name}";`,
    require: `const ${binding} = require("${pkg.name}");`,
  };
}
