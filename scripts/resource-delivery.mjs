/** 静态产物的资源交付：首屏字形声明、共享完整字库、按需公式样式与响应式头像。 */
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { load } from "cheerio";
import sharp from "sharp";
import subsetFont from "subset-font";
import { HOME_FONT } from "../src/scripts/font-loading.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const digest = (data) => createHash("sha256").update(data).digest("hex").slice(0, 16);
const ASCII_TEXT = String.fromCharCode(...Array.from({ length: 95 }, (_, index) => index + 32));
const PRESERVE_NAME_IDS = Array.from({ length: 25 }, (_, index) => index);

/** 映射只决定声明的交付时机；不会重新裁剪字体或丢弃任何原有字符。 */
export function fontCoverage(entries) {
  const coverage = new Map();
  for (const entry of entries) {
    for (const range of entry.unicodeRange.split(",")) {
      const [first, last = first] = range
        .slice(2)
        .split("-")
        .map((code) => parseInt(code, 16));
      for (let code = first; code <= last; code++) coverage.set(code, entry.file);
    }
  }
  return coverage;
}

export function fontsForText(coverage, text) {
  return new Set(Array.from(text, (char) => coverage.get(char.codePointAt(0))).filter(Boolean));
}

export function unicodeRange(codes) {
  const ordered = [...new Set(codes)].sort((a, b) => a - b);
  const ranges = [];
  for (const code of ordered) {
    if (ranges.length && code === ranges.at(-1)[1] + 1) ranges.at(-1)[1] = code;
    else ranges.push([code, code]);
  }
  return ranges
    .map(
      ([start, end]) =>
        `U+${start.toString(16).toUpperCase()}${end > start ? `-${end.toString(16).toUpperCase()}` : ""}`,
    )
    .join(",");
}

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? htmlFiles(file) : file.endsWith(".html") ? [file] : [];
      }),
    )
  ).flat();
}

