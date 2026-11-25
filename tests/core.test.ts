import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createMarkdownProcessor, unified } from "@astrojs/markdown-remark";
import { compile as compileMdx } from "@mdx-js/mdx";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/contrib/mhchem";
import { load } from "cheerio";
import remarkCallouts, { remarkCalloutDirectives } from "../src/utils/remark-callouts.ts";
import { rehypeBaseUrls, rehypeFigures, rehypeTableScroll } from "../src/utils/rehype-content.ts";
import { parseCodeMeta, codeMetaTransformer } from "../src/utils/shiki-code-meta.ts";
import { codeToHtml } from "shiki";
import { isPublished, sortPosts } from "../src/utils/publication.ts";
import { withBase, tagUrl, categoryKey, escapeJson } from "../src/utils/url.ts";
import { getPostUrl } from "../src/utils/slug.ts";
import { getReadingStats } from "../src/utils/reading-time.ts";
import { dateParts } from "../src/utils/date.ts";
import { validateSlug, createPost } from "../scripts/new-post.ts";

test("路径保留嵌套目录，正确处理 base 和特殊字符", () => {
  assert.equal(withBase("/posts/", "/blog/"), "/blog/posts/");
  assert.equal(withBase("/blog/posts/", "/blog/"), "/blog/posts/");
  assert.equal(withBase("https://example.com/a", "/blog/"), "https://example.com/a");
  assert.equal(
    getPostUrl({ id: "posts/中文 & 笔记" }),
    "/posts/posts/%E4%B8%AD%E6%96%87%20%26%20%E7%AC%94%E8%AE%B0/",
  );
  assert.equal(
    new URL(tagUrl("C++ & C#"), "https://example.com").searchParams.get("tag"),
    "C++ & C#",
  );
  assert.equal(categoryKey(" ASTRO "), "astro");
  assert.equal(categoryKey(" E\u0301 "), categoryKey("é"));
});

test("草稿和隐藏内容统一排除；置顶不污染时间排序", () => {
  assert.equal(isPublished({ data: { draft: true } }), false);
  assert.equal(isPublished({ data: { hidden: true } }), false);
  assert.equal(isPublished({ data: {} }), true);
  const posts = [
    { id: "old", data: { published: new Date("2020-01-01"), pinned: true } },
    { id: "new", data: { published: new Date("2026-01-01") } },
  ];
  assert.deepEqual(
    sortPosts(posts).map((post) => post.id),
    ["new", "old"],
  );
  assert.deepEqual(
    sortPosts(posts, true).map((post) => post.id),
    ["old", "new"],
  );
  assert.equal(posts[0]!.id, "old");
});

test("JSON-LD 无法用闭合 script 标签逃出容器", () => {
  const input = { title: '</script><script>alert("x")</script>' };
  assert.ok(!escapeJson(input).includes("<"));
  assert.deepEqual(JSON.parse(escapeJson(input)), input);
});

test("字数不会同时计算代码单词和代码行，链接地址不计字数", () => {
  assert.equal(
    getReadingStats("中文 hello world\n\n```ts\nconst many words here = 1;\nreturn value;\n```\n")
      .words,
    6,
  );
  assert.equal(getReadingStats("[hello](https://example.com/extra/words)").words, 1);
  assert.equal(getReadingStats("").minutes, 0);
});

test("日期按站点时区跨年，与构建机器时区无关", () => {
  assert.deepEqual(dateParts(new Date("2025-12-31T18:00:00Z")), { year: 2026, month: 1, day: 1 });
});

test("新文章拒绝目录穿越和 Windows 保留名", () => {
  for (const slug of ["../escape", "a/b", "a\\b", "CON", "aux.txt", "trailing.", ""])
    assert.throws(() => validateSlug(slug));
  assert.equal(validateSlug("中文-astro"), "中文-astro");
});

