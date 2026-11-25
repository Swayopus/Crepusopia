/**
 * @module utils/reading-time
 * @description 混合 CJK/拉丁文本的字数统计和阅读时间估算。
 *
 *              策略：
 *                - CJK 字符（汉字、日文汉字等）每个计为 1 个词。
 *                - 拉丁/英文词按空白字符分割计数。
 *                - 代码块行数粗略估算（每行约 1 个词）。
 *
 *              阅读速度：约 250 词/分钟（CJK 约 300 + 拉丁约 200 的混合平均值）。
 */

export interface ReadingStats {
  /** 总词数（CJK + 拉丁 + 代码行） */
  words: number;
  /** 预估阅读时间，非空文本最少 1 分钟；空文本为 0。 */
  minutes: number;
}

/**
 * 计算一段文本的词数和阅读分钟数。
 *
 * @param text - 文章的纯文本（或 markdown）正文
 */
export function getReadingStats(text: string): ReadingStats {
  if (!text) return { words: 0, minutes: 0 };
  let codeLines = 0;
  // 先移除代码，避免既统计代码单词又统计代码行；阅读时间仍沿用原来的显示方式。
  text = text
    .replace(/^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^\1\s*$/gm, (_, _fence: string, code: string) => {
      codeLines += code.trimEnd() ? code.trimEnd().split("\n").length : 0;
      return "";
    })
    .replace(/!?(?:\[([^\]]+)\])\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "");

  // 统计 CJK 字符（Unicode 范围：CJK 统一表意文字、扩展 A、兼容区）
  const cjkChars = (text.match(/[一-鿿㐀-䶿豈-﫿]/g) || []).length;

  // 去除 CJK 字符后统计拉丁单词数
  const latinText = text.replace(/[一-鿿㐀-䶿豈-﫿]/g, " ");
  const latinWords = latinText
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[a-zA-Z0-9]/.test(w)).length;

  const totalWords = cjkChars + latinWords + codeLines;

  // 最少 1 分钟；混合阅读速度约 250 词/分钟
  const minutes = Math.max(1, Math.ceil(totalWords / 250));

  return { words: totalWords, minutes };
}

/**
 * 将 ReadingStats 对象格式化为人类可读的中文字符串。
 *
 * 示例输出：
 *   - "约 42 字 · 不到 1 分钟"   （少于 100 字）
 *   - "约 1,200 字 · 预计 5 分钟"（100 字及以上）
 */
export function formatReadingStats(stats: ReadingStats): string {
  if (stats.words < 100) {
    return `约 ${stats.words} 字 · 不到 1 分钟`;
  }
  return `约 ${stats.words.toLocaleString()} 字 · 预计 ${stats.minutes} 分钟`;
}
