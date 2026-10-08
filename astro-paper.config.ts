import { defineAstroPaperConfig } from "./src/types/config";
import { normalizeSiteUrl } from "./src/lib/site-url";
export default defineAstroPaperConfig({
  site: {
    url: normalizeSiteUrl(process.env.SITE_URL),
    title: "行间 · scyolo",
    description: "记录技术、思考与日常。在理解中积累，在写作中看见。",
    author: "scyolo",
    profile: "https://github.com/scyolo",
    ogImage: "default-og.png",
    lang: "zh-CN",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: { perPage: 6, perIndex: 6 },
  socials: [
    {
      name: "github",
      url: "https://github.com/scyolo",
      linkTitle: "在 GitHub 找到 scyolo",
    },
  ],
});
