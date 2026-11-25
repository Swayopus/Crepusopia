import { onPageLoad } from "./lifecycle";
import { categoryKey } from "../utils/url";
import type { TransitionBeforePreparationEvent } from "astro:transitions/client";

// 同一函数既处理当前结果区，也在跨页返回时提前处理尚未显示的新文档。
function renderTags(doc: Document, tag: string | null) {
  const cloud = doc.querySelector("#tag-cloud");
  const results = doc.querySelector("#tag-results");
  const posts = doc.querySelector("#tag-posts");
  const count = doc.querySelector("#tag-result-count");
  const status = doc.querySelector("#tag-result-status");
  const templates = [...doc.querySelectorAll<HTMLTemplateElement>("template[data-post-tags]")];
  if (!cloud || !results || !posts || !count) return;
  const key = tag ? categoryKey(tag) : null;
  const filtered = templates.filter((template) =>
    (JSON.parse(template.dataset.postTags!) as string[]).some(
      (value) => categoryKey(value) === key,
    ),
  );
  posts.replaceChildren(...filtered.map((template) => template.content.cloneNode(true)));
  const words = filtered.reduce((sum, template) => sum + Number(template.dataset.words), 0);
  count.textContent = `${filtered.length} 篇 · 共 ${words.toLocaleString()} 字`;
  const message = key ? `标签 ${tag}：${count.textContent}` : "显示全部标签";
  // 状态区常驻于隐藏结果区之外；相同文本不重复写入，避免换页初始化时重复播报。
  if (status && status.textContent !== message) status.textContent = message;
  results.classList.toggle("hidden", !key);
  cloud.querySelectorAll<HTMLElement>(".tag-pill").forEach((pill) => {
    const selected = !!key && categoryKey(pill.dataset.tag ?? "") === key;
    pill.style.background = selected ? "var(--color-text)" : "";
    pill.style.color = selected ? "var(--color-bg)" : "";
    pill.setAttribute("aria-current", selected ? "true" : "false");
  });
}

function isFilterNavigation({ from, to }: Pick<TransitionBeforePreparationEvent, "from" | "to">) {
  return (
    from.origin === to.origin &&
    from.pathname === to.pathname &&
    from.search !== to.search &&
    !!document.querySelector("#tag-cloud")
  );
}

let retainedScroll: { left: number; top: number } | undefined;

// 只替换标签结果区；地址、历史索引及前进/后退仍全部交给 Astro。
document.addEventListener("astro:before-preparation", (event) => {
  if (isFilterNavigation(event)) {
    event.loader = async () => {
      event.newDocument = document;
    };
  }
});
document.addEventListener("astro:before-swap", (event) => {
  retainedScroll = undefined;
  const tag = event.to.searchParams.get("tag");
  if (isFilterNavigation(event)) {
    // 普通点击保持当前位置；历史遍历使用 Astro 为目标历史项保存的位置。
    if (event.navigationType !== "traverse") retainedScroll = { left: scrollX, top: scrollY };
    event.swap = () => renderTags(document, tag);
  } else {
    // 从文章返回标签页时，在 swap 前完成过滤，避免先显示未筛选的中间态。
    renderTags(event.newDocument, tag);
  }
});
document.addEventListener("astro:after-swap", () => {
  if (retainedScroll) {
    // Astro 已更新 URL；在同一帧恢复点击前的位置，不手动改写它的 history.state。
    scrollTo({ ...retainedScroll, behavior: "instant" });
    retainedScroll = undefined;
  }
});

// 卡片在构建时由 Astro 转义；筛选只克隆节点，不拼接文章 HTML。
onPageLoad((signal) => {
  if (document.querySelector("#tag-cloud")) {
    // 原地切换保留 body；Astro 会在 page-load 后追加新公告，先移除旧层。
    document.querySelectorAll(".astro-route-announcer").forEach((node) => node.remove());
  }
  renderTags(document, new URL(location.href).searchParams.get("tag"));
  document.addEventListener(
    "click",
    (event) => {
      if (
        event.button ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const link = event.target.closest<HTMLAnchorElement>(".tag-pill, #tag-back");
      // 重复点击当前标签不新增导航，也不回到顶部；修饰键保持浏览器原生行为。
      if (link?.href === location.href) event.preventDefault();
    },
    // 先于 Astro 的冒泡监听取消重复点击；冒泡阶段才处理时，导航已经开始。
    { capture: true, signal },
  );
});
