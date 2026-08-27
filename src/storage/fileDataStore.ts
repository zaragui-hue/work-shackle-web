import { createDefaultData } from "../domain/defaultData";
import { WebDataSchema, type WebData } from "../domain/model";
import { localDate } from "../domain/workday";

export const MAIN_FILE = "work-shackle-web.json";
export const PREVIOUS_FILE = "work-shackle-web.backup.json";

export class StorageError extends Error {
  constructor(public readonly code: "permission" | "invalid" | "future" | "read" | "write", message: string) { super(message); }
}

async function readText(directory: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  try {
    const handle = await directory.getFileHandle(name);
    return await (await handle.getFile()).text();
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return null;
    throw error;
  }
}

async function writeText(directory: FileSystemDirectoryHandle, name: string, text: string) {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try { await writable.write(text); await writable.close(); } catch (error) { await writable.abort(); throw error; }
}

export async function ensurePermission(handle: FileSystemDirectoryHandle, request = false): Promise<boolean> {
  const descriptor = { mode: "readwrite" } as const;
  if (await handle.queryPermission(descriptor) === "granted") return true;
  return request && await handle.requestPermission(descriptor) === "granted";
}

export class FileDataStore {
  constructor(readonly directory: FileSystemDirectoryHandle) {}

  async initialize(nowMs = Date.now()): Promise<WebData> {
    const raw = await readText(this.directory, MAIN_FILE);
    if (raw === null) {
      const data = createDefaultData(nowMs);
      await writeText(this.directory, MAIN_FILE, JSON.stringify(data, null, 2));
      return data;
    }
    return this.parse(raw);
  }

  async load(): Promise<WebData> {
    const raw = await readText(this.directory, MAIN_FILE);
    if (raw === null) throw new StorageError("read", "没有找到 Web 数据文件");
    return this.parse(raw);
  }

  async save(data: WebData, nowMs = Date.now()): Promise<void> {
    const validated = WebDataSchema.safeParse({ ...data, updatedAtMs: nowMs });
    if (!validated.success) throw new StorageError("invalid", "当前数据校验失败，已停止写入");
    try {
      const current = await readText(this.directory, MAIN_FILE);
      if (current !== null) {
        this.parse(current);
        await writeText(this.directory, PREVIOUS_FILE, current);
        const backups = await this.directory.getDirectoryHandle("backups", { create: true });
        const dailyName = `work-shackle-web-${localDate(nowMs)}.json`;
        if (await readText(backups, dailyName) === null) await writeText(backups, dailyName, current);
        await this.trimBackups(backups);
      }
      await writeText(this.directory, MAIN_FILE, JSON.stringify(validated.data, null, 2));
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("write", error instanceof Error ? error.message : "数据保存失败");
    }
  }

  async restorePrevious(): Promise<WebData> {
    const raw = await readText(this.directory, PREVIOUS_FILE);
    if (raw === null) throw new StorageError("read", "没有找到上一版本备份");
    const data = this.parse(raw);
    await writeText(this.directory, MAIN_FILE, JSON.stringify(data, null, 2));
    return data;
  }

  private parse(raw: string): WebData {
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new StorageError("invalid", "主数据文件不是有效的 JSON"); }
    if (typeof value === "object" && value !== null && "schemaVersion" in value && Number((value as { schemaVersion: unknown }).schemaVersion) > 1) throw new StorageError("future", "数据来自更高版本，请升级 Web 应用");
    const parsed = WebDataSchema.safeParse(value);
    if (!parsed.success) throw new StorageError("invalid", "主数据文件结构损坏");
    return parsed.data;
  }

  private async trimBackups(directory: FileSystemDirectoryHandle) {
    const names: string[] = [];
    for await (const handle of directory.values()) if (handle.kind === "file" && /^work-shackle-web-\d{4}-\d{2}-\d{2}\.json$/.test(handle.name)) names.push(handle.name);
    for (const name of names.sort().slice(0, -30)) await directory.removeEntry(name);
  }
}
