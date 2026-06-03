import Dexie, { type Table } from "dexie";

export interface PyPackageMetadata {
  name: string;
  version: string;
  installedAt: string;
  status: "installed" | "loading" | "error";
  isPrebuilt?: boolean;
}

export interface PyWheelCache {
  url: string;
  data: ArrayBuffer;
  cachedAt: number;
}

class PyPackageDatabase extends Dexie {
  packages!: Table<PyPackageMetadata, string>;
  wheels!: Table<PyWheelCache, string>;

  constructor() {
    super("py_package_manager_dexie_db");
    this.version(1).stores({
      packages: "name",
      wheels: "url"
    });
  }
}

export const pyDb = new PyPackageDatabase();

export async function getInstalledPackages(): Promise<PyPackageMetadata[]> {
  try {
    return await pyDb.packages.toArray();
  } catch (err) {
    console.warn("Failed to get packages from Dexie, returning empty", err);
    return [];
  }
}

export async function saveInstalledPackage(pkg: PyPackageMetadata): Promise<void> {
  try {
    await pyDb.packages.put(pkg);
  } catch (err) {
    console.error("Failed to save package inside Dexie DB", err);
    throw err;
  }
}

export async function removeInstalledPackage(name: string): Promise<void> {
  try {
    await pyDb.packages.delete(name);
  } catch (err) {
    console.error("Failed to delete package from Dexie DB", err);
    throw err;
  }
}

export async function getWheelsCacheSize(): Promise<number> {
  try {
    const all = await pyDb.wheels.toArray();
    let size = 0;
    for (const w of all) {
      if (w.data) {
        size += w.data.byteLength;
      }
    }
    return size;
  } catch {
    return 0;
  }
}

export async function clearWheelsCache(): Promise<void> {
  try {
    await pyDb.wheels.clear();
  } catch {}
}
