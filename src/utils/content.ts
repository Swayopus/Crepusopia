/**
 * @module utils/content
 * @description 查询 Astro "posts" 内容集合的工具函数。
 *              包括排序、置顶、分类/标签提取，以及从原始 markdown
 *              正文中提取文章简介。
 */
import { getCollection, type CollectionEntry } from "astro:content";

/** Astro 内容集合条目的便捷类型别名 */
export type PostData = CollectionEntry<"posts">["data"];
export type Post = CollectionEntry<"posts">;

/**
 * 获取所有非草稿文章，按发布日期降序排列（最新在前）。
 * 草稿（frontmatter 中 `draft: true`）将被排除。
 */
export async function getSortedPosts(): Promise<Post[]> {
  const posts = await getCollection("posts", (p) => !p.data.draft && !p.data.hidden);
  return posts.sort(
    (a, b) => b.data.published.getTime() - a.data.published.getTime()
  );
}

/**
 * 获取文章列表：置顶文章优先，然后按发布日期降序排列。
 * 在置顶文章内部，新文章排在前面。
 */
export async function getPinnedAndSorted(): Promise<Post[]> {
  const posts = await getSortedPosts();
  return posts.sort((a, b) => {
    // 置顶文章排在未置顶文章之上
    if (a.data.pinned && !b.data.pinned) return -1;
    if (!a.data.pinned && b.data.pinned) return 1;
    // 两篇都是置顶文章：按日期排序
    if (a.data.pinned && b.data.pinned) {
      return b.data.published.getTime() - a.data.published.getTime();
    }
    // 非置顶文章保持现有排序
    return 0;
  });
}

/**
 * 提取所有不重复的分类及其文章数量。
 * 按文章数量降序排列（最常用的分类排在前面）。
 */
export async function getCategories(): Promise<
  { name: string; count: number }[]
> {
  const posts = await getSortedPosts();
  const map = new Map<string, number>();

  posts.forEach((p) => {
    if (p.data.category) {
      map.set(p.data.category, (map.get(p.data.category) || 0) + 1);
    }
  });

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 提取所有不重复的标签及其文章数量。
 * 按文章数量降序排列（最常用的标签排在前面）。
 */
export async function getTags(): Promise<{ name: string; count: number }[]> {
  const posts = await getSortedPosts();
  const map = new Map<string, number>();

  posts.forEach((p) => {
    p.data.tags.forEach((tag) => {
      map.set(tag, (map.get(tag) || 0) + 1);
    });
  });

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 从原始 markdown 正文中提取简短简介。
 * 先去除 frontmatter 块，然后抓取第一个非 HTML 标签段落（最长 180 字符）。
 * 如果没有找到合适的段落，回退为空字符串。
 */
export function extractDescription(body: string): string {
  // 去除 YAML frontmatter 块（如果存在）
  const content = body.replace(/^---[\s\S]*?---\n?/, "");

  // 匹配不以 HTML 标签开头的第一行
  const match = content.match(/^(?!<[a-zA-Z])(.+)$/m);
  return match ? match[1].trim().slice(0, 180) + "..." : "";
}
