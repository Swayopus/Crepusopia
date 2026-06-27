/**
 * @route GET /rss.xml
 * @description RSS 2.0 订阅源。仅包含博客文章（post），不含随记（status）。
 * Data sources: posts collection, siteConfig
 */
import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { siteConfig } from "@/config";

const FEED_AUTHOR = siteConfig.author;

/**
 * XML 字符转义，防止注入。
 * 将 & " ' < > 转换为对应的 XML 实体。
 */
function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * 将 Date 转换为 RFC 822 格式字符串（GMT）。
 * 用于 RSS <lastBuildDate> 等字段。
 */
function toRfc822Date(date: Date): string {
  return date.toUTCString();
}

/**
 * RSS 订阅源 GET 处理函数。
 * 返回包含全部已发布文章的 RSS 2.0 XML。
 */
export async function GET(context: { site: URL }) {
  const site = context.site ?? siteConfig.siteUrl;

  // 仅获取已发布、非隐藏的文章（不含随记）
  const posts = await getCollection("posts", ({ data }) => !data.draft && !data.hidden);
  posts.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());

  // 计算最近构建时间：取所有文章中最晚的更新时间或发布时间
  const lastBuildDate = posts.reduce((latest, post) => {
    const candidate = post.data.updated ?? post.data.published;
    return candidate > latest ? candidate : latest;
  }, new Date(0));

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site,
    stylesheet: "/rss.xsl",
    trailingSlash: false,
    // 扩展命名空间：Atom + Dublin Core
    xmlns: {
      atom: "http://www.w3.org/2005/Atom",
      dc: "http://purl.org/dc/elements/1.1/",
      dcterms: "http://purl.org/dc/terms/",
    },
    customData: [
      `<language>${siteConfig.lang}</language>`,
      `<lastBuildDate>${escapeXml(toRfc822Date(lastBuildDate))}</lastBuildDate>`,
      `<atom:link href="${escapeXml(new URL("/rss.xml", site).toString())}" rel="self" type="application/rss+xml" />`,
    ].join(""),

    // 每篇文章作为一个 RSS item
    items: posts.map((post) => {
      const link = `/posts/${post.id}/`;
      const itemUrl = new URL(link, site).toString();
      const pubDate = post.data.published;
      const updatedDate = post.data.updated ?? pubDate;

      return {
        title: post.data.title,
        description: post.data.description || "",
        pubDate,
        link,
        content: post.body ?? post.data.description,
        author: FEED_AUTHOR,
        commentsUrl: `${itemUrl}#comments`,
        // 分类 = 文章分类 + 所有标签（过滤空值）
        categories: [post.data.category, ...(post.data.tags ?? [])].filter(Boolean),
        // Dublin Core 扩展元素
        customData: [
          `<dc:creator>${escapeXml(FEED_AUTHOR)}</dc:creator>`,
          `<dc:date>${escapeXml(pubDate.toISOString())}</dc:date>`,
          post.data.updated
            ? `<dcterms:modified>${escapeXml(post.data.updated.toISOString())}</dcterms:modified>`
            : "",
        ]
          .filter(Boolean)
          .join(""),
      };
    }),
  });
}
