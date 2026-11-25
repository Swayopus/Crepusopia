import { onPageLoad } from "./lifecycle";
import { prepareBodyFonts } from "./font-loading";

interface Result {
  url: string;
  meta: { title?: string };
  excerpt?: string;
}
interface Pagefind {
  search(query: string): Promise<{ results: { data(): Promise<Result> }[] }>;
}
let engine: Promise<Pagefind> | undefined;

onPageLoad((signal) => {
  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input") as HTMLInputElement | null;
  const results = document.getElementById("search-results");
  const clear = document.getElementById("search-clear");
  if (!modal || !input || !results || !clear) return;
  clear.tabIndex = input.value.length ? 0 : -1;
  let timer: ReturnType<typeof setTimeout>;
  let version = 0;
  let previousFocus: HTMLElement | null = null;
  let previousOverflow = "";
  let opened = false;
  const hint = (text: string, className = "search-hint") => {
    const p = document.createElement("p");
    p.className = className;
    p.textContent = text;
    results.replaceChildren(p);
    // 加载中、空结果和计数也是动态文字，不能只照顾文章摘要。
    void prepareBodyFonts(text, getComputedStyle(results).fontSize, signal);
  };
  function close(restoreFocus = true) {
    if (!opened) return;
    opened = false;
    version++;
    clearTimeout(timer);
    modal!.classList.remove("open");
    modal!.setAttribute("aria-hidden", "true");
    if (document.documentElement.style.overflow === "hidden")
      document.documentElement.style.overflow = previousOverflow;
    modal!.style.paddingLeft = "";
    modal!.style.paddingRight = "";
    if (restoreFocus && previousFocus?.isConnected) {
      // 手机上打开搜索会关闭侧栏；焦点不能返回已变为 inert 的搜索按钮。
      if (previousFocus.closest("[inert]")) document.getElementById("menu-toggle")?.focus();
      else previousFocus.focus();
    }
  }
  function syncPosition() {
    if (!opened) return;
    const rect = document.querySelector("main")!.getBoundingClientRect();
    // DOM 坐标已包含整页缩放；弹窗的 CSS 内边距使用缩放前的同一坐标系。
    const scale = Number(getComputedStyle(document.body).zoom) || 1;
    modal!.style.paddingLeft = `${Math.max(rect.left / scale, 16)}px`;
    modal!.style.paddingRight = `${Math.max((innerWidth - rect.right) / scale, 16)}px`;
  }
  function open(trigger?: HTMLElement) {
    if (opened) return;
    opened = true;
    // 在取得锁时记录状态。侧栏可能已关闭，点击路径应使用实际触发按钮。
    previousOverflow = document.documentElement.style.overflow;
    previousFocus =
      trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    modal!.classList.add("open");
    modal!.setAttribute("aria-hidden", "false");
    // 锁定根滚动容器，不改变 body 的 sticky 定位上下文。
    document.documentElement.style.overflow = "hidden";
    syncPosition();
    void prepareBodyFonts(input!.placeholder, getComputedStyle(input!).fontSize, signal);
    input!.focus();
    if (input!.value.trim()) void search(input!.value.trim(), ++version);
  }
  async function search(query: string, ticket: number) {
    if (!query) {
      results!.replaceChildren();
      return;
    }
    hint("搜索中…");
    try {
      const moduleUrl = `${import.meta.env.BASE_URL}pagefind/pagefind.js`;
      engine ??= import(/* @vite-ignore */ moduleUrl) as Promise<Pagefind>;
      const found = await (await engine).search(query);
      const matches = await Promise.all(found.results.slice(0, 30).map((result) => result.data()));
      // 后发查询胜出，空输入、关闭弹窗和换页都会使旧结果失效。
      if (signal.aborted || ticket !== version || !modal!.classList.contains("open")) return;
      if (!matches.length) {
        hint("未找到相关文章");
        return;
      }
      const fragment = document.createDocumentFragment();
      for (const match of matches) {
        const url = new URL(match.url, location.href);
        if (url.origin !== location.origin) continue;
        const link = document.createElement("a");
        link.href = url.href;
        link.className = "search-result-item";
        const title = document.createElement("div");
        title.className = "search-result-title";
        title.textContent = match.meta.title || match.url;
        link.append(title);
        if (match.excerpt) {
          const excerpt = document.createElement("div");
          excerpt.className = "search-result-excerpt";
          // 只保留 Pagefind 的 mark 高亮，其他标记作为文本，避免标题/摘要注入 HTML。
          const parsed = new DOMParser().parseFromString(match.excerpt, "text/html");
          function append(node: Node, parent: HTMLElement) {
            if (node.nodeType === Node.TEXT_NODE)
              parent.append(document.createTextNode(node.textContent ?? ""));
            else if (node instanceof Element) {
              const target = node.tagName === "MARK" ? document.createElement("mark") : parent;
              if (target !== parent) parent.append(target);
              node.childNodes.forEach((child) => append(child, target));
            }
          }
          parsed.body.childNodes.forEach((node) => append(node, excerpt));
          link.append(excerpt);
        }
        fragment.append(link);
      }
      // 首页的静态字体并不一定覆盖搜索摘要，先准备实际显示的文字再呈现。
      await prepareBodyFonts(
        fragment.textContent ?? "",
        getComputedStyle(results!).fontSize,
        signal,
      );
      if (signal.aborted || ticket !== version || !opened) return;
      hint(
        `${found.results.length} 条结果${found.results.length > 30 ? "（显示前 30 条）" : ""}`,
        "search-count",
      );
      results!.append(fragment);
    } catch {
      if (signal.aborted || ticket !== version) return;
      engine = undefined;
      hint(
        import.meta.env.DEV
          ? "搜索索引尚未构建，请运行 npm run build 后使用 npm run preview。"
          : "搜索暂时不可用，请重试。",
      );
    }
  }
  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const trigger = event.target.closest<HTMLElement>("#search-toggle");
      if (trigger) open(trigger);
      else if (event.target.closest("#search-close, .search-result-item") || event.target === modal)
        close();
    },
    { signal },
  );
  window.addEventListener("resize", syncPosition, { signal });
  clear.addEventListener(
    "click",
    () => {
      input.value = "";
      clear.tabIndex = -1;
      clear.classList.remove("visible");
      version++;
      clearTimeout(timer);
      results.replaceChildren();
      input.focus();
    },
    { signal },
  );
  input.addEventListener(
    "input",
    () => {
      clearTimeout(timer);
      const ticket = ++version;
      const query = input.value.trim();
      clear.classList.toggle("visible", input.value.length > 0);
      clear.tabIndex = input.value.length ? 0 : -1;
      if (!query) results.replaceChildren();
      else timer = setTimeout(() => void search(query, ticket), 200);
    },
    { signal },
  );
  document.addEventListener(
    "keydown",
    (event) => {
      const visible = modal.classList.contains("open");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        visible ? close() : open();
      }
      if (event.key === "Escape" && visible) close();
      if (event.key === "Tab" && visible) {
        const focusable = [...modal.querySelectorAll<HTMLElement>("button, input, a[href]")].filter(
          (el) => el.tabIndex >= 0 && el.getClientRects().length,
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    },
    { signal },
  );
  return () => close(false);
});
