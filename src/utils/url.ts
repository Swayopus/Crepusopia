import { siteConfig } from "../config.ts";

/** 统一部署前缀；不更改页面入口或路由语义，只处理 URL 的边界和编码。 */
export function withBase(path: string, base: string = siteConfig.base): string {
  if (/^(?:https?:|mailto:|tel:|#|\/\/)/i.test(path)) return path;
  const prefix = `/${base.replace(/^\/+|\/+$/g, "")}`.replace(/\/$/, "");
  if (prefix && (path === prefix || path.startsWith(prefix + "/"))) return path;
  return `${prefix}/${path.replace(/^\/+/, "")}`;
}
export const absoluteUrl = (path: string) => new URL(withBase(path), siteConfig.siteUrl).href;
export const categoryKey = (name: string) => name.trim().normalize("NFC").toLowerCase();
export const categoryUrl = (name: string) =>
  withBase(`/categories/${encodeURIComponent(categoryKey(name))}/`);
export const tagUrl = (name: string) => withBase(`/tags/?tag=${encodeURIComponent(name)}`);
export const escapeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
