/**
 * Astro 配置文件。
 *
 * 定义集成插件、Markdown 处理、语法高亮和 Vite 模块别名。
 * 大部分值从 src/config.ts 的 siteConfig 中读取。
 *
 * @required — 此文件中列出的每个插件和集成都是 siteConfig.features
 *             中对应功能正常工作的必要依赖。
 */

import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import remarkDirective from "remark-directive";
import remarkObsidianCallout from "remark-obsidian-callout";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
// 副作用导入：注册 mhchem 扩展，使 KaTeX 能够在数学块中渲染化学方程式
// （例如 \ce{H2O}）。
import "katex/contrib/mhchem";
import { siteConfig } from "./src/config";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  site: siteConfig.siteUrl,
  base: siteConfig.base,

  /** 禁用 Astro 开发者工具栏浮层。 */
  devToolbar: { enabled: false },

  /**
   * URL 始终追加末尾斜杠。
   * 避免重复内容问题（例如 /about 和 /about/ 被视为两个不同页面）。
   */
  trailingSlash: "always",

  /**
   * 预取配置（Speculation Rules API）。
   *
   * prefetchAll: true
   *   预取页面上的每一个内部链接。适合内容型站点，大部分链接都可能被点击。
   *
   * defaultStrategy: "viewport"
   *   仅预取视口中可见的链接。在速度与带宽之间取得平衡。
   */
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },

  markdown: {
    /**
     * remarkPlugins — 在 Markdown 转换为 HTML 之前处理 Markdown AST。
     *
     * remark-directive:
     *   解析 :::note / :::tip / :::warning 容器指令，使其能够渲染为
     *   带样式的提示块（callout block）。
     *
     * remark-obsidian-callout:
     *   解析 Obsidian 风格的 > [!note] 语法，支持 13 种类型、
     *   可折叠、嵌套和空标题。
     *
     * remark-math:
     *   解析 $行内$ 和 $$块级$$ 数学语法为 math AST 节点，
     *   供 rehype-katex 将其渲染为 HTML+CSS。
     */
    remarkPlugins: [remarkDirective, remarkObsidianCallout, remarkMath],

    /**
     * rehypePlugins — 在 Markdown 转换为 HTML 之后处理 HTML AST。
     *
     * rehype-katex:
     *   将 remark-math 生成的 math AST 节点渲染为静态 HTML，
     *   配合 KaTeX 样式表即可正确显示数学公式。
     */
    rehypePlugins: [rehypeKatex],

    /**
     * 使用 Shiki 进行 Markdown 代码块的语法高亮。
     * Shiki 在构建时运行，输出内联样式的 <span> 元素。
     */
    syntaxHighlight: "shiki",
    shikiConfig: {
      /**
       * 双主题配置。
       *
       * Shiki 会为每个 token 生成 CSS 自定义属性
       *（--shiki-* 和 --shiki-dark-*）。
       * global.css 中的 .dark 规则会将这些属性切换，使代码块
       * 自动跟随页面主题变化。
       *
       * 默认使用 "github-light" 浅色主题；当父元素包含 .dark 类时
       * 切换到 "github-dark" 深色主题。
       */
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    },
  },

  /**
   * Astro 集成 — 挂载到 Astro 构建管线的插件。
   *
   * @astrojs/mdx:
   *   支持 .mdx 文件（Markdown + JSX 组件）。允许在 Markdown 中
   *   导入和使用 Astro/React/Svelte 组件。
   *
   * @astrojs/sitemap:
   *   构建时自动生成 sitemap.xml，涵盖所有静态路由。
   *   由 siteConfig.features.sitemap 控制。
   */
  integrations: [mdx(), sitemap()],

  vite: {
    /**
     * @tailwindcss/vite:
     *   Tailwind CSS v4 的 Vite 插件，替代旧的 PostCSS 插件。
     *   提供 CSS 扫描、编译和开发模式热更新，无需单独的 PostCSS 配置文件。
     */
    plugins: [tailwindcss()],

    build: {
      rollupOptions: {
        // Pagefind 文件位于 dist/pagefind/，仅在 `pagefind --site dist`
        // 后构建步骤完成后才存在。告知 Rollup 不要打包这些文件 ——
        // 它们在运行时通过动态导入加载。
        external: [/\/pagefind\/.*/],
      },
    },

    resolve: {
      /**
       * 模块别名 — 简化导入路径，让你可以写：
       *   import Foo from "@components/Foo"
       * 而不必写：
       *   import Foo from "../../components/Foo"
       *
       * 裸 "@" 别名指向 ./src，用于通用导入。
       */
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
        "@layouts": fileURLToPath(new URL("./src/layouts", import.meta.url)),
        "@utils": fileURLToPath(new URL("./src/utils", import.meta.url)),
        "@assets": fileURLToPath(new URL("./src/assets", import.meta.url)),
        "@styles": fileURLToPath(new URL("./src/styles", import.meta.url)),
        "@types": fileURLToPath(new URL("./src/types", import.meta.url)),
        "@data": fileURLToPath(new URL("./src/data", import.meta.url)),
      },
    },
  },
});
