export default {
  site: {
    lang: "zh-CN",
    url: "http://localhost:4321",
    title: "测试博客",
    description: "测试摘要",
  },
  // Deliberately nonzero: the publication policy must never inherit an early-release margin.
  posts: { scheduledPostMargin: 15 * 60 * 1000 },
};
