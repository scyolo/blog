import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createManifest, assertManifest } from "./lib/artifact.mjs";
const path = ".cache/artifact-manifest.json";
const mode = process.argv[2];
if (mode === "seal") {
  await mkdir(".cache", { recursive: true });
  await writeFile(
    path,
    JSON.stringify(await createManifest("dist"), null, 2) + "\n"
  );
  process.stdout.write("Artifact SHA-256 manifest sealed: " + path + "\n");
} else if (mode === "check") {
  await assertManifest("dist", JSON.parse(await readFile(path, "utf8")));
  process.stdout.write("Artifact SHA-256 manifest verified: unchanged.\n");
} else throw new Error("Usage: node scripts/artifact-manifest.mjs seal|check");
