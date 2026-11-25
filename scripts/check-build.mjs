/** 检查实际发布文件，避免“能构建”却存在坏链接、目录或公式错误。 */
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { load } from "cheerio";
import { HOME_FONT } from "../src/scripts/font-loading.ts";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(path.join(directory, entry.name))
          : path.join(directory, entry.name),
      ),
    )
  ).flat();
}
const files = await walk(dist);
const pages = files.filter((file) => file.endsWith(".html"));
const documents = new Map();
for (const file of pages) documents.set(file, load(await readFile(file, "utf8")));
const home = documents.get(path.join(dist, "index.html"));
assert.ok(home, "缺少首页");
assert.ok(
  home("style[data-fonts-critical]").text().includes(`font-family:"${HOME_FONT}"`),
  "首页合并字体需使用独立家族，避免动态文字预加载时匹配完整字库的重叠分片",
);
const site = new URL(home('link[rel="canonical"]').attr("href"));
const base = site.pathname;
let links = 0;
async function localTarget(raw, from) {
  if (!raw || /^(mailto:|tel:|data:|blob:)/i.test(raw)) return;
  const url = new URL(raw, from);
  if (url.origin !== site.origin) return;
  assert.ok(url.pathname.startsWith(base), `链接缺少 base: ${url}`);
  const relative = decodeURIComponent(url.pathname.slice(base.length));
  let file = path.resolve(dist, relative || ".");
  assert.ok(file === dist || file.startsWith(dist + path.sep), `路径越界: ${url}`);
  const info = await stat(file).catch(() => null);
  if (info?.isDirectory()) file = path.join(file, "index.html");
  assert.ok(files.includes(file), `链接目标不存在: ${url}`);
  if (url.hash && documents.has(file)) {
    const id = decodeURIComponent(url.hash.slice(1));
    assert.ok(
      documents
        .get(file)("[id]")
        .toArray()
        .some((element) => element.attribs.id === id),
      `锚点不存在: ${url}`,
    );
  }
  links++;
}
for (const [file, $] of documents) {
  assert.equal($("main h1").length, 1, `${file}: 主内容应有一个 h1`);
  const ids = $("[id]")
    .toArray()
    .map((element) => element.attribs.id);
  assert.equal(new Set(ids).size, ids.length, `${file}: 重复 id`);
  const canonical = $('link[rel="canonical"]').attr("href");
  assert.ok(canonical, `${file}: 缺少 canonical`);
  assert.equal($(".katex-error").length, 0, `${file}: 公式渲染错误`);
  if ($("#tag-cloud").length) {
    const status = $('#tag-result-status[role="status"][aria-atomic="true"]');
    assert.equal(status.length, 1, `${file}: 缺少标签结果播报区`);
    assert.equal(
      status.parents('.hidden, [hidden], [aria-hidden="true"]').length,
      0,
      `${file}: 标签播报区不能随结果一起隐藏`,
    );
  }
  const rawLinks = $("a[href], link[href], img[src], script[src]")
    .toArray()
    .map((element) => element.attribs.href ?? element.attribs.src);
  for (const raw of rawLinks) await localTarget(raw, canonical);
  for (const element of $("img[srcset]").toArray())
    for (const candidate of element.attribs.srcset.split(","))
      await localTarget(candidate.trim().split(/\s+/)[0], canonical);
  assert.equal($("meta[name=crepusopia-fonts]").length, 0, `${file}: 字体交付标记未处理`);
  assert.ok(
    $("style[data-fonts-critical]").text().includes("@font-face"),
    `${file}: 缺少初始字体声明`,
  );
  for (const family of ["Corinthia", "Corinthia Name"])
    assert.ok(
      $("style[data-fonts-critical]").text().includes(`font-family:"${family}"`),
      `${file}: 缺少品牌字体的 ${family} 度量别名`,
    );
  const isHome = $ === home;
  const fontConfig = isHome ? 'meta[name="crepusopia-fonts-full"]' : "link[data-fonts-full]";
  const completeFonts = $(fontConfig);
  assert.equal(completeFonts.length, 1, `${file}: 缺少共享完整字库`);
  const fullFontUrl = completeFonts.attr(isHome ? "content" : "href");
  assert.ok(fullFontUrl, `${file}: 缺少完整字库地址`);
  await localTarget(fullFontUrl, canonical);
  if (isHome) {
    assert.equal($("link[data-fonts-full]").length, 0, `${file}: 首页不应提前创建完整映射链接`);
    for (const attribute of ["href", "rel", "data-astro-transition-persist"])
      assert.equal(completeFonts.attr(attribute), undefined, `${file}: 首页完整映射应按需激活`);
  } else {
    assert.equal(completeFonts.attr("media"), "print");
    assert.equal(completeFonts.attr("data-astro-transition-persist"), fullFontUrl);
    assert.match(completeFonts.attr("onload"), /this.onload=null/);
    assert.equal(completeFonts.attr("fetchpriority"), "low", `${file}: 完整字库不能抢占首屏`);
  }
  assert.equal($("link[rel=preload][as=style]").length, 0, `${file}: 不应立即预取完整映射`);
  assert.equal($("link[rel=preload][as=font][crossorigin]").length, 2);
  assert.equal(
    $(`${fontConfig} ~ style[data-fonts-critical]`).length,
    1,
    `${file}: 初始字体声明应位于完整字库链接之后`,
  );
  const noScript = load($("noscript").html() ?? "");
  assert.equal(
    noScript("link[rel=stylesheet]").attr("href"),
    fullFontUrl,
    `${file}: 无 JS 字体回退不符`,
  );
  assert.equal(
    $("link[data-math-styles]").length > 0,
    $(".katex").length > 0,
    `${file}: 公式样式与内容不符`,
  );
  const isArticle = $("article[data-pagefind-body]").length > 0;
  assert.equal($("meta[property='og:type']").attr("content"), isArticle ? "article" : "website");
  for (const [property, field] of [
    ["published_time", "datePublished"],
    ["modified_time", "dateModified"],
  ]) {
    const value = $(`meta[property='article:${property}']`).attr("content");
    if (isArticle) {
      const jsonLd = JSON.parse($("script[type='application/ld+json']").first().html());
      assert.equal(value, jsonLd["@graph"].find((item) => item["@type"] === "BlogPosting")[field]);
    } else assert.equal(value, undefined, `${file}: 普通页面不应携带文章时间`);
  }
  for (const element of $('script[type="application/ld+json"]').toArray())
    JSON.parse($(element).html());
  assert.ok(
    $("#toc-mobile-card[aria-hidden='true']")
      .toArray()
      .every((element) => "inert" in element.attribs),
    `${file}: 隐藏的移动端目录面板必须设置 inert`,
  );
}
assert.ok(!files.includes(path.join(dist, "posts/page/1/index.html")), "不能重复生成文章第 1 页");
assert.equal(
  (
    home("style[data-fonts-critical]")
      .text()
      .match(/@font-face/g) || []
  ).length,
  3,
  "首页应只内联 1 个合并正文子集声明与 2 个品牌别名",
);
const homeFontFiles = files.filter((file) => /lxgw-home-[0-9a-f]+\.woff2$/.test(file));
assert.equal(homeFontFiles.length, 1, "构建产物应包含唯一的首页字体子集");
assert.equal(
  (await readFile(homeFontFiles[0])).subarray(0, 4).toString("ascii"),
  "wOF2",
  "首页字体子集必须是有效的 WOFF2",
);
for (const file of files.filter((file) => file.endsWith(".css"))) {
  const css = await readFile(file, "utf8");
  // 字体变量不能被 Tailwind 误编译为 font-weight；这会使品牌字体静默失效。
  assert.doesNotMatch(
    css,
    /font-weight:\s*var\(--font-(?:title|nav|time|mono|heading)\)/,
    `${file}: 字体工具类缺少 family-name 类型提示`,
  );
  const source = new URL(path.relative(dist, file).replaceAll("\\", "/"), site.href);
  for (const match of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g))
    await localTarget(match[1], source);
}
const articleFiles = pages.filter(
  (file) => documents.get(file)("article[data-pagefind-body]").length,
);
assert.ok(articleFiles.length > 0, "缺少发布文章");
const feed = load(await readFile(path.join(dist, "rss.xml"), "utf8"), { xmlMode: true });
assert.equal(feed("item").length, articleFiles.length, "RSS 篇数应与发布文章一致");
for (const item of feed("item").toArray()) {
  await localTarget(feed(item).find("link").text(), site.href);
  assert.match(feed(item).find("content\\:encoded").text(), /<(p|h2|div)/, "RSS 正文必须是 HTML");
}
await stat(path.join(dist, "pagefind/pagefind.js"));
const index = JSON.parse(await readFile(path.join(dist, "pagefind/pagefind-entry.json"), "utf8"));
assert.equal(
  Object.values(index.languages).reduce((sum, language) => sum + language.page_count, 0),
  articleFiles.length,
);

