import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/contrib/mhchem";
import remarkCallouts, { remarkCalloutDirectives } from "./src/utils/remark-callouts.ts";
import { rehypeBaseUrls, rehypeFigures, rehypeTableScroll } from "./src/utils/rehype-content.ts";
import { codeMetaTransformer } from "./src/utils/shiki-code-meta.ts";
import { siteConfig } from "./src/config.ts";
import resourceDelivery from "./scripts/resource-delivery.mjs";
import { bundledThemes } from "shiki";

// GitHub Dark 的原注释色在代码背景上只有约 3:1；仅提亮注释，保留其余语法配色。
const githubDark = (await bundledThemes["github-dark"]()).default;
const readableDark = {
  ...githubDark,
  tokenColors: githubDark.tokenColors.map((rule) =>
    rule.settings.foreground?.toLowerCase() === "#6a737d"
      ? { ...rule, settings: { ...rule.settings, foreground: "#959da5" } }
      : rule,
  ),
};

export default defineConfig({
  site: siteConfig.siteUrl,
  base: siteConfig.base,
  // HTML 空白压缩保留行内文字之间的间距；格式化配置采用同一规则。
  compressHTML: true,
  devToolbar: { enabled: false },
  trailingSlash: "always",
  // 有浏览意图时再预取；避免打开任一页面就下载所有可见导航与文章。
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  markdown: {
    // 数学和化学式在构建时渲染，浏览器无需加载公式脚本。
    processor: unified({
      remarkPlugins: [
        remarkDirective,
        remarkCalloutDirectives,
        remarkCallouts,
        ...(siteConfig.features.katex ? [remarkMath] : []),
      ],
      rehypePlugins: [
        ...(siteConfig.features.katex ? [rehypeKatex] : []),
        rehypeTableScroll,
        [rehypeBaseUrls, siteConfig.base],
        rehypeFigures,
      ],
      // 脚注区标题会显示为可见小节，并从文章目录中排除。
      remarkRehype: { footnoteLabel: "注释", footnoteBackLabel: "返回正文" },
    }),
    syntaxHighlight: "shiki",
    shikiConfig: {
      themes: { light: "github-light", dark: readableDark },
      transformers: [codeMetaTransformer],
    },
  },
  integrations: [
    mdx(),
    ...(siteConfig.features.sitemap ? [sitemap()] : []),
    resourceDelivery(siteConfig.base),
  ],
  vite: {
    plugins: [tailwindcss()],
    // 与 tsconfig.json 的 paths 保持一致，只保留源码实际使用的别名。
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
        "@layouts": fileURLToPath(new URL("./src/layouts", import.meta.url)),
        "@utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
        "@styles": fileURLToPath(new URL("./src/styles", import.meta.url)),
        "@data": fileURLToPath(new URL("./src/data", import.meta.url)),
      },
    },
  },
});
