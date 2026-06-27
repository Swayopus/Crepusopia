/**
 * 站点全局配置。
 *
 * 所有用户可修改的字段标记为 @custom —— 编辑它们即可个性化你的站点。
 * 标记为 @required 的字段对站点正常运行至关重要，请勿删除。
 */

export const siteConfig = {
  // ---- 站点元数据 ----

  /** @custom — 站点部署后的公开 URL。需包含末尾斜杠。 */
  siteUrl: "https://swayopus.space/",
  /** @required — 基础路径前缀。根目录为 "/"；若部署在子目录则为 "/blog/"。 */
  base: "/",
  /** @custom — 站点标题，用于顶栏、浏览器标签页和 SEO。 */
  title: "Crepusopia",
  /** @custom — 副标题，显示在首页站点标题下方。 */
  subtitle: "Writing about code, design, and the spaces between.",
  /** @custom — 默认作者名，用于文章和 RSS 订阅。 */
  author: "Swayopus",
  /** @custom — 站点简短描述，用于 SEO meta 标签、RSS 和社交预览。 */
  description:
    "A personal blog about technology, engineering, and creative pursuits.",

  // ---- 语言与地区 ----

  /** @custom — HTML lang 属性。"zh-Hans" 表示简体中文；"en" 表示英文。 */
  lang: "zh-Hans",
  /** @custom — IANA 时区字符串，用于日期格式化。 */
  timezone: "Asia/Shanghai",

  // ---- 主题 ----

  theme: {
    /**
     * @custom — 默认色彩模式。
     * "auto" 跟随用户系统偏好；"light" 或 "dark" 则锁定。
     */
    defaultMode: "auto" as "light" | "dark" | "auto",
    /** @custom — 正文字体风格。"serif" 为衬线体，"sans" 为无衬线体。 */
    fontStyle: "serif" as "serif" | "sans",
  },

  // ---- 头像 ----

  /**
   * @custom — 侧边栏 / 个人介绍区域显示的头像图片路径。
   * 替换为 "avatar.webp" 或 "avatar.png" 即可使用照片。
   */
  avatar: "/images/avatar.svg",

  // ---- 社交链接 ----

  /**
   * @custom — 社交媒体和主页链接。
   * 不需要的条目可注释掉或直接删除。
   */
  social: {
    /** @custom — GitHub 主页地址。 */
    github: "https://github.com/Swayopus",
    bilibili: "https://space.bilibili.com/650379351",
    x: "https://x.com/Swayopus",
    telegram: "https://t.me/Swayopus",
  },

  // ---- 导航栏 ----

  /** @custom — 顶部导航链接。可增删或调整顺序。 */
  nav: [
    { label: "Home", href: "/" },
    { label: "Posts", href: "/posts/" },
    { label: "Notes", href: "/status/" },
    { label: "Tags", href: "/tags/" },
    { label: "Archive", href: "/archive/" },
    { label: "Friends", href: "/friends/" },
    { label: "About", href: "/about/" },
  ],

  // ---- 首页横幅 ----

  banner: {
    /** @custom — 首页 Hero 横幅的大标题。 */
    title: "Crepusopia",
    /**
     * @custom — 横幅区域以打字机循环效果依次显示的文本行。
     * 每行字符串按顺序逐一展示。
     */
    subtitles: [
      "Ars longa, vita brevis.",
      "艺术春秋，人生朝露。",
    ],
    /**
     * @custom — 横幅轮播的背景图片。
     * 将图片文件放入 public/images/banner/ 目录，取消注释并填入文件名即可启用。
     */
    // images: ["banner-1.avif", "banner-2.avif", "banner-3.avif"],
  },

  // ---- 文章列表显示 ----

  postList: {
    /** @custom — 文章列表页面的默认布局。"list" 为列表，"grid" 为网格。 */
    defaultLayout: "list" as "list" | "grid",
    /** @custom — 每页显示的文章数量。 */
    postsPerPage: 10,
    /** @custom — 是否在文章卡片上显示封面图。 */
    showCoverImage: true,
    /** @custom — 是否在文章卡片上显示预计阅读时间。 */
    showReadingTime: true,
  },

  // ---- 功能开关 ----

  /**
   * @custom — 启用或禁用站点的可选功能。
   * 当你集成对应服务后，将开关设为 true。
   */
  features: {
    /** @custom — 评论系统（Waline / Giscus）。配置完成后设为 true。 */
    comments: false,
    /** @custom — 通过 KaTeX 渲染 LaTeX 数学公式。 */
    katex: false,
    /** @custom — Mermaid 图表渲染。 */
    mermaid: false,
    /** @custom — 通过 Pagefind 实现客户端全文搜索。添加后设为 true。 */
    search: true,
    /** @custom — 生成文章 RSS 订阅源。 */
    rss: true,
    /** @custom — 生成 sitemap.xml。 */
    sitemap: true,
  },

  // ---- SEO / 站点验证 ----

  verification: {
    /**
     * @custom — 搜索引擎验证令牌。
     * 取消注释并填入各平台搜索控制台提供的 ID 字符串。
     */
    // google: "",
    // bing: "",
    // baidu: "",
  },
} as const;

/** @required — siteConfig 的推断类型，在整个代码库中使用。 */
export type SiteConfig = typeof siteConfig;
