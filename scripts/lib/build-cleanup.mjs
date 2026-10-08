import { lstat, realpath, rm } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
const inside = (root, target) => {
  const part = relative(root, target);
  return part !== "" && !part.startsWith("..") && !isAbsolute(part);
};
export async function cleanBuildOutputs(directory) {
  const root = await realpath(directory);
  for (const name of [
    "dist",
    ".astro",
    "public/pagefind",
    "node_modules/.astro/data-store.json",
  ]) {
    const target = resolve(root, name);
    if (!inside(root, target)) throw Error("Build output outside workspace");
    const entry = await lstat(target).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!entry) continue;
    if (entry.isSymbolicLink())
      throw Error("Refusing to clean a symlink: " + name);
    if (!inside(root, await realpath(target)))
      throw Error("Build output resolves outside workspace: " + name);
    if (name.endsWith(".json") && !entry.isFile())
      throw Error("Expected a regular cache file: " + name);
    await rm(target, { recursive: entry.isDirectory(), force: true });
  }
}
