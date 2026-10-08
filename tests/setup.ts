import { mkdir } from "node:fs/promises";
// Tests must also work in a fresh Linux checkout, not only with a warm local cache.
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
