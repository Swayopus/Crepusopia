import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { load } from "cheerio";
import resourceDelivery, {
  fontCoverage,
  fontsForText,
  unicodeRange,
} from "../scripts/resource-delivery.mjs";
import { HOME_FONT } from "../src/scripts/font-loading.ts";
import { siteConfig } from "../src/config.ts";

test("一言在同步脚本中恢复当天缓存，损坏/过期缓存保留内置内容且不执行缓存 HTML", async () => {
  const component = await readFile(
    new URL("../src/components/Hitokoto.astro", import.meta.url),
    "utf8",
  );
  const script = component.match(/<script\b[^>]*data-astro-rerun[^>]*>([\s\S]*?)<\/script>/)[1];
  const now = "2026-10-26T16:10:00Z";
  class FixedDate extends Date {
    constructor() {
      super(now);
    }
  }
  function restore(value) {
    const text = { textContent: "内置句子" },
      footer = { textContent: "内置出处" };
    const block = {
      dataset: {},
      querySelector: (selector) => (selector === ".hitokoto-text" ? text : footer),
    };
    runInNewContext(script, {
      timezone: "Asia/Shanghai",
      allowedTypes: siteConfig.hitokoto.categories,
      Date: FixedDate,
      Intl,
      localStorage: {
        getItem() {
          if (value instanceof Error) throw value;
          return value;
        },
      },
      document: { currentScript: { previousElementSibling: block } },
    });
    return { text: text.textContent, footer: footer.textContent, date: block.dataset.cacheDate };
  }
  assert.deepEqual(
    restore(
      JSON.stringify({
        date: "2026-10-27",
        type: "i",
        text: '<img src=x onerror="bad()">',
        from: "诗集",
        fromWho: "作者",
      }),
    ),
    {
      text: '"<img src=x onerror="bad()">"',
      footer: "—— 诗集(作者)",
      date: "2026-10-27",
    },
  );
  for (const value of [
    "{",
    null,
    new Error("存储不可用"),
    JSON.stringify({ date: "2026-10-26", type: "i", text: "旧句子" }),
    JSON.stringify({ date: "2026-10-27", type: "i", text: 123 }),
    JSON.stringify({ date: "2026-10-27", type: "i", text: " " }),
    // 无分类旧缓存和其余八类均不能绕过新的分类限制。
    ...[undefined, "a", "b", "c", "e", "f", "g", "j", "l"].map((type) =>
      JSON.stringify({ date: "2026-10-27", type, text: "不符合筛选的旧句子" }),
    ),
  ]) {
    assert.deepEqual(restore(value), { text: "内置句子", footer: "内置出处", date: undefined });
  }
  for (const type of ["d", "h", "i", "k"]) {
    const restored = restore(JSON.stringify({ date: "2026-10-27", type, text: "允许的句子" }));
    assert.equal(restored.text, '"允许的句子"');
    assert.equal(restored.date, "2026-10-27");
  }
});

test("字体声明按 Unicode 码位选择，支持扩展汉字且不会把整库塞进初始页面", () => {
  const coverage = fontCoverage([
    { file: "latin", unicodeRange: "U+41-5A" },
    { file: "han", unicodeRange: "U+4E00-4E09" },
    { file: "ext", unicodeRange: "U+20003-2000B" },
  ]);
  assert.deepEqual(fontsForText(coverage, "AAA一𠀃?"), new Set(["latin", "han", "ext"]));
  assert.equal(coverage.size, 45);
  assert.equal(unicodeRange([0x4e00, 0x41, 0x42, 0x43, 0x41]), "U+41-43,U+4E00");
});

