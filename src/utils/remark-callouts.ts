import remarkObsidianCallout from "remark-obsidian-callout";
import type { Root, RootContent, PhrasingContent, Blockquote, Paragraph } from "mdast";

/** 按第一处换行拆分行内 AST，保留链接、强调和行内代码。 */
function splitLine(nodes: PhrasingContent[]): [PhrasingContent[], PhrasingContent[]] {
  const before: PhrasingContent[] = [];
  for (const [index, node] of nodes.entries()) {
    if (node.type === "text" && node.value.includes("\n")) {
      const position = node.value.indexOf("\n");
      return [
        [...before, { ...node, value: node.value.slice(0, position) }],
        [{ ...node, value: node.value.slice(position + 1) }, ...nodes.slice(index + 1)],
      ];
    }
    before.push(node);
  }
  return [before, []];
}

/** 用标准节点指定输出标签，正文仍由 Markdown 管线转义及渲染。 */
function container(className: string, children: RootContent[]): Blockquote {
  return {
    type: "blockquote",
    data: { hName: "div", hProperties: { className: [className] } },
    children: children as Blockquote["children"],
  };
}

/**
 * 保留原插件的图标、类型和 data 属性，只修复它把正文拼成原始 HTML、
 * 丢失行内格式以及嵌套正文逃出折叠区域的问题。
 */
export default function remarkCallouts() {
  const upstream = remarkObsidianCallout.call(undefined as never) as unknown as (
    tree: Root,
  ) => void;
  return (tree: Root) => {
    const originals: { node: Blockquote; paragraph: Paragraph; rest: Blockquote["children"] }[] =
      [];
    function collect(node: Root | RootContent) {
      if (node.type === "blockquote" && node.children[0]?.type === "paragraph") {
        const paragraph = node.children[0];
        if (
          paragraph.children[0]?.type === "text" &&
          /^\[!\w+\][+-]?/.test(paragraph.children[0].value)
        ) {
          originals.push({
            node,
            paragraph: structuredClone(paragraph),
            rest: node.children.slice(1),
          });
        }
      }
      if ("children" in node) for (const child of node.children) collect(child as RootContent);
    }
    collect(tree);
    upstream(tree);
    // 从内向外修复，父节点中的引用始终指向已经修好的嵌套块。
    for (const { node, paragraph, rest } of originals.reverse()) {
      const generated = node.children[0];
      if (generated?.type !== "html") continue;
      const icon = generated.value.match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? "";
      const [title, body] = splitLine(paragraph.children);
      const first = title[0];
      if (first?.type === "text") first.value = first.value.replace(/^\[!\w+\][+-]?\s*/, "");
      const hasTitle = title.some((part) => part.type !== "text" || part.value.trim());
      const titleNodes: RootContent[] = [
        { type: "html", value: `<div class="callout-title-icon">${icon}</div>` },
      ];
      if (hasTitle)
        titleNodes.push({
          type: "paragraph",
          data: {
            hName: "div",
            hProperties: { className: ["callout-title-text"] },
          } as Paragraph["data"],
          children: title,
        });
      const bodyNodes: RootContent[] = [
        ...(body.some((part) => part.type !== "text" || part.value.trim())
          ? [{ type: "paragraph" as const, children: body }]
          : []),
        ...rest,
      ];
      node.children = [
        container("callout-title", titleNodes),
        container("callout-content", bodyNodes),
      ];
    }
  };
}

/** remark-directive 只解析语法；将容器指令映射为全局样式中的提示块。 */
export function remarkCalloutDirectives() {
  return (tree: Root) => {
    function visit(node: { type: string; name?: string; data?: object; children?: unknown[] }) {
      if (
        node.type === "containerDirective" &&
        ["note", "tip", "important", "warning", "caution"].includes(node.name ?? "")
      ) {
        node.data = {
          ...node.data,
          hName: "div",
          hProperties: { className: ["callout", `callout-${node.name}`] },
        };
      }
      for (const child of node.children ?? []) visit(child as Parameters<typeof visit>[0]);
    }
    visit(tree);
  };
}