test("新文章原子创建，第二次执行不能覆盖正文", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "crepusopia-test-"));
  const file = path.join(directory, "example.md");
  try {
    await createPost(
      { title: '示例 "标题"', slug: "example", tags: "astro,astro,中文" },
      directory,
    );
    const original = await readFile(file, "utf8");
    await assert.rejects(createPost({ title: "覆盖", slug: "example" }, directory), {
      code: "EEXIST",
    });
    assert.equal(await readFile(file, "utf8"), original);
    assert.match(original, /tags: \["astro","中文"\]/);
  } finally {
    await unlink(file);
    await rmdir(directory);
  }
});

// 与生产配置相同的解析器，验证 AST 处理后的 HTML 而非实现内部细节。
const processor = await createMarkdownProcessor({
  ...unified({
    remarkPlugins: [remarkDirective, remarkCalloutDirectives, remarkCallouts, remarkMath],
    rehypePlugins: [rehypeKatex, rehypeTableScroll, rehypeFigures],
    remarkRehype: { footnoteLabel: "注释", footnoteBackLabel: "返回正文" },
  }).options,
});
test("嵌套 Callout 的全部正文在折叠容器中，行内格式和链接保留", async () => {
  const result = await processor.render(
    "> [!question]- **标题**\n> 正文有 **强调** 和 [链接](https://example.com)。\n>\n> - 列表\n>\n> > [!tip]- 内层\n> > 内层正文\n",
  );
  const $ = load(result.code);
  const outer = $('blockquote[data-callout="question"]');
  assert.equal(outer.children(".callout-title").find("strong").text(), "标题");
  assert.equal(outer.children(".callout-content").find('blockquote[data-callout="tip"]').length, 1);
  assert.equal(outer.children("ul, p, blockquote").length, 0);
  assert.equal(outer.children(".callout-content").find("strong").text(), "强调");
  assert.equal(outer.attr("data-expanded"), "false");
  assert.equal(outer.find(".callout-title-icon svg").length, 2);
});

test("容器指令和重复标题生成有效 HTML 与唯一锚点", async () => {
  const result = await processor.render(
    ":::note\n正文\n:::\n\n## 重复标题\n\n## 重复标题\n\n```md\n## 不是真标题\n```\n",
  );
  const $ = load(result.code);
  assert.equal($(".callout.callout-note").length, 1);
  assert.deepEqual(
    result.metadata.headings.map((heading) => heading.slug),
    ["重复标题", "重复标题-1"],
  );
});

test("公式及 mhchem 使用相同 KaTeX 实例，不输出渲染错误", async () => {
  const result = await processor.render(
    String.raw`行内 $e^{i\pi}+1=0$。` + "\n\n$$\n" + String.raw`\ce{2H2 + O2 -> 2H2O}` + "\n$$\n",
  );
  const $ = load(result.code);
  assert.equal($(".katex").length, 2);
  assert.equal($(".katex-error").length, 0);
});

test("宽表格包进可聚焦滚动容器，图片转为带图注的放大按钮", async () => {
  const result = await processor.render(
    "| 字段 | 说明 |\n| --- | --- |\n| title | 标题 |\n\n![落日余晖](/images/demo/sunset.svg)\n",
  );
  const $ = load(result.code);

  assert.equal($("div.table-scroll > table").length, 1);
  assert.equal($("div.table-scroll").attr("tabindex"), "0");
  assert.equal($("div.table-scroll").attr("role"), "region");
  assert.equal($("div.table-scroll").attr("aria-label"), "表格：字段");

  assert.equal($("figure.prose-figure").length, 1);
  assert.equal($("figure.prose-figure figcaption").text(), "落日余晖");
  assert.equal($("button.prose-figure-zoom > img").length, 1);
  assert.equal($("figure.prose-figure img").attr("loading"), "lazy");
  assert.equal($("figure.prose-figure img").attr("alt"), "落日余晖");
});