export default function resourceDelivery(base = "/") {
  const prefix = `/${base.replace(/^\/+|\/+$/g, "")}`.replace(/\/$/, "") + "/";
  const url = (file) => prefix + file;
  return {
    name: "crepusopia-resource-delivery",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const assets = path.join(out, "_astro");
        await mkdir(assets, { recursive: true });
        const manifest = JSON.parse(
          await readFile(path.join(root, "scripts/fonts/manifest.json"), "utf8"),
        );
        const coverage = fontCoverage(manifest.lxgw);
        const fontCss = (await readFile(path.join(root, "src/styles/font-subsets.css"), "utf8"))
          .replaceAll('url("/fonts/', `url("${url("fonts/")}`)
          // 生成文件仅含 @font-face；保留引号内的字体名称，不压缩其中的空格。
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\s*([{}:;,])\s*/g, "$1")
          .trim();
        const faces = [...fontCss.matchAll(/@font-face\s*\{[^}]+\}/g)].map((match) => match[0]);
        const faceByFile = new Map(
          [...manifest.lxgw, manifest.title].map((entry) => [
            entry.file,
            // 品牌文件有站点名、姓名两个度量别名，必须一起交付以免延迟映射改变尺寸。
            faces.filter((face) => face.includes(path.posix.basename(entry.file))).join("\n"),
          ]),
        );
        const fullFile = `_astro/fonts-${digest(fontCss)}.css`;
        await writeFile(path.join(out, fullFile), fontCss);

        // 源 SVG 保留；小图提供不同像素密度的 WebP，极高缩放仍可选择原件。
        let avatar;
        let avatarAspect;
        let sourceFont;
        let mathPages = 0;
        const mathAssets = new Map();
        const homeHtmlPath = path.join(out, "index.html");
        for (const file of await htmlFiles(out)) {
          let html = await readFile(file, "utf8");
          // public 中的独立 HTML 不一定使用博客布局，不改写它们。
          if (!html.includes('<meta name="crepusopia-fonts">')) continue;
          const $ = load(html);
          // 正文首图可能成为移动端 LCP：先请求；后续图片继续按需加载。
          $(".prose .prose-figure img").first().attr({ loading: "eager", fetchpriority: "high" });
          for (const node of $(".prose img, .status-body img").toArray()) {
            const image = $(node);
            if (image.attr("width") || image.attr("height") || !image.attr("src")) continue;
            // 只读取构建目录内的本地图片，不请求外网，也不覆盖作者指定的尺寸。
            const imageUrl = new URL(
              image.attr("src"),
              `https://content.invalid/${path.relative(out, file).split(path.sep).join("/")}`,
            );
            if (
              imageUrl.origin !== "https://content.invalid" ||
              !imageUrl.pathname.startsWith(prefix)
            )
              continue;
            const asset = path.resolve(
              out,
              decodeURIComponent(imageUrl.pathname.slice(prefix.length)),
            );
            if (!asset.startsWith(path.resolve(out) + path.sep)) continue;
            const { width, height } = await sharp(asset).metadata();
            if (width && height) image.attr({ width: String(width), height: String(height) });
          }
          html = $.html();
          if (
            !avatar &&
            $("img[data-site-avatar]")
              .toArray()
              .some((node) => node.attribs.src === url("images/avatar.svg"))
          ) {
            const svg = await readFile(path.join(root, "public/images/avatar.svg"));
            const { width: originalWidth, height: originalHeight } = await sharp(svg).metadata();
            avatarAspect = `${originalWidth}/${originalHeight}`;
            avatar = [];
            for (const width of [160, 320, 640, 1280].filter((width) => width < originalWidth)) {
              const bytes = await sharp(svg)
                .resize({ width })
                .webp({ lossless: true, effort: 6 })
                .toBuffer();
              const file = `_astro/avatar-${width}-${digest(bytes)}.webp`;
              await writeFile(path.join(out, file), bytes);
              avatar.push(`${url(file)} ${width}w`);
            }
            avatar.push(`${url("images/avatar.svg")} ${originalWidth}w`);
          }
          const body = $("body").clone();
          body.find("script, style").remove();
          let text = body.text();
          // 打字机的后续行不在初始 textContent 中，也要提前声明所需字形。
          for (const node of $("[data-lines]").toArray())
            text += decodeURIComponent(node.attribs["data-lines"]);
          const isHome = path.resolve(file) === path.resolve(homeHtmlPath);
          let critical;
          let primaryPreload = url(`fonts/${coverage.get(0x41)}`);
          if (isHome) {
            // 首页提取实际文字与基础 ASCII 生成独立子集，未命中字符（如动态一言、搜索）自动回退完整分片。
            sourceFont ??= await readFile(
              path.join(root, "scripts/fonts/sources/LXGWWenKaiGBScreen-all.woff2"),
            );
            const homeCodes = [
              ...new Set(
                Array.from(text + ASCII_TEXT, (char) => char.codePointAt(0)).filter((code) =>
                  coverage.has(code),
                ),
              ),
            ].sort((a, b) => a - b);
            const homeBytes = await subsetFont(sourceFont, String.fromCodePoint(...homeCodes), {
              targetFormat: "woff2",
              preserveNameIds: PRESERVE_NAME_IDS,
            });
            const homeFile = `_astro/lxgw-home-${digest(homeBytes)}.woff2`;
            await writeFile(path.join(out, homeFile), homeBytes);
            const homeFace = `@font-face{font-family:"${HOME_FONT}";src:url("${url(homeFile)}") format("woff2");font-weight:400;font-style:normal;font-display:swap;unicode-range:${unicodeRange(homeCodes)};}`;
            critical = `${homeFace}\n${faceByFile.get(manifest.title.file)}`;
            primaryPreload = url(homeFile);
          } else {
            const needed = fontsForText(coverage, text);
            needed.add(manifest.title.file);
            critical = [...needed].map((name) => faceByFile.get(name)).join("\n");
          }
          const fullUrl = url(fullFile);
          // 首页预加载合并后的首屏子集与品牌字体；内页预加载正文 Latin 与品牌英文两片。
          const priorityFonts = [primaryPreload, url(`fonts/${manifest.title.file}`)]
            .map(
              (href) =>
                `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin>`,
            )
            .join("");
          // 首页静态文字只需 Home；完整映射及重叠声明按动态文字的实际需要交付。
          // 用配置 meta 保存地址，首次缺字时才创建有效的 stylesheet link。
          // 配置不 persist；换到内页时由路由器正常装入完整映射。
          const fullLink = isHome
            ? `<meta name="crepusopia-fonts-full" content="${fullUrl}">`
            : `<link rel="stylesheet" href="${fullUrl}" media="print" fetchpriority="low" onload="this.onload=null;this.media='all';this.dataset.fontsReady='true'" onerror="this.dataset.fontsReady='failed'" data-fonts-full data-astro-transition-persist="${fullUrl}">`;
          const fontHead =
            priorityFonts +
            fullLink +
            `<noscript><link rel="stylesheet" href="${fullUrl}"></noscript>` +
            `<style data-fonts-critical>${critical}</style>`;
          html = html.replace('<meta name="crepusopia-fonts">', fontHead);

          // 判断实际渲染结果，代码块里的 $、MDX 和随记不会使公式样式误判。
          html = html.replace(
            /<style\b[^>]*data-math-styles[^>]*>([\s\S]*?)<\/style>/,
            (_tag, css) => {
              if (!$(".katex").length) return "";
              const mathFile = `_astro/math-${digest(css)}.css`;
              // 所有公式页内容相同，稍后一次写入即可复用浏览器缓存。
              mathAssets.set(mathFile, css);
              mathPages++;
              return `<link rel="stylesheet" href="${url(mathFile)}" data-math-styles>`;
            },
          );
          html = html.replace(/<img\b[^>]*data-site-avatar[^>]*>/g, (tag) => {
            const image = load(tag)("img");
            if (image.attr("src") !== url("images/avatar.svg")) return tag;
            image.attr("srcset", avatar.join(", "));
            image.attr("sizes", "(min-width: 1800px) 180px, 72px");
            // 小图的整数像素比例有舍入；布局继续使用原 SVG 的精确比例。
            image.attr("style", `${image.attr("style") ?? ""};aspect-ratio:${avatarAspect}`);
            return image.toString();
          });
          await writeFile(file, html);
        }
        for (const [file, css] of mathAssets) await writeFile(path.join(out, file), css);
        logger.info(
          `字体声明已按页面用字交付，完整字库共享缓存；${mathPages} 页按需加载公式样式。`,
        );
      },
    },
  };
}
