/**
 * @module utils/headings
 * @description 从原始 markdown 文本中提取 h2、h3、h4 标题，用于生成
 *              文章目录（TOC）。每个标题返回其层级、文本内容和 URL 友好的
 *              slug。
 */

export interface Heading {
  /** 标题层级（2、3 或 4） */
  depth: number;
  /** 标题的纯文本内容 */
  text: string;
  /** 由标题文本生成的 URL 友好 slug */
  slug: string;
}

/**
 * 解析 markdown 正文并返回有序的标题列表（h2 -- h4）。
 *
 * Slug 生成规则：去除非字母数字字符（包括 CJK 范围），
 * 替换为连字符，并去除首尾连字符。
 *
 * @param markdown - 原始 markdown 字符串（通常为 `post.body`）
 * @returns 按文档顺序排列的 Heading 对象数组
 */
export function extractHeadings(markdown: string): Heading[] {
  // 匹配以 2-4 个 '#' 字符开头、后跟空格和文本的行
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const depth = match[1].length;
    const text = match[2].trim();

    // 生成 slug：转小写，将非 [a-z0-9 + CJK] 序列替换为 "-"
    const slug = text
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿㐀-䶿豈-﫿-]+/g, "-")
      .replace(/(^-|-$)/g, "");

    headings.push({ depth, text, slug });
  }

  return headings;
}