// XSL 中的字体 URL 不经过 Vite 转换，单独检查根路径和子目录部署。
const stylesheet = new URL("rss.xsl", site);
const xsl = load(await readFile(path.join(dist, "rss.xsl"), "utf8"), { xmlMode: true });
for (const element of xsl('link[rel="stylesheet"][href]').toArray())
  await localTarget(element.attribs.href, stylesheet);
for (const match of xsl("style")
  .text()
  .matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
  await localTarget(match[1], stylesheet);
}

// 验证实际字体文件及发布副本，不依赖审计报告或历史快照。
const fontFiles = (await walk(path.join(root, "public/fonts"))).filter((file) =>
  file.endsWith(".woff2"),
);
for (const file of fontFiles) {
  const bytes = await readFile(file);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "wOF2", `${file}: 无效的 WOFF2 签名`);
  const published = path.join(dist, path.relative(path.join(root, "public"), file));
  assert.equal(hash(await readFile(published)), hash(bytes), `${file}: 发布字体与源文件不一致`);
}

// 完整轮廓/度量审计由 fonts:check 执行；日常构建无需 Python，仍检查分片完整性。
const fontManifest = JSON.parse(
  await readFile(path.join(root, "scripts/fonts/manifest.json"), "utf8"),
);
assert.equal(
  hash(await readFile(path.join(root, "scripts/fonts/sources/LXGWWenKaiGBScreen-all.woff2"))),
  fontManifest.sourceSHA256,
  "LXGW 原件已变更，请重新生成并审计分片",
);
const covered = new Set();
const mainFontCss = await readFile(path.join(root, "src/styles/font-subsets.css"), "utf8");
const mainFontFaces = [...mainFontCss.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(
  (match) => match[1],
);
assert.equal(mainFontFaces.length, fontManifest.lxgw.length + 2, "主站字体声明数量不符");
for (const family of ["Corinthia", "Corinthia Name"])
  assert.equal(
    mainFontFaces.filter((rule) => rule.includes(`font-family: "${family}";`)).length,
    1,
    `${family}: 品牌度量别名缺失或重复`,
  );
for (const item of [...fontManifest.lxgw, fontManifest.title]) {
  const bytes = await readFile(path.join(root, "public/fonts", item.file));
  assert.equal(hash(bytes), item.sha256, `${item.file}: 字体分片发生变化`);
  assert.equal(bytes.length, item.bytes, `${item.file}: 字体大小不符`);
  const mainFace = mainFontFaces.find((rule) => rule.includes(`/fonts/${item.file}`));
  assert.ok(mainFace, `${item.file}: 主站缺少字体声明`);
  assert.equal(
    mainFace.match(/unicode-range:\s*([^;]+);/)?.[1].replaceAll(/\s/g, ""),
    item.unicodeRange,
    `${item.file}: 主站字符范围与审计不符`,
  );
  if (item === fontManifest.title) continue;
  assert.ok(
    item.bytes <= fontManifest.maxNormalBytes || item.layoutGroup,
    `${item.file}: 超过常规分片大小限制`,
  );
  for (const range of item.unicodeRange.split(",")) {
    const [start, end = start] = range
      .slice(2)
      .split("-")
      .map((value) => parseInt(value, 16));
    assert.ok(Number.isInteger(start) && start <= end && end <= 0x10ffff);
    for (let code = start; code <= end; code++) {
      assert.ok(!covered.has(code), `${item.file}: Unicode 范围重复`);
      covered.add(code);
    }
  }
}
assert.equal(covered.size, fontManifest.characterCount, "LXGW 字符覆盖数量不符");
for (const [directory, entries] of [
  ["LXGWWenKai", fontManifest.lxgw],
  ["Corinthia", [fontManifest.title]],
]) {
  const css = await readFile(path.join(root, "public/fonts", directory, "font.css"), "utf8");
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((match) => match[1]);
  assert.equal(
    faces.length,
    entries.length + (directory === "Corinthia" ? 1 : 0),
    `${directory}: 字体声明数量不符`,
  );
  for (const item of entries) {
    const face = faces.find((rule) => rule.includes(path.posix.basename(item.file)));
    assert.ok(face, `${item.file}: 缺少 CSS 声明`);
    assert.equal(
      face.match(/unicode-range:\s*([^;]+);/)?.[1].replaceAll(/\s/g, ""),
      item.unicodeRange,
      `${item.file}: CSS 字符范围与审计不符`,
    );
  }
}
assert.ok(
  !files.some((file) =>
    /(?:LXGWWenKaiGBScreen(?:-all)?|Corinthia-Bold)\.(?:woff2|ttf)$/.test(file),
  ),
  "发布目录中仍存在旧的完整字体下载入口",
);
console.log(
  `发布检查通过：${pages.length} 个 HTML 页面、${articleFiles.length} 篇文章、${links} 个内部链接/资源、${fontFiles.length} 个字体文件。`,
);
