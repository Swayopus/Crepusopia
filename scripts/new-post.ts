#!/usr/bin/env npx tsx
/**
 * 快速创建新博客文章，自动生成完整的 frontmatter。
 *
 * 交互模式（无参数）：
 *   npm run new-post
 *
 * 命令行模式：
 *   npm run new-post -- --title "我的文章" --tags "astro,css" --category "前端"
 */

import { writeFile, access, mkdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";

/** 文章存放目录 */
const POSTS_DIR = path.resolve("src/content/posts");

/** 数字补零到两位 */
function pad(n: number) { return String(n).padStart(2, "0"); }

/** 获取今天的日期字符串，格式 YYYY-MM-DD */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 将标题转为 URL 友好的 slug
 * - 去除特殊字符
 * - 空格替换为连字符
 * - 转小写
 */
function slugify(title: string) {
  return title
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * 询问用户输入并返回答案（交互模式）
 * @param rl - readline 接口实例
 * @param prompt - 提示文字
 * @param def - 默认值
 */
async function ask(rl: any, prompt: string, def = ""): Promise<string> {
  const suffix = def ? ` (${def})` : "";
  const answer = await rl.question(`${prompt}${suffix}: `);
  return answer.trim() || def;
}

async function main() {
  const argv = process.argv.slice(2);
  const isTTY = process.stdin.isTTY && process.stdout.isTTY;
  const rl = isTTY ? createInterface({ input: process.stdin, output: process.stdout }) : null;

  // 解析 --key value 命令行参数对
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      args[key] = next && !next.startsWith("--") ? next : "true";
      if (next && !next.startsWith("--")) i++;
    }
  }

  // 获取标题（命令行参数优先，否则交互输入）
  const title = args.title || (rl ? await ask(rl, "Title") : "");
  if (!title) { console.error("Title is required."); process.exit(1); }

  const slug = args.slug || slugify(title) || `post-${Date.now()}`;
  const description = args.desc || (rl ? await ask(rl, "Description", "") : "");
  const tagsRaw = args.tags || (rl ? await ask(rl, "Tags (逗号分隔)", "") : "");
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];
  const category = args.category || (rl ? await ask(rl, "Category", "") : "");
  const pinned = args.pinned === "true";

  rl?.close();

  // 构建包含完整 frontmatter 的 Markdown 内容
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `published: ${today()}`,
    `tags: [${tags.map(t => JSON.stringify(t)).join(", ")}]`,
    `category: ${JSON.stringify(category)}`,
    ...(pinned ? [`pinned: true`] : []),
    `draft: false`,
    "---",
    "",
    `## ${title}`,
    "",
  ].join("\n");

  const filePath = path.join(POSTS_DIR, `${slug}.md`);

  // 确保目录存在，检查文件是否已存在以避免覆盖
  await mkdir(POSTS_DIR, { recursive: true });
  try { await access(filePath); console.error(`文件已存在: ${filePath}`); process.exit(1); } catch {}

  await writeFile(filePath, frontmatter, "utf-8");
  console.log(`已创建: ${filePath}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
