/**
 * @module utils/slug
 * @description 使用内容 ID 生成 URL，保留嵌套目录并逐段编码。
 */
import { withBase } from "./url.ts";

/** 构建文章完整 URL 路径 */
export function getPostUrl(post: { id: string }): string {
  return withBase(`/posts/${post.id.split("/").map(encodeURIComponent).join("/")}/`);
}
