/** 交互式或通过命令行参数创建文章；由 Node.js 直接运行 TypeScript。 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import { siteConfig } from "../src/config.ts";

function slugify(title: string): string {
  return title
    .trim()
    .replace(/[/\\?%*:|"<>\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** 明确的单文件名校验，防止 ../ 写出文章目录及 Windows 保留文件名。 */
export function validateSlug(slug: string): string {
  if (
    !slug ||
    slug === "." ||
    slug === ".." ||
    /[/\\?%*:|"<>\x00-\x1f]/.test(slug) ||
    /[. ]$/.test(slug) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(slug)
  ) {
    throw new Error("slug 必须是有效的单个文件名，不能包含路径或 Windows 保留名称。");
  }
  return slug;
}

export async function createPost(
  options: {
    title: string;
    slug?: string;
    desc?: string;
    tags?: string;
    category?: string;
    pinned?: string;
  },
  directory = path.resolve("src/content/posts"),
) {
  const title = options.title.trim();
  if (!title) throw new Error("Title is required.");
  const slug = validateSlug(options.slug ?? (slugify(title) || `post-${Date.now()}`));
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: siteConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const tags = [
    ...new Set(
      (options.tags ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
  const content = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(options.desc ?? "")}`,
    `published: ${date}`,
    `tags: ${JSON.stringify(tags)}`,
    `category: ${JSON.stringify(options.category ?? "")}`,
    ...(options.pinned === "true" ? ["pinned: true"] : []),
    "draft: false",
    "---",
    "",
    `## ${title.replace(/[\r\n]/g, " ")}`,
    "",
  ].join("\n");
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${slug}.md`);
  // wx 将“检查+写入”合成原子操作；重复执行不会覆盖已有文章。
  await writeFile(file, content, { encoding: "utf8", flag: "wx" });
  return file;
}

async function main() {
  const args: Record<string, string> = {};
  const supported = new Set(["title", "slug", "desc", "tags", "category", "pinned"]);
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]?.replace(/^--/, "");
    if (!key || !supported.has(key) || !argv[index]!.startsWith("--"))
      throw new Error(`未知参数: ${argv[index]}`);
    const next = argv[index + 1];
    if (key === "pinned" && (!next || next.startsWith("--"))) args[key] = "true";
    else {
      if (!next || next.startsWith("--")) throw new Error(`--${key} 缺少值`);
      args[key] = next;
      index++;
    }
  }
  const rl =
    process.stdin.isTTY && process.stdout.isTTY
      ? createInterface({ input: process.stdin, output: process.stdout })
      : null;
  try {
    for (const [key, label] of [
      ["title", "Title"],
      ["desc", "Description"],
      ["tags", "Tags (逗号分隔)"],
      ["category", "Category"],
    ]) {
      if (args[key!] === undefined && rl) args[key!] = (await rl.question(`${label}: `)).trim();
    }
  } finally {
    rl?.close();
  }
  console.log(`已创建: ${await createPost({ ...args, title: args.title ?? "" })}`);
}

// 导入纯函数做回归测试时不启动交互，也不写入真实内容目录。
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
