/**
 * 站点全局配置。
 *
 * 这里只保留已经接入页面或构建流程的配置项。
 */

export const siteConfig = {
  // ---- 站点元数据 ----

  /** @custom — 站点部署后的公开 URL。需包含末尾斜杠。 */
  siteUrl: "https://blog.swayopus.com/",
  /** 基础路径前缀。根目录为 "/"；若部署在子目录则为 "/blog/"。 */
  base: "/",
  /** @custom — 站点标题，用于顶栏、浏览器标签页和 SEO。 */
  title: "Crepusopia",
  /** @custom — 副标题，用于首页浏览器标签页。 */
  subtitle: "Writing about code, design, and the spaces between.",
  /** @custom — 默认作者名，用于文章和 RSS 订阅。 */
  author: "Swayopus",
  /** @custom — 站点简短描述，用于 SEO meta 标签、RSS 和社交预览。 */
  description: "A personal blog about technology, engineering, and creative pursuits.",

  // ---- 语言与地区 ----

  /** @custom — HTML lang 属性。"zh-Hans" 表示简体中文；"en" 表示英文。 */
  lang: "zh-Hans",
  /** @custom — IANA 时区字符串，用于日期格式化。 */
  timezone: "Asia/Shanghai",

  // ---- 主题 ----

  theme: {
    /**
     * @custom — 默认色彩模式。
     * "auto" 跟随用户系统偏好；"light" 或 "dark" 指定初始模式。
     * 用户通过按钮选择的主题优先于此默认值。
     */
    defaultMode: "auto" as "light" | "dark" | "auto",
  },

  // ---- 头像 ----

  /**
   * @custom — 侧边栏 / 个人介绍区域显示的头像图片路径。
   * 替换为 "avatar.webp" 或 "avatar.png" 即可使用照片。
   */
  avatar: "/images/avatar.svg",

  // ---- 联系方式与社交链接 ----

  /** @custom — 公开联系邮箱，由页脚、关于页、友链申请和隐私政策共用。 */
  email: "merrick.jun.ouyang@foxmail.com",

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

  /** @custom — 侧栏导航链接。可增删或调整顺序。 */
  nav: [
    { label: "Home", href: "/" },
    { label: "Posts", href: "/posts/" },
    { label: "Notes", href: "/status/" },
    { label: "Tags", href: "/tags/" },
    { label: "Archive", href: "/archive/" },
    { label: "Friends", href: "/friends/" },
    { label: "About", href: "/about/" },
  ],

  // ---- 首页侧栏字幕 ----

  banner: {
    /**
     * @custom — 首页侧栏的打字机文本，依次显示后停留。
     */
    subtitles: ["Ars longa, vita brevis.", "艺术春秋，人生朝露。"],
  },

  // ---- 每日一言 ----

  hitokoto: {
    /** 官方分类：d 文学、h 影视、i 诗词、k 哲学；请求和缓存校验共用此列表。 */
    categories: ["d", "h", "i", "k"],
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
   * 字体由 src/styles/font.css 注册，src/styles/global.css 指定用途。
   */
  features: {
    /** @custom — 通过 KaTeX 渲染 LaTeX 数学公式。 */
    katex: true,
    /** @custom — 显示 Pagefind 客户端全文搜索入口。 */
    search: true,
    /** @custom — 显示 RSS 订阅入口；订阅源由 rss.xml.ts 生成。 */
    rss: true,
    /** @custom — 生成 sitemap.xml。 */
    sitemap: true,
  },
} as const;
