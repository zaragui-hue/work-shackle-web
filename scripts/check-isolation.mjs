import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

const files = (await sourceFiles(fileURLToPath(new URL("../src", import.meta.url)))).filter((file) => [".ts", ".tsx", ".css"].includes(extname(file)));
const forbidden = /(?:from\s+["']|@import\s+["'])(?:\.\.\/){2,}(?:src|src-tauri)\//;
for (const file of files) {
  if (forbidden.test(await readFile(file, "utf8"))) {
    process.stderr.write(`Web source imports desktop source: ${file}\n`);
    process.exit(1);
  }
}
process.stdout.write("Web source is isolated from desktop source.\n");
