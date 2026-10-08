import { defineConfig, envField, svgoOptimizer } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { remarkBlog } from "./src/lib/markdown";
import rehypeCallouts from "rehype-callouts";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import config from "./astro-paper.config";
import { fileURLToPath } from "node:url";
import { readSiteContent } from "./src/lib/content-files";

const base = new URL(config.site.url).pathname;

export default defineConfig({
  output: "static",
  trailingSlash: "always",
  image: { domains: [], remotePatterns: [] },
  site: config.site.url,
  base,
  prerenderConflictBehavior: "error",
  integrations: [
    {
      name: "content-contract",
      hooks: {
        "astro:config:done": async ({ config: astroConfig }) => {
          await readSiteContent(fileURLToPath(astroConfig.root));
        },
      },
    },
    sitemap({
      filter: page => !/(?:\/search\/|\/404(?:\/|\.html))$/.test(page),
    }),
  ],
  i18n: {
    locales: ["zh-CN"],
    defaultLocale: "zh-CN",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath, [remarkBlog, { base }]],
      rehypePlugins: [
        [rehypeKatex, { throwOnError: true, trust: false }],
        rehypeCallouts,
      ],
    }),
    shikiConfig: {
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
