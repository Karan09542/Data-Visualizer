/**
 * Editor types for npm packages used in JS/TS nodes: autocomplete, hovers and signature help.
 *
 * esm.sh names each package's type definitions in an `X-TypeScript-Types` header. Those .d.ts
 * files are fetched - following their imports and references - kept on the device like the
 * package code, and handed to Monaco as extra libraries under a virtual `node_modules`:
 * `https://esm.sh/@types/lodash@4.17.25/common/array.d.ts` becomes
 * `file:///node_modules/lodash/common/array.d.ts`. The compiler's `paths` send every bare import
 * there, so editors whose model lives in memory rather than under file:/// find packages too.
 *
 * Kept in OPFS (`js_packages/types`), or IndexedDB where OPFS cannot be written, so the types
 * are there offline once fetched. A manifest records which files each package brought, so a
 * package can be removed without taking another's files with it.
 */
import Dexie, { type Table } from "dexie";
import { createDeviceFileStore, type StoredFileRecord } from "./deviceFileStore";

const CDN = "https://esm.sh";
const NODE_MODULES = "file:///node_modules/";
/** Upper bound on files per package, so a runaway type graph cannot flood the editor. */
const MAX_FILES = 2500;
/** esm.sh speaks HTTP/2, so many small type files download side by side. */
const CONCURRENCY = 16;
/** A package whose types could not be had is tried again after this long (e.g. back online). */
const RETRY_AFTER_MS = 30_000;
/** Store key of the record of which type files each package brought. */
const MANIFEST = "types-manifest:v1";

class TypesDatabase extends Dexie {
  files!: Table<StoredFileRecord, string>;

  constructor() {
    super("js_package_types");
    this.version(1).stores({ files: "url" });
  }
}

let database: TypesDatabase | null = null;

