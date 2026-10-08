export interface AstroPaperConfig {
  site: {
    url: string;
    title: string;
    description: string;
    author: string;
    profile?: string;
    ogImage: string;
    lang: "zh-CN";
    timezone: "Asia/Shanghai";
    dir: "ltr";
    googleVerification?: string;
  };
  posts: { perPage: number; perIndex: number };
  socials: { name: string; url: string; linkTitle?: string }[];
}
export type ResolvedAstroPaperConfig = AstroPaperConfig;
export function defineAstroPaperConfig(
  config: AstroPaperConfig
): AstroPaperConfig {
  return config;
}
