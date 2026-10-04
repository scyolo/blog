import type { UIStrings } from '../types';
export default {
  nav: { home: '首页', posts: '文章', tags: '标签', about: '关于', archives: '归档', search: '搜索' },
  post: { publishedAt: '发布于', updatedAt: '更新于', sharePostIntro: '分享这篇文章', sharePostOn: '分享到 {{platform}}', sharePostViaEmail: '通过邮件分享', tagLabel: '标签', backToTop: '回到顶部', goBack: '返回', editPage: '编辑文章', previousPost: '上一篇', nextPost: '下一篇' },
  pagination: { prev: '上一页', next: '下一页', page: '页' },
  home: { socialLinks: '个人链接', featured: '精选文章', recentPosts: '最近发布', allPosts: '全部文章' },
  footer: { copyright: '版权', allRightsReserved: '记录与分享。' },
  pages: { tagTitle: '标签', tagDesc: '这个标签下的文章', tagsTitle: '标签', tagsDesc: '沿着主题，发现更多记录。', postsTitle: '文章', postsDesc: '技术、思考与日常，慢慢积累。', archivesTitle: '归档', archivesDesc: '按时间，回看留下的文字。', searchTitle: '搜索', searchDesc: '查找文章标题或正文中的关键词。' },
  a11y: { skipToContent: '跳转到正文', openMenu: '展开导航', closeMenu: '收起导航', toggleTheme: '切换亮暗主题', searchPlaceholder: '搜索文章…', noResults: '没有找到相关文章', goToPreviousPage: '前往上一页', goToNextPage: '前往下一页' },
  notFound: { title: '404 · 页面未找到', message: '这一页还没有写下', goHome: '回到首页' },
} satisfies UIStrings;