test("MDX 组件和片段中的表格与独立图片也会增强，带链接的图片保留", async () => {
  const processor = unified({
    rehypePlugins: [rehypeTableScroll, rehypeFigures],
  });
  assert.ok(processor.createMdxRenderer);
  const renderer = await processor.createMdxRenderer(
    { syntaxHighlight: false },
    { optimize: false },
  );
  const source = [
    '<Tab label="例子">',
    "",
    "<>",
    "",
    "| 字段 | 说明 |",
    "| --- | --- |",
    "| title | 标题 |",
    "",
    "![嵌套图片](/images/demo/sunset.svg)",
    "",
    "[![链接图片](/images/demo/sunset.svg)](/posts/)",
    "",
    "</>",
    "",
    "</Tab>",
  ].join("\n");
  const { code } = await renderer.process(source, "nested-content.mdx", {});
  assert.match(code, /class: "table-scroll"/);
  assert.match(code, /"aria-label": "表格：字段"/);
  assert.equal(code.match(/class: "prose-figure"/g)?.length, 1);
  assert.match(code, /class: "prose-figure-zoom"/);
  assert.match(code, /_components\.figcaption, \{\s*children: "嵌套图片"/);
  assert.match(code, /_components\.a, \{\s*href: "\/posts\/",\s*children: _jsx\(_components\.img/);
});

test("正文站内链接与图片补上部署前缀", async () => {
  const prefixed = await createMarkdownProcessor({
    ...unified({ rehypePlugins: [[rehypeBaseUrls, "/blog/"]] }).options,
  });
  const { code } = await prefixed.render(
    "[文章](/posts/a/) [锚点](#x) [外链](https://example.com/) [协议相对](//cdn.example.com/a) ![图](/images/a.png) ![相对](a.png)\n",
  );
  const $ = load(code);
  assert.equal($('a[href="/blog/posts/a/"]').length, 1);
  assert.equal($('a[href="#x"]').length, 1);
  assert.equal($('a[href="https://example.com/"]').length, 1);
  assert.equal($('a[href="//cdn.example.com/a"]').length, 1);
  assert.equal($('img[src="/blog/images/a.png"]').length, 1);
  assert.equal($('img[src="a.png"]').length, 1);
});

test("MDX 组件与片段中的 Markdown、原生 JSX 链接和图片补上部署前缀", async () => {
  const source = [
    '<Tabs><Tab label="图片">',
    "",
    "![嵌套图片](/images/nested.svg)",
    "",
    "[嵌套链接](/posts/nested/)",
    "",
    '<img src="/images/flow.svg" />',
    "",
    '行内 <a href="/posts/inline/">链接</a> 与 <img src="/images/inline.svg" />。',
    "",
    "<>",
    "",
    "![片段图片](/images/fragment.svg)",
    "",
    "</>",
    "",
    "</Tab></Tabs>",
  ].join("\n");
  const code = String(await compileMdx(source, { rehypePlugins: [[rehypeBaseUrls, "/blog/"]] }));
  for (const path of [
    "/images/nested.svg",
    "/posts/nested/",
    "/images/flow.svg",
    "/posts/inline/",
    "/images/inline.svg",
    "/images/fragment.svg",
  ]) {
    // 检查真实编译结果中的 URL，覆盖原先被 JSX 父节点截断的遍历。
    assert.ok(code.includes(JSON.stringify(`/blog${path}`)), code);
    assert.ok(!code.includes(JSON.stringify(path)), code);
  }
});

test("MDX 前缀处理保留外链、相对路径、表达式和自定义组件属性", async () => {
  const source = [
    '<a href="#note">锚点</a>',
    '<a href="https://example.com/">外链</a>',
    '<a href="//cdn.example.com/a">协议相对</a>',
    '<img src="relative.svg" />',
    '<img src="data:image/png;base64,AA==" />',
    '<img src={"/images/expression.svg"} />',
    '<img src={withBase("/images/from-code.svg")} />',
    "<img {...imageProps} />",
    '<Widget src="/images/component.svg" href="/posts/component/" />',
    '<img src="/blog/images/prefixed.svg" />',
  ].join("\n\n");
  for (const base of ["/", "/blog/"]) {
    const code = String(await compileMdx(source, { rehypePlugins: [[rehypeBaseUrls, base]] }));
    for (const value of [
      "#note",
      "https://example.com/",
      "//cdn.example.com/a",
      "relative.svg",
      "data:image/png;base64,AA==",
      "/images/expression.svg",
      "/images/from-code.svg",
      "/images/component.svg",
      "/posts/component/",
      "/blog/images/prefixed.svg",
    ])
      assert.ok(code.includes(JSON.stringify(value)), code);
    assert.ok(code.includes("...imageProps"), code);
    assert.ok(!code.includes("/blog/blog/"), code);
  }
});

test("链接图片保持原样，不劫持跳转", async () => {
  const result = await processor.render("[![封面](/images/cover.svg)](https://example.com)\n");
  const $ = load(result.code);
  assert.equal($("figure.prose-figure").length, 0);
  assert.equal($(".prose-figure-zoom").length, 0);
  assert.equal($('a[href="https://example.com"] img').length, 1);
});

test("脚注生成文末注释区，标签为中文且回跳链接存在", async () => {
  const result = await processor.render("正文[^1]\n\n[^1]: 注释内容\n");
  const $ = load(result.code);

  assert.equal($("section[data-footnotes]").length, 1);
  assert.equal($("section[data-footnotes] h2").text(), "注释");
  assert.equal($("a[data-footnote-ref]").length, 1);
  assert.equal($("a[data-footnote-backref]").length, 1);
  // 目录层需要过滤这个自动生成的标题，页面组件按 slug 处理。
  assert.ok(result.metadata.headings.some((heading) => heading.slug === "footnote-label"));
});

test("代码围栏元数据支持文件名、行号开关和重点行范围", () => {
  assert.deepEqual(parseCodeMeta('title="src/app.ts" ln {2,4-5}'), {
    filename: "src/app.ts",
    highlightLines: [2, 4, 5],
    showLineNumbers: true,
  });
  assert.equal(parseCodeMeta("filename='main.py'").filename, "main.py");
  assert.equal(parseCodeMeta('title="lineNumbers.ts"').showLineNumbers, false);
  assert.deepEqual(parseCodeMeta("{3}").highlightLines, [3]);
  assert.deepEqual(parseCodeMeta("").highlightLines, []);
  assert.equal(parseCodeMeta("").filename, undefined);
});

test("代码元数据在真实 Shiki 钩子顺序下生效，多个围栏互不污染", async () => {
  const options = { lang: "text", theme: "github-light", transformers: [codeMetaTransformer] };
  const first = load(
    await codeToHtml("first\nsecond", { ...options, meta: { __raw: 'title="a.txt" ln {2}' } }),
  );
  assert.equal(first("pre").attr("data-filename"), "a.txt");
  assert.equal(first(".has-line-numbers .line[data-line-number]").length, 2);
  assert.equal(first(".line-highlight").text(), "second");
  const next = load(await codeToHtml("plain", options));
  assert.equal(next("pre").attr("data-filename"), undefined);
  assert.equal(next(".line-highlight, [data-line-number]").length, 0);
});

test("重点行的极大编号安全结束，跨范围总量最多 2000 行", () => {
  // 独立进程兜住同步死循环：即使以后回归，也能超时失败而非挂住整套测试。
  const parserUrl = new URL("../src/utils/shiki-code-meta.ts", import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import assert from "node:assert/strict";
       import { parseCodeMeta } from ${JSON.stringify(parserUrl)};
       assert.deepEqual(parseCodeMeta("{100000000000000000000}").highlightLines, []);
       assert.deepEqual(parseCodeMeta("{9007199254740992}").highlightLines, []);
       assert.deepEqual(parseCodeMeta("{9007199254740991}").highlightLines, [9007199254740991]);
       assert.equal(parseCodeMeta("{1-9007199254740991}").highlightLines.length, 2000);
       const lines = parseCodeMeta("{1-1500,3000-4500}").highlightLines;
       assert.equal(lines.length, 2000);
       assert.equal(lines.at(-1), 3499);`,
    ],
    { encoding: "utf8", timeout: 3000 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