const typeStore = createDeviceFileStore({
  opfsPath: ["js_packages", "types"],
  table: () => (database ??= new TypesDatabase()).files,
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function readKept<T>(key: string): Promise<T | null> {
  const data = await typeStore.read(key).catch(() => null);
  if (!data) return null;
  try {
    return JSON.parse(decoder.decode(data)) as T;
  } catch {
    return null;
  }
}

async function keep(key: string, value: unknown) {
  try {
    await typeStore.write(key, encoder.encode(JSON.stringify(value)).buffer as ArrayBuffer);
  } catch {
    // Not kept: fetched again next time.
  }
}

type Manifest = Record<string, string[]>;
let manifestChain: Promise<unknown> = Promise.resolve();

/** Read-modify-write of the manifest, one at a time so concurrent packages do not overwrite each other. */
function updateManifest<T>(change: (manifest: Manifest) => T): Promise<T> {
  const run = manifestChain.then(async () => {
    const manifest = (await readKept<Manifest>(MANIFEST)) || {};
    const result = change(manifest);
    await keep(MANIFEST, manifest);
    return result;
  });
  manifestChain = run.catch(() => {});
  return run;
}

// ------------------------------------------------------------------ reading import specifiers

/** Node's built-in modules: their types would need all of @types/node, so they are left out. */
const NODE_BUILTINS = new Set([
  "assert", "buffer", "child_process", "cluster", "crypto", "dgram", "dns", "events", "fs",
  "http", "http2", "https", "inspector", "module", "net", "os", "path", "perf_hooks", "process",
  "querystring", "readline", "repl", "stream", "string_decoder", "timers", "tls", "tty", "url",
  "util", "v8", "vm", "worker_threads", "zlib",
]);

const VALID_SPECIFIER = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(@[^/\s]+)?(\/[\w.@/-]*)?$/i;

/** "lodash@4/fp" -> "lodash", "@scope/pkg@1/x" -> "@scope/pkg". */
export const packageNameOf = (specifier: string) => {
  const parts = specifier.split("/");
  const head = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  return head.replace(/(.)@.*$/, "$1");
};

export const isPackageSpecifier = (specifier: string) =>
  VALID_SPECIFIER.test(specifier) && !specifier.startsWith("node:") && !NODE_BUILTINS.has(packageNameOf(specifier));

/**
 * Where comments are, so imports shown in comments and JSDoc examples are not taken for real
 * ones. Strings are skipped over, so a `//` inside a URL is not mistaken for a comment.
 */
function commentRanges(code: string): [number, number][] {
  const ranges: [number, number][] = [];
  const n = code.length;
  let i = 0;
  while (i < n) {
    const c = code[i];
    if (c === '"' || c === "'" || c === "`") {
      i++;
      while (i < n && code[i] !== c) {
        if (code[i] === "\\") i++;
        else if (c !== "`" && code[i] === "\n") break;
        i++;
      }
      i++;
    } else if (c === "/" && code[i + 1] === "/") {
      const start = i;
      while (i < n && code[i] !== "\n") i++;
      ranges.push([start, i]);
    } else if (c === "/" && code[i + 1] === "*") {
      const start = i;
      const end = code.indexOf("*/", i + 2);
      i = end < 0 ? n : end + 2;
      ranges.push([start, i]);
    } else {
      i++;
    }
  }
  return ranges;
}

const inRanges = (ranges: [number, number][], offset: number) => {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (offset < ranges[mid][0]) hi = mid - 1;
    else if (offset >= ranges[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
};

const IMPORT_SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(["'])([^"'\n]+)\2/g;
const REFERENCE = /(\/\/\/\s*<reference\s+(path|types)\s*=\s*)(["'])([^"'\n]+)\3/g;

/** Package names a piece of JS/TS source imports or requires. */
export function findPackageImports(source: string): string[] {
  const comments = commentRanges(source);
  const found = new Set<string>();
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    if (inRanges(comments, match.index!)) continue;
    const specifier = match[3].trim();
    if (isPackageSpecifier(specifier)) found.add(specifier);
  }
  return [...found];
}

// ------------------------------------------------------------------ esm.sh URLs -> virtual files

/** `/@types/lodash@4.17.25/common/array.d.ts` -> types prefix, package name, path inside it. */
const PACKAGE_PATH = /^\/(?:v\d+\/)?(@types\/)?((?:@[^/@]+\/)?[^/@]+)@[^/]+\/(.*)$/;
const DTS_VARIANT = /\.d\.[cm]ts$/;

/** `@types/babel__core` holds the types of `@babel/core`. */
const typedPackageName = (name: string) => (name.includes("__") ? `@${name.replace("__", "/")}` : name);

/** Where a type file sits in the virtual node_modules. `.d.cts` / `.d.mts` become plain `.d.ts`. */
export function virtualPathFor(url: string): string {
  const parsed = new URL(url);
  const match = parsed.hostname === "esm.sh" ? PACKAGE_PATH.exec(parsed.pathname) : null;
  const path = match
    ? `${match[1] ? typedPackageName(match[2]) : match[2]}/${match[3]}`
    : `.esm/${parsed.hostname}${parsed.pathname}`;
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Keep it encoded.
  }
  return (NODE_MODULES + decoded).replace(DTS_VARIANT, ".d.ts");
}

/** The bare specifier that resolves to a virtual file through `paths`: "react/index". */
const bareFor = (virtualPath: string) => virtualPath.slice(NODE_MODULES.length).replace(/\.d\.ts$/, "");

/** A relative path between two virtual files, for `/// <reference path>`. */
export function relativePath(fromFile: string, toFile: string): string {
  const from = fromFile.slice(NODE_MODULES.length).split("/").slice(0, -1);
  const to = toFile.slice(NODE_MODULES.length).split("/");
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  const up = from.length - i;
  return (up ? "../".repeat(up) : "./") + to.slice(i).join("/");
}

const isRelative = (s: string) => s.startsWith("./") || s.startsWith("../");
const isUrl = (s: string) => /^https?:\/\//.test(s);

/** Where a relative import in a type file lives on esm.sh; later entries are fallbacks. */
function typeFileCandidates(specifier: string, base: string): string[] {
  const resolved = new URL(specifier, base).href;
  if (/\.d\.[cm]?ts$/.test(resolved)) return [resolved];
  if (/\.[cm]?js$/.test(resolved)) return [resolved.replace(/\.([cm]?)js$/, (_m, k) => `.d.${k}ts`)];
  return [`${resolved}.d.ts`, `${resolved}/index.d.ts`];
}

/** How a relative import reads once every file carries a plain .d.ts name. */
const normalizeRelative = (specifier: string) => specifier.replace(/\.d\.[cm]?ts$/, "").replace(/\.[cm]js$/, ".js");

export interface TypeDependencies {
  files: { url: string; fallbacks: string[] }[];
  packages: string[];
}

/**
 * Rewrites a type file's imports for the virtual node_modules, and lists what it depends on:
 * relative and esm.sh files to fetch, and other packages whose types it needs.
 */
export function rewriteTypes(code: string, fileUrl: string): { code: string; deps: TypeDependencies } {
  const deps: TypeDependencies = { files: [], packages: [] };
  const self = virtualPathFor(fileUrl);

  let out = code.replace(REFERENCE, (all, head: string, kind: string, quote: string, specifier: string) => {
    if (kind === "types") {
      if (isPackageSpecifier(specifier)) deps.packages.push(specifier);
      return all;
    }
    if (isUrl(specifier)) {
      deps.files.push({ url: specifier, fallbacks: [] });
      return head + quote + relativePath(self, virtualPathFor(specifier)) + quote;
    }
    deps.files.push({ url: new URL(specifier, fileUrl).href, fallbacks: [] });
    return head + quote + specifier.replace(DTS_VARIANT, ".d.ts") + quote;
  });

  const comments = commentRanges(out);
  out = out.replace(IMPORT_SPECIFIER, (all, head: string, quote: string, specifier: string, offset: number) => {
    if (inRanges(comments, offset)) return all;
    if (isRelative(specifier)) {
      const [first, ...fallbacks] = typeFileCandidates(specifier, fileUrl);
      deps.files.push({ url: first, fallbacks });
      return head + quote + normalizeRelative(specifier) + quote;
    }
    if (isUrl(specifier)) {
      if (new URL(specifier).hostname !== "esm.sh") return all;
      deps.files.push({ url: specifier, fallbacks: [] });
      return head + quote + bareFor(virtualPathFor(specifier)) + quote;
    }
    if (isPackageSpecifier(specifier)) deps.packages.push(specifier);
    return all;
  });

  return { code: out, deps };
}

/**
 * A file at `node_modules/<specifier>.d.ts` pointing at a package's real entry, for entries that
 * are not where TypeScript looks (a `dist/` folder, a version pin in the import).
 */
export function stubFor(entryCode: string, target: string): string {
  if (/\bexport\s*=/.test(entryCode)) return `import __types = require("${target}");\nexport = __types;\n`;
  const hasDefault = /\bexport\s+default\b|\bas\s+default\b/.test(entryCode);
  return `export * from "${target}";\n${hasDefault ? `export { default } from "${target}";\n` : ""}`;
}

// ------------------------------------------------------------------ fetching

interface TypeFile {
  url: string;
  code: string;
}

const indexKey = (specifier: string) => `types-index:${specifier}`;

/** The URL of a package's types from esm.sh; null when it has none, undefined when unreachable. */
async function typesEntryFor(specifier: string): Promise<string | null | undefined> {
  const kept = await readKept<{ typesUrl: string | null }>(indexKey(specifier));
  if (kept) return kept.typesUrl;
  let response: Response;
  try {
    response = await fetch(`${CDN}/${specifier}?target=es2022`);
  } catch {
    return undefined;
  }
  if (!response.ok) return response.status === 404 ? null : undefined;
  const typesUrl = response.headers.get("x-typescript-types");
  void response.body?.cancel();
  void keep(indexKey(specifier), { typesUrl });
  return typesUrl;
}

async function fetchTypeFile(url: string): Promise<TypeFile | null> {
  const kept = await readKept<TypeFile>(url);
  if (kept) return kept;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const file = { url: response.url || url, code: await response.text() };
    // Saved in the background: waiting on each write held up the next download.
    void keep(url, file);
    return file;
  } catch {
    return null;
  }
}

interface Crawled {
  /** Rewritten files, keyed by virtual path. */
  files: Map<string, string>;
  entry: TypeFile;
}

/** Every type file reachable from the entry. Records which store keys this package uses. */
async function crawlPackage(specifier: string, onPackage: (specifier: string) => void): Promise<Crawled | null> {
  const entryUrl = await typesEntryFor(specifier);
  if (!entryUrl) return null;

  const files = new Map<string, string>();
  const keys = new Set<string>();
  const seen = new Set<string>([entryUrl]);
  const queue: { url: string; fallbacks: string[] }[] = [{ url: entryUrl, fallbacks: [] }];
  let entry: TypeFile | null = null;
  let active = 0;

  const visit = async (item: { url: string; fallbacks: string[] }) => {
    let file: TypeFile | null = null;
    for (const url of [item.url, ...item.fallbacks]) {
      file = await fetchTypeFile(url);
      if (file) {
        keys.add(url);
        break;
      }
    }
    if (!file) return;
    if (item.url === entryUrl) entry = file;
    const virtualPath = virtualPathFor(file.url);
    if (files.has(virtualPath)) return;
    const { code, deps } = rewriteTypes(file.code, file.url);
    files.set(virtualPath, code);
    for (const dep of deps.files) {
      if (seen.has(dep.url) || seen.size >= MAX_FILES) continue;
      seen.add(dep.url);
      queue.push(dep);
    }
    deps.packages.forEach(onPackage);
  };

  await new Promise<void>((resolve) => {
    const pump = () => {
      while (active < CONCURRENCY && queue.length) {
        const item = queue.shift()!;
        active++;
        visit(item)
          .catch(() => {})
          .finally(() => {
            active--;
            pump();
          });
      }
      if (!queue.length && active === 0) resolve();
    };
    pump();
  });

  if (!entry) return null;
  await updateManifest((manifest) => {
    manifest[specifier] = [...keys];
  });
  return { files, entry };
}

// ------------------------------------------------------------------ handing them to Monaco

interface Registry {
  monaco: any;
  /** Registered files, the Monaco registrations to undo, and the packages that brought them. */
  libs: Map<string, { disposables: { dispose(): void }[]; owners: Set<string> }>;
  packages: Map<string, { result: Promise<boolean>; settled?: { ok: boolean; at: number } }>;
  configured: boolean;
}

const registries = new Map<object, Registry>();

const typescriptApi = (monaco: any) => monaco?.typescript ?? monaco?.languages?.typescript;

function registryFor(monaco: any): Registry {
  let registry = registries.get(monaco);
  if (!registry) {
    registry = { monaco, libs: new Map(), packages: new Map(), configured: false };
    registries.set(monaco, registry);
  }
  return registry;
}

/** Points every bare import at the virtual node_modules, whatever the importing model's URI. */
function configurePaths(registry: Registry) {
  if (registry.configured) return;
  registry.configured = true;
  const ts = typescriptApi(registry.monaco);
  for (const defaults of [ts.typescriptDefaults, ts.javascriptDefaults]) {
    const options = defaults.getCompilerOptions();
    defaults.setCompilerOptions({
      ...options,
      moduleResolution: options.moduleResolution ?? ts.ModuleResolutionKind?.NodeJs ?? 2,
      // `import _ from "lodash"` on an `export =` package: the runtime hands over the default
      // (see codeNodeExecutor), so the types should agree.
      esModuleInterop: options.esModuleInterop ?? true,
      allowSyntheticDefaultImports: options.allowSyntheticDefaultImports ?? true,
      baseUrl: "file:///",
      paths: { ...(options.paths || {}), "*": ["node_modules/*", "node_modules/@types/*"] },
    });
  }
}

function registerLib(registry: Registry, path: string, content: string, owner: string) {
  const existing = registry.libs.get(path);
  if (existing) {
    existing.owners.add(owner);
    return;
  }
  const ts = typescriptApi(registry.monaco);
  registry.libs.set(path, {
    disposables: [ts.typescriptDefaults.addExtraLib(content, path), ts.javascriptDefaults.addExtraLib(content, path)],
    owners: new Set([owner]),
  });
}

async function acquire(registry: Registry, specifier: string): Promise<boolean> {
  const crawled = await crawlPackage(specifier, (dep) => void ensurePackageTypes(registry.monaco, [dep]));
  if (!crawled) return false;

  configurePaths(registry);
  for (const [path, content] of crawled.files) registerLib(registry, path, content, specifier);

  const entryPath = virtualPathFor(crawled.entry.url);
  const expected = [`${NODE_MODULES}${specifier}.d.ts`, `${NODE_MODULES}${specifier}/index.d.ts`];
  if (!expected.includes(entryPath)) {
    registerLib(registry, expected[0], stubFor(crawled.entry.code, bareFor(entryPath)), specifier);
  }
  return true;
}

/**
 * Makes sure Monaco has types for these packages; returns which ones it has. Each package is
 * fetched once per editor instance; one that failed is tried again after a while.
 */
export async function ensurePackageTypes(monaco: any, specifiers: string[]): Promise<Record<string, boolean>> {
  if (!typescriptApi(monaco)) return {};
  const registry = registryFor(monaco);
  const outcome: Record<string, boolean> = {};

  await Promise.all(
    specifiers.filter(isPackageSpecifier).map(async (specifier) => {
      let slot = registry.packages.get(specifier);
      const stale = slot?.settled && !slot.settled.ok && Date.now() - slot.settled.at > RETRY_AFTER_MS;
      if (!slot || stale) {
        const result = acquire(registry, specifier).catch(() => false);
        const fresh: NonNullable<typeof slot> = { result };
        void result.then((ok) => (fresh.settled = { ok, at: Date.now() }));
        registry.packages.set(specifier, fresh);
        slot = fresh;
      }
      outcome[specifier] = await slot.result;
    }),
  );
  return outcome;
}

const downloads = new Map<string, Promise<boolean>>();

/** Fetches and keeps a package's types without an editor, so they are there offline later. */
export function downloadPackageTypes(specifier: string): Promise<boolean> {
  if (!isPackageSpecifier(specifier)) return Promise.resolve(false);
  let pending = downloads.get(specifier);
  if (!pending) {
    pending = crawlPackage(specifier, (dep) => void downloadPackageTypes(dep))
      .then((crawled) => !!crawled)
      .catch(() => false)
      .finally(() => downloads.delete(specifier));
    downloads.set(specifier, pending);
  }
  return pending;
}

/**
 * Drops a package's types: from every open editor, and from the device - except files another
 * package brought too. Editors still importing it fetch them again.
 */
export async function forgetPackageTypes(specifier: string): Promise<void> {
  for (const registry of registries.values()) {
    registry.packages.delete(specifier);
    for (const [path, lib] of registry.libs) {
      lib.owners.delete(specifier);
      if (lib.owners.size) continue;
      lib.disposables.forEach((d) => d.dispose());
      registry.libs.delete(path);
    }
  }
  const unshared = await updateManifest((manifest) => {
    const mine = manifest[specifier] || [];
    delete manifest[specifier];
    const others = new Set(Object.values(manifest).flat());
    return mine.filter((key) => !others.has(key));
  });
  for (const key of [...unshared, indexKey(specifier)]) await typeStore.remove(key).catch(() => {});
}

/** Drops every package's types, from open editors and from the device. */
export async function clearPackageTypes(): Promise<void> {
  for (const registry of registries.values()) {
    for (const lib of registry.libs.values()) lib.disposables.forEach((d) => d.dispose());
    registry.libs.clear();
    registry.packages.clear();
  }
  await typeStore.clear();
}

/** What kept type files take up on this device. */
export const typesStorageSize = () => typeStore.size();
