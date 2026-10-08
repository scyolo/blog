import { readSiteContent } from "../src/lib/content-files.ts";
import { verifyArtifact } from "./lib/artifact.mjs";
const content = await readSiteContent();
const result = await verifyArtifact({
  directory: "dist",
  posts: content.posts,
  siteUrl: process.env.SITE_URL,
});
process.stdout.write("Artifact verified: " + JSON.stringify(result) + "\n");
