/**
 * @module utils/content
 * @description 查询 Astro "posts" 内容集合的工具函数。
 *              包括发布筛选、排序、置顶及分类/标签汇总。
 */
import { getCollection, type CollectionEntry } from "astro:content";
import { isPublished, sortPosts } from "./publication";
import { categoryKey } from "./url";

/** Astro 内容集合条目的便捷类型别名 */
export type Post = CollectionEntry<"posts">;

/**
 * 获取所有已发布文章，排除 draft / hidden 后按发布日期降序排列。
 */
export async function getSortedPosts(): Promise<Post[]> {
  return sortPosts(await getCollection("posts", isPublished));
}

/**
 * 获取文章列表：置顶文章优先，然后按发布日期降序排列。
 * 在置顶文章内部，新文章排在前面。
 */
export async function getPinnedAndSorted(): Promise<Post[]> {
  return sortPosts(await getCollection("posts", isPublished), true);
}

/**
 * 提取所有不重复的分类及其文章数量。
 * 按文章数量降序排列（最常用的分类排在前面）。
 */
export async function getCategories(): Promise<{ name: string; count: number }[]> {
  const posts = await getSortedPosts();
  const map = new Map<string, { name: string; count: number }>();

  posts.forEach((p) => {
    if (p.data.category) {
      const key = categoryKey(p.data.category);
      const entry = map.get(key) ?? { name: p.data.category, count: 0 };
      entry.count++;
      map.set(key, entry);
    }
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/**
 * 提取所有不重复的标签及其文章数量。
 * 按文章数量降序排列（最常用的标签排在前面）。
 */
export async function getTags(): Promise<{ name: string; count: number }[]> {
  const posts = await getSortedPosts();
  const map = new Map<string, { name: string; count: number }>();

  posts.forEach((p) => {
    const seen = new Set<string>();
    p.data.tags.forEach((tag) => {
      const key = categoryKey(tag);
      if (seen.has(key)) return;
      seen.add(key);
      const entry = map.get(key) ?? { name: tag, count: 0 };
      entry.count++;
      map.set(key, entry);
    });
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
