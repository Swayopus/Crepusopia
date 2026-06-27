/**
 * @module utils/slug
 * @description 统一的 URL slug 提取工具。消除项目中重复的 replace 调用。
 */

/** 从 post.id 提取 URL slug："posts/my-post.md" → "my-post" */
export function getPostSlug(post: { id: string }): string {
  return post.id.replace(/^posts\//, "").replace(/\.(md|mdx)$/, "");
}

/** 构建文章完整 URL 路径 */
export function getPostUrl(post: { id: string }): string {
  return `/posts/${getPostSlug(post)}/`;
}
