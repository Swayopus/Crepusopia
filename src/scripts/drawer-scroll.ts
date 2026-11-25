/**
 * 仅在移动抽屉展开期间拦截背景滚动，不切换根容器 overflow，避免长文整体重排。
 * 抽屉可沿输入方向继续滚动时放行；到达边界后拦截，避免向正文传递。
 */
export function lockDrawerScroll(sidebar: HTMLElement): AbortController {
  const controller = new AbortController();
  const { signal } = controller;
  const savedX = window.scrollX;
  const savedY = window.scrollY;
  let touchY: number | undefined;

  function canScroll(target: EventTarget | null, deltaY: number) {
    if (!(target instanceof Node) || !sidebar.contains(target)) return false;
    if (deltaY < 0) return sidebar.scrollTop > 0;
    if (deltaY > 0) return sidebar.scrollTop + sidebar.clientHeight < sidebar.scrollHeight - 1;
    return true;
  }

  document.addEventListener(
    "wheel",
    (event) => {
      // Ctrl+滚轮也用于浏览器缩放，不拦截缩放手势。
      if (!event.ctrlKey && !canScroll(event.target, event.deltaY)) event.preventDefault();
    },
    { capture: true, passive: false, signal },
  );
  document.addEventListener(
    "touchstart",
    (event) => {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : undefined;
    },
    { capture: true, passive: true, signal },
  );
  document.addEventListener(
    "touchmove",
    (event) => {
      // 多指缩放保留原生行为，单指滑动只允许抽屉内部消费。
      if (event.touches.length !== 1) return;
      const currentY = event.touches[0].clientY;
      const deltaY = touchY === undefined ? 0 : touchY - currentY;
      touchY = currentY;
      if (!canScroll(event.target, deltaY)) event.preventDefault();
    },
    { capture: true, passive: false, signal },
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      // 表单编辑与按钮的空格激活继续交给浏览器；Escape 由原有抽屉逻辑处理。
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === " " && target?.closest("button, summary")) return;
      let direction = 0;
      if (["ArrowDown", "PageDown", "End"].includes(event.key)) direction = 1;
      else if (["ArrowUp", "PageUp", "Home"].includes(event.key)) direction = -1;
      else if (event.key === " ") direction = event.shiftKey ? -1 : 1;
      else if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!canScroll(event.target, direction)) event.preventDefault();
    },
    { capture: true, signal },
  );
  window.addEventListener(
    "scroll",
    () => {
      // 输入拦截之外，滚动条拖动或焦点移动也可能滚动根容器；立即恢复阅读位置。
      // 旋转/缩放后文档可能变短，先夹紧边界，避免反复尝试不可达的旧位置。
      const root = document.documentElement;
      const left = Math.min(savedX, Math.max(0, root.scrollWidth - root.clientWidth));
      const top = Math.min(savedY, Math.max(0, root.scrollHeight - root.clientHeight));
      if (window.scrollX !== left || window.scrollY !== top)
        window.scrollTo({ left, top, behavior: "instant" });
    },
    { passive: true, signal },
  );
  return controller;
}
