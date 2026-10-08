import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import {
  postSchema,
  projectSchema,
  pageSchema,
  timestampSchema,
  slugSchema,
} from "./lib/content-schema";
export const BLOG_PATH = "src/content/posts";
const id = ({ data }: { data: Record<string, unknown> }) =>
  slugSchema.parse(data.slug);
const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./" + BLOG_PATH, generateId: id }),
  schema: ({ image }) =>
    postSchema.extend({
      pubDatetime: z.union([timestampSchema, z.date()]),
      modDatetime: z.union([timestampSchema, z.date()]).optional(),
      cover: image().optional(),
    }),
});
const projects = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/projects",
    generateId: id,
  }),
  schema: ({ image }) => projectSchema.extend({ cover: image().optional() }),
});
const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: pageSchema,
});
export const collections = { posts, projects, pages };
