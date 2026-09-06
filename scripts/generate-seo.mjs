import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogArray, seoFilesFromCatalog } from "../lib/seo-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const catalog = catalogArray(JSON.parse(await readFile(path.join(root, "posters.json"), "utf8")));
const printsDir = path.join(root, "prints");
let existingPrintIds = [];
try {
  existingPrintIds = (await readdir(printsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
} catch {
  existingPrintIds = [];
}

const { upserts, deletions } = seoFilesFromCatalog(catalog, { existingPrintIds });

for (const file of upserts) {
  const full = path.join(root, file.path);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, file.content);
}

for (const filePath of deletions) {
  const full = path.join(root, filePath);
  await rm(full, { force: true });
  const dir = path.dirname(full);
  try {
    const leftover = await readdir(dir);
    if (!leftover.length) await rm(dir, { recursive: true, force: true });
  } catch {
    /* already gone */
  }
}

console.log(`Wrote ${upserts.length} SEO files, removed ${deletions.length}.`);
