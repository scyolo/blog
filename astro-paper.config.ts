import { defineAstroPaperConfig } from './src/types/config';
export default defineAstroPaperConfig({
  site: {
    url: process.env.SITE_URL || 'http://localhost:4321',
    title: '行间 · scyolo',
    description: '记录技术、思考与日常。在理解中积累，在写作中看见。',
    author: 'scyolo', profile: 'https://github.com/scyolo',
    ogImage: 'default-og.png', lang: 'zh-CN', timezone: 'Asia/Shanghai', dir: 'ltr',
  },
  posts: { perPage: 6, perIndex: 6, scheduledPostMargin: 0 },
  features: { lightAndDarkMode: true, dynamicOgImage: false, showArchives: true, showBackButton: false, editPost: { enabled: false }, search: 'pagefind' },
  socials: [{ name: 'github', url: 'https://github.com/scyolo', linkTitle: '在 GitHub 找到 scyolo' }],
  shareLinks: [],
});
