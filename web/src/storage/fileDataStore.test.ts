import { describe, expect, it } from "vitest";
import { createDefaultData } from "../domain/defaultData";
import { FileDataStore, MAIN_FILE, PREVIOUS_FILE } from "./fileDataStore";

class MemoryFile {
  constructor(private readonly read: () => string) {}
  async text() { return this.read(); }
}

class MemoryFileHandle {
  readonly kind = "file" as const;
  constructor(readonly name: string, private readonly directory: MemoryDirectory) {}
  async getFile() { return new MemoryFile(() => this.directory.files.get(this.name) ?? ""); }
  async createWritable() {
    let value = "";
    return {
      write: async (next: string | BufferSource | Blob) => { value = String(next); },
      close: async () => { this.directory.files.set(this.name, value); },
      abort: async () => undefined,
    };
  }
}

class MemoryDirectory {
  readonly kind = "directory" as const;
  readonly name = "memory";
  readonly files = new Map<string, string>();
  readonly directories = new Map<string, MemoryDirectory>();
  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name) && !options?.create) throw new DOMException("missing", "NotFoundError");
    if (!this.files.has(name)) this.files.set(name, "");
    return new MemoryFileHandle(name, this);
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    if (!this.directories.has(name) && !options?.create) throw new DOMException("missing", "NotFoundError");
    if (!this.directories.has(name)) this.directories.set(name, new MemoryDirectory());
    return this.directories.get(name)!;
  }
  async removeEntry(name: string) { this.files.delete(name); }
  async *values() { for (const name of this.files.keys()) yield new MemoryFileHandle(name, this); }
}

describe("FileDataStore", () => {
  it("initializes, saves, and keeps previous and daily backups", async () => {
    const directory = new MemoryDirectory();
    const store = new FileDataStore(directory as unknown as FileSystemDirectoryHandle);
    const initial = await store.initialize(new Date(2026, 7, 27, 8).getTime());
    expect(JSON.parse(directory.files.get(MAIN_FILE)!)).toMatchObject({ schemaVersion: 1 });
    await store.save({ ...initial, tasks: [], updatedAtMs: 2 }, new Date(2026, 7, 27, 9).getTime());
    expect(JSON.parse(directory.files.get(PREVIOUS_FILE)!)).toMatchObject({ updatedAtMs: initial.updatedAtMs });
    expect(directory.directories.get("backups")?.files.size).toBe(1);
  });

  it("refuses to overwrite corrupt primary data", async () => {
    const directory = new MemoryDirectory();
    directory.files.set(MAIN_FILE, "not-json");
    const store = new FileDataStore(directory as unknown as FileSystemDirectoryHandle);
    await expect(store.save(createDefaultData(1), 2)).rejects.toThrow("有效的 JSON");
    expect(directory.files.get(MAIN_FILE)).toBe("not-json");
  });
});
