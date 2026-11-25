/** RSS 保留原来的 XSL 阅读界面，正文改为渲染后的 HTML。 */
import rss from "@astrojs/rss";
import { render } from "astro:content";
import { experimental_AstroContainer } from "astro/container";
import mdxRenderer from "@astrojs/mdx/server.js";
import { load } from "cheerio";
import { siteConfig } from "@/config";
import { getSortedPosts } from "@utils/content";
import { getPostUrl } from "@utils/slug";
import { absoluteUrl, withBase, escapeHtml } from "@utils/url";

export async function GET() {
  const posts = await getSortedPosts();
  const container = await experimental_AstroContainer.create();
  container.addServerRenderer({ renderer: mdxRenderer });
  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      const html = load(await container.renderToString(Content, { partial: true }), {}, false);
      // 订阅器不运行页面脚本；图片和链接使用绝对地址。
      html("script, style, link, iframe").remove();
      html("*").each((_, element) => {
        const node = html(element);
        if ("attribs" in element)
          for (const key of Object.keys(element.attribs))
            if (key.startsWith("on")) node.removeAttr(key);
        for (const key of ["href", "src"]) {
          const value = node.attr(key);
          if (!value) continue;
          if (/^\s*(?:javascript|vbscript):/i.test(value)) node.removeAttr(key);
          else node.attr(key, new URL(value, absoluteUrl(getPostUrl(post))).href);
        }
      });
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.published,
        link: getPostUrl(post),
        content: html.html(),
        categories: post.data.category ? [post.data.category] : [],
        customData:
          post.data.tags
            .map((tag) => `<category domain="tag">${escapeHtml(tag)}</category>`)
            .join("") +
          `<dc:creator>${escapeHtml(post.data.author)}</dc:creator><dc:date>${post.data.published.toISOString()}</dc:date>` +
          (post.data.updated
            ? `<dcterms:modified>${post.data.updated.toISOString()}</dcterms:modified>`
            : ""),
      };
    }),
  );
  const lastBuild = posts.reduce(
    (latest, post) =>
      new Date(Math.max(latest.getTime(), (post.data.updated ?? post.data.published).getTime())),
    new Date(0),
  );
  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: absoluteUrl("/"),
    stylesheet: withBase("/rss.xsl"),
    trailingSlash: true,
    xmlns: {
      atom: "http://www.w3.org/2005/Atom",
      dc: "http://purl.org/dc/elements/1.1/",
      dcterms: "http://purl.org/dc/terms/",
    },
    customData: `<language>${escapeHtml(siteConfig.lang)}</language><lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate><atom:link href="${escapeHtml(absoluteUrl("/rss.xml"))}" rel="self" type="application/rss+xml"/>`,
    items,
  });
}
