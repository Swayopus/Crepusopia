/**
 * @module types
 * @description 全局类型定义。Post 从 content.ts 导出以保持单一来源，
 *              SiteConfig 由 config.ts 的 typeof siteConfig 自动推导。
 */

import type { CollectionEntry } from "astro:content";

/** 博客文章的类型别名 */
export type Post = CollectionEntry<"posts">;