test("静态交付保留完整字库与无 JS 回退；公式按实际内容加载，正文与头像原件不变", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "crepusopia-delivery-"));
  try {
    const head =
      '<meta name="crepusopia-fonts"><style data-math-styles>.katex{color:inherit}</style>';
    const image =
      '<img data-site-avatar src="/blog/images/avatar.svg" alt="Crepusopia" class="rounded-full" width="80" height="80">';
    await mkdir(path.join(directory, "images"));
    await writeFile(
      path.join(directory, "images/landscape.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><rect width="1200" height="675"/></svg>',
    );
    const pictures =
      '<div class="prose"><figure class="prose-figure"><img src="/blog/images/landscape.svg" loading="lazy"></figure><figure class="prose-figure"><img src="/blog/images/landscape.svg" loading="lazy" width="400" height="225"></figure><img src="https://example.com/photo.jpg" loading="lazy"></div>';
    const body = `<h1>你好 A 𠀃</h1>${image}${pictures}<code>&lt;span class="katex"&gt;$5&lt;/span&gt;</code>`;
    await writeFile(
      path.join(directory, "index.html"),
      `<html><head>${head}</head><body>${body}</body></html>`,
    );
    await writeFile(
      path.join(directory, "math.html"),
      `<html><head>${head}</head><body>${body}<span class="katex">x</span></body></html>`,
    );
    const standalone = "<!doctype html><html><body>独立静态页</body></html>";
    await writeFile(path.join(directory, "standalone.html"), standalone);
    await resourceDelivery("/blog/").hooks["astro:build:done"]({
      dir: pathToFileURL(directory + path.sep),
      logger: { info() {} },
    });
    const plain = load(await readFile(path.join(directory, "index.html"), "utf8"), {
      scriptingEnabled: false,
    });
    const math = load(await readFile(path.join(directory, "math.html"), "utf8"), {
      scriptingEnabled: false,
    });
    assert.equal(plain("body").text(), load(`<body>${body}</body>`)("body").text());
    assert.equal(plain("[name=crepusopia-fonts]").length, 0);
    assert.equal(plain("[data-math-styles]").length, 0);
    const firstImage = plain(".prose-figure img").first();
    assert.equal(firstImage.attr("loading"), "eager");
    assert.equal(firstImage.attr("fetchpriority"), "high");
    assert.equal(firstImage.attr("width"), "1200");
    assert.equal(firstImage.attr("height"), "675");
    const laterImage = plain(".prose-figure img").eq(1);
    assert.equal(laterImage.attr("loading"), "lazy");
    assert.equal(laterImage.attr("width"), "400");
    assert.equal(laterImage.attr("height"), "225");
    assert.equal(laterImage.attr("fetchpriority"), undefined);
    assert.equal(plain('img[src^="https:"]').attr("width"), undefined);
    assert.equal(math("link[data-math-styles]").length, 1);
    const lazy = plain('meta[name="crepusopia-fonts-full"]');
    assert.equal(lazy.length, 1);
    assert.equal(plain("link[data-fonts-full]").length, 0);
    assert.equal(lazy.attr("href"), undefined);
    assert.equal(lazy.attr("rel"), undefined);
    assert.equal(lazy.attr("data-astro-transition-persist"), undefined);
    const full = math("link[data-astro-transition-persist]");
    assert.equal(full.attr("media"), "print");
    assert.equal(full.attr("fetchpriority"), "low");
    assert.equal(plain('link[rel="preload"][as="style"]').length, 0);
    const fontPreloads = plain('link[rel="preload"][as="font"]');
    assert.equal(fontPreloads.length, 2);
    assert.ok(fontPreloads.toArray().every((node) => "crossorigin" in node.attribs));
    assert.match(full.attr("onload"), /this.onload=null/);
    assert.equal(full.attr("href"), lazy.attr("content"));
    assert.equal(plain("noscript link").attr("href"), full.attr("href"));
    const complete = await readFile(
      path.join(directory, full.attr("href").slice("/blog/".length)),
      "utf8",
    );
    const manifest = JSON.parse(
      await readFile(new URL("../scripts/fonts/manifest.json", import.meta.url), "utf8"),
    );
    assert.equal((complete.match(/@font-face/g) || []).length, manifest.lxgw.length + 2);
    // 两个度量别名必须首屏就绪；若仅交付第一个 face，姓名会随完整映射到达再次跳动。
    for (const family of ["Corinthia", "Corinthia Name"]) {
      assert.ok(plain("style[data-fonts-critical]").text().includes(`font-family:"${family}"`));
      assert.ok(complete.includes(`font-family:"${family}"`));
    }
    assert.equal(
      fontPreloads.toArray().filter((node) => node.attribs.href.includes("/Corinthia/")).length,
      1,
      "两个别名应复用一次字体下载",
    );
    assert.ok(!complete.includes("\n"), "交付 CSS 应压缩，原生成文件继续保留可读格式");
    assert.equal(
      plain('meta[name="crepusopia-fonts-full"] ~ style[data-fonts-critical]').length,
      1,
      "初始字体声明需位于完整映射之后，防止完整映射加载后覆盖首页独立子集",
    );
    assert.equal(
      (
        plain("style[data-fonts-critical]")
          .text()
          .match(/@font-face/g) || []
      ).length,
      3,
      "首页只交付 1 个合并正文子集与 2 个品牌别名",
    );
    assert.ok(plain("style[data-fonts-critical]").text().includes(`font-family:"${HOME_FONT}"`));
    assert.ok(
      !plain("style[data-fonts-critical]").text().includes('font-family:"LXGW WenKai GB Screen";'),
      "首页别名不能与完整分片重叠，否则显式字体预加载会重复下载",
    );
    assert.match(
      plain("style[data-fonts-critical]").text(),
      /\/blog\/_astro\/lxgw-home-[0-9a-f]+\.woff2/,
    );
    assert.ok(
      fontPreloads.toArray().some((node) => node.attribs.href.includes("/_astro/lxgw-home-")),
      "首页预加载合并后的正文子集",
    );
    assert.ok(
      (
        math("style[data-fonts-critical]")
          .text()
          .match(/@font-face/g) || []
      ).length < 10,
    );
    assert.match(math("style[data-fonts-critical]").text(), /\/blog\/fonts\/LXGWWenKai\/subsets\//);
    assert.ok(complete.includes('url("/blog/fonts/'));
    const avatar = plain("img");
    assert.equal(avatar.attr("src"), "/blog/images/avatar.svg");
    assert.equal(avatar.attr("class"), "rounded-full");
    assert.match(avatar.attr("srcset"), /160w.*320w.*640w.*1280w.*2143w/);
    assert.equal(
      (await readdir(path.join(directory, "_astro"))).filter((file) => file.endsWith(".webp"))
        .length,
      4,
    );
    assert.equal(await readFile(path.join(directory, "standalone.html"), "utf8"), standalone);
  } finally {
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep));
    assert.ok(path.basename(directory).startsWith("crepusopia-delivery-"));
    await rm(directory, { recursive: true, force: true });
  }
});
