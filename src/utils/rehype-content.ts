import type { Element, Parent, Root, RootContent } from "hast";
// 注册 MDX 的 HAST 扩展节点类型，运行时不引入额外模块。
import type {} from "mdast-util-mdx-jsx";
import { withBase } from "./url.ts";

/**
 * 正文内容增强：处理 Markdown 与 MDX 编译树，不改变文章源文件的写法。
 * - 站内根路径补上部署前缀，子目录部署时图片和链接仍然有效。
 * - 宽表格包一层可聚焦的横向滚动容器，避免撑宽整页。
 * - 独占一段的图片包成 <figure>，用 alt 作为图注，供灯箱脚本识别。
 */

const isElement = (node: RootContent | Element): node is Element => node.type === "element";

/**
 * 给 Markdown 与 MDX 原生 a/img 的静态站内路径补上 base（例如 /blog/）。
 * 外链、锚点、协议相对地址和相对路径保持原样，避免改变作者意图。
 */
export function rehypeBaseUrls(base?: string) {
  return (tree: Root) => {
    rewriteUrls(tree, base);
  };
}

function rewriteUrls(parent: Parent, base?: string) {
  for (const child of parent.children) {
    if (isElement(child)) {
      const key = child.tagName === "a" ? "href" : child.tagName === "img" ? "src" : undefined;
      const value = key ? child.properties[key] : undefined;
      if (key && typeof value === "string") child.properties[key] = prefixRootPath(value, base);
    } else if (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") {
      const key = child.name === "a" ? "href" : child.name === "img" ? "src" : undefined;
      for (const attribute of child.attributes) {
        // 仅修改原生标签的字面量；不猜测表达式、展开属性或自定义组件的语义。
        if (
          attribute.type === "mdxJsxAttribute" &&
          attribute.name === key &&
          typeof attribute.value === "string"
        )
          attribute.value = prefixRootPath(attribute.value, base);
      }
    }
    // Tab、其他 JSX 容器与 <> 片段中也可能有普通 Markdown，不能跳过它们的子树。
    if ("children" in child) rewriteUrls(child, base);
  }
}

function prefixRootPath(value: string, base?: string) {
  return value.startsWith("/") && !value.startsWith("//") ? withBase(value, base) : value;
}

/** 拼接元素内的纯文本，用于生成表格区域的辅助名称。 */
function textOf(node: RootContent | Element): string {
  if (node.type === "text") return node.value;
  if ("children" in node) return node.children.map((child) => textOf(child)).join("");
  return "";
}

/** 包一层可横向滚动的容器；小表格仍保持 100% 宽。 */
export function rehypeTableScroll() {
  return (tree: Root) => {
    walk(tree);
  };
}

function walk(parent: Parent) {
  // 已经处理过的容器不再重复包裹，插件重复执行时保持幂等。
  if (isScrollContainer(parent)) return;

  for (let index = 0; index < parent.children.length; index += 1) {
    const node = parent.children[index];

    if (isElement(node) && node.tagName === "table") {
      const header = node.children.find(
        (child): child is Element => isElement(child) && child.tagName === "thead",
      );
      const firstCell = header
        ? findElement(header, (child) => child.tagName === "th" || child.tagName === "td")
        : findElement(node, (child) => child.tagName === "th" || child.tagName === "td");
      const label = firstCell ? textOf(firstCell).trim() : "";

      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: {
          className: ["table-scroll"],
          tabIndex: 0,
          role: "region",
          "aria-label": label ? `表格：${label}` : "表格，可横向滚动",
        },
        children: [node],
      };
      continue;
    }

    // MDX 组件和片段本身不是 HTML 元素，内部仍可能包含 Markdown 表格。
    if ("children" in node) walk(node);
  }
}

function isScrollContainer(node: Parent): boolean {
  if (!("tagName" in node)) return false;
  const element = node as Element;
  const className = element.properties.className;
  return (
    element.tagName === "div" &&
    Array.isArray(className) &&
    (className as unknown[]).includes("table-scroll")
  );
}

function findElement(node: Parent, predicate: (node: Element) => boolean): Element | undefined {
  for (const child of node.children) {
    if (!isElement(child)) continue;
    if (predicate(child)) return child;
    const nested = findElement(child, predicate);
    if (nested) return nested;
  }
  return undefined;
}

/** 把单独占一段的图片改为 figure，并延迟加载。链接图片保持原样。 */
export function rehypeFigures() {
  return (tree: Root) => {
    wrap(tree);
  };
}

function wrap(parent: Parent) {
  for (let index = 0; index < parent.children.length; index += 1) {
    const node = parent.children[index];

    if (isElement(node) && node.tagName === "p") {
      const meaningful = node.children.filter(
        (child) => !(child.type === "text" && child.value.trim() === ""),
      );
      const image = meaningful[0];
      if (meaningful.length === 1 && isElement(image) && image.tagName === "img") {
        parent.children[index] = buildFigure(image);
        continue;
      }
    }

    if ("children" in node) wrap(node);
  }
}

function buildFigure(image: Element): Element {
  image.properties = {
    loading: "lazy",
    decoding: "async",
    ...image.properties,
  };

  const alt = typeof image.properties.alt === "string" ? image.properties.alt.trim() : "";
  const zoom: Element = {
    type: "element",
    tagName: "button",
    properties: {
      type: "button",
      className: ["prose-figure-zoom"],
      "aria-label": alt ? `放大图片：${alt}` : "放大图片",
    },
    children: [image],
  };

  const children: Element["children"] = [zoom];
  if (alt) {
    children.push({
      type: "element",
      tagName: "figcaption",
      properties: {},
      children: [{ type: "text", value: alt }],
    });
  }

  return {
    type: "element",
    tagName: "figure",
    properties: { className: ["prose-figure"] },
    children,
  };
}
