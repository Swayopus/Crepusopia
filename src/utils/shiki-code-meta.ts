import type { ShikiTransformer, ShikiTransformerContext } from "shiki";

/**
 * 代码围栏元数据，例如：
 * ```ts title="src/app.ts" ln {2,4-5}
 * - title / filename：显示文件名；
 * - {2,4-5}：标记重点行；
 * - ln / lineNumbers / showLineNumbers：显示行号。
 * 解析放在构建期，浏览器只负责样式与复制。
 */
export interface CodeMeta {
  filename?: string;
  highlightLines: number[];
  showLineNumbers: boolean;
}

const TITLE_PATTERN = /(?:title|filename)\s*=\s*(?:"([^"]*)"|'([^']*)')/;
const HIGHLIGHT_PATTERN = /\{([\d,\s-]+)\}/;
const LINE_NUMBER_PATTERN = /(?:^|\s)(?:ln|lineNumbers|showLineNumbers)(?=\s|$)/;

/** 整个围栏最多标记 2000 行，单个范围的展开次数也受此上限约束。 */
const MAX_HIGHLIGHT_LINES = 2000;

export function parseCodeMeta(raw?: string): CodeMeta {
  const source = raw?.trim() ?? "";
  const titleMatch = source.match(TITLE_PATTERN);
  const filename = (titleMatch?.[1] ?? titleMatch?.[2] ?? "").trim() || undefined;

  // 先去掉标题，避免文件名里的 ln 等字样被当成开关。
  const withoutTitle = source.replace(TITLE_PATTERN, " ");
  const highlightMatch = withoutTitle.match(HIGHLIGHT_PATTERN);
  const highlightLines = parseRanges(highlightMatch?.[1]);
  const flags = withoutTitle.replace(HIGHLIGHT_PATTERN, " ");

  return {
    filename,
    highlightLines,
    showLineNumbers: LINE_NUMBER_PATTERN.test(flags),
  };
}

function parseRanges(input?: string): number[] {
  if (!input) return [];
  const lines = new Set<number>();

  for (const part of input.split(",")) {
    const text = part.trim();
    if (!text) continue;
    const [startText, endText] = text.split("-");
    const start = Number(startText);
    const end = Number(endText ?? startText);
    if (!Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(end) || end < start)
      continue;

    // 按有限次数展开，避免极大行号的浮点精度让 line += 1 无法前进。
    const count = Math.min(end - start + 1, MAX_HIGHLIGHT_LINES);
    for (let offset = 0; offset < count && lines.size < MAX_HIGHLIGHT_LINES; offset += 1)
      lines.add(start + offset);
    if (lines.size === MAX_HIGHLIGHT_LINES) break;
  }

  return [...lines].sort((a, b) => a - b);
}

// line 先于 pre 执行；用每个代码块独有的 meta 对象缓存，避免围栏之间串值。
const blockMetadata = new WeakMap<object, CodeMeta>();
function cachedCodeMeta(context: ShikiTransformerContext): CodeMeta {
  let meta = blockMetadata.get(context.meta);
  if (!meta) {
    meta = parseCodeMeta(context.options.meta?.__raw);
    blockMetadata.set(context.meta, meta);
  }
  return meta;
}

export const codeMetaTransformer: ShikiTransformer = {
  name: "crepusopia-code-meta",
  pre(node) {
    const meta = cachedCodeMeta(this);
    if (meta.filename) node.properties["data-filename"] = meta.filename;
    if (meta.showLineNumbers) this.addClassToHast(node, "has-line-numbers");
    if (meta.highlightLines.length > 0) this.addClassToHast(node, "has-highlighted-lines");
  },
  line(node, line) {
    const meta = cachedCodeMeta(this);
    // 行号写成属性，CSS 用 attr() 读取，复制时仍只包含代码文本。
    if (meta.showLineNumbers) node.properties["data-line-number"] = String(line);
    if (meta.highlightLines.includes(line)) this.addClassToHast(node, "line-highlight");
  },
};
