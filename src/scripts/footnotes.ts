import { onPageLoad } from "./lifecycle";

/** 脚注到达提示：沿用原生锚点导航，到达可读区域并停止滚动后才开始淡出。 */
onPageLoad((signal) => {
  if (!document.querySelector(".prose .footnotes")) return;

  let pending: HTMLElement | null = null;
  let highlighted: HTMLElement | null = null;
  let highlight: Animation | undefined;
  let idleTimer = 0;
  let frame = 0;
  let scrolling = false;
  const hasScrollEnd = "onscrollend" in document;

  function targetOf(hash: string) {
    try {
      const element = document.getElementById(decodeURIComponent(hash.slice(1)));
      return element?.matches(".prose .footnotes li") ? element : null;
    } catch {
      // 无效的 URL 编码不是脚注目标，不能影响原有导航。
      return null;
    }
  }

  function cancelPending() {
    clearTimeout(idleTimer);
    cancelAnimationFrame(frame);
    pending = null;
  }

  function clear() {
    cancelPending();
    highlight?.cancel();
    highlight = undefined;
    highlighted = null;
  }

  function showOnArrival() {
    const target = pending;
    if (!target || !target.isConnected || document.hidden) return;
    if (targetOf(location.hash) !== target) return;

    // 只在滚动停止时读取布局；至少露出一行，且不能被手机吸顶栏遮住。
    const rect = target.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewTop = viewport?.offsetTop ?? 0;
    const topbar = document.querySelector(".mobile-topbar")?.getBoundingClientRect().bottom ?? 0;
    const viewBottom = viewTop + (viewport?.height ?? innerHeight);
    const style = getComputedStyle(target);
    const scale = Number.parseFloat(getComputedStyle(document.body).zoom) || 1;
    const lineHeight = Number.parseFloat(style.lineHeight) * scale;
    const visibleHeight = Math.min(rect.bottom, viewBottom) - Math.max(rect.top, viewTop, topbar);
    if (rect.height === 0 || visibleHeight < Math.min(rect.height, lineHeight)) return;

    cancelPending();
    highlighted = target;
    const color = style.getPropertyValue("--color-bg-alt").trim();
    // WAAPI 每次创建独立动画，同一角标重复点击也能重播，无需强制重排。
    highlight = target.animate(
      [
        { backgroundColor: color, boxShadow: `0 0 0 4px ${color}`, offset: 0 },
        { backgroundColor: color, boxShadow: `0 0 0 4px ${color}`, offset: 0.2 },
        { backgroundColor: "transparent", boxShadow: "0 0 0 4px transparent", offset: 1 },
      ],
      {
        duration: 1800,
        easing: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "steps(1, end)"
          : "ease-out",
      },
    );
  }

  function waitForIdle() {
    clearTimeout(idleTimer);
    // 这是滚动静止检测，不是从点击开始计算的高亮时长。
    idleTimer = window.setTimeout(showOnArrival, 150);
  }

  function waitForArrival(target: HTMLElement | null, repeat = false) {
    // hashchange/popstate 可能跟在同一次点击后，不能覆盖正在等待的请求。
    if (!repeat && target && (pending === target || highlighted === target)) return;
    clear();
    if (!target) return;
    pending = target;
    scrolling = false;
    frame = requestAnimationFrame(() => {
      // 目标已在原位、瞬间跳转或根本没有滚动时，不一定有 scrollend。
      if (pending && !scrolling) waitForIdle();
    });
  }

  document.addEventListener(
    "click",
    (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download"))
        return;
      if (
        link.origin !== location.origin ||
        link.pathname !== location.pathname ||
        link.search !== location.search
      )
        return;
      // 不 preventDefault、不重写 URL，保留 ClientRouter、历史和原有焦点行为。
      waitForArrival(targetOf(link.hash), true);
    },
    { capture: true, signal },
  );

  const followHash = () => waitForArrival(targetOf(location.hash));
  window.addEventListener("hashchange", followHash, { signal });
  window.addEventListener("popstate", followHash, { signal });
  window.addEventListener(
    "scroll",
    () => {
      if (!pending) return;
      scrolling = true;
      clearTimeout(idleTimer);
      if (!hasScrollEnd) waitForIdle();
    },
    { passive: true, signal },
  );
  document.addEventListener(
    "scrollend",
    (event) => {
      if (event.target === document) showOnArrival();
    },
    { signal },
  );

  // 主动滚动意味着读者已接管跳转；不让遗留请求在稍后经过脚注时突然亮起。
  window.addEventListener("pointerdown", cancelPending, { passive: true, signal });
  window.addEventListener("wheel", cancelPending, { passive: true, signal });
  window.addEventListener("touchstart", cancelPending, { passive: true, signal });
  window.addEventListener(
    "keydown",
    (event) => {
      if (
        ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Escape"].includes(
          event.key,
        )
      )
        cancelPending();
    },
    { signal },
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) highlight?.pause();
      else {
        if (highlight?.playState === "paused") highlight.play();
        if (pending) waitForIdle();
      }
    },
    { signal },
  );

  followHash();
  return clear;
});
