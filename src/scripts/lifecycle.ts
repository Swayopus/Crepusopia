/**
 * 一个组件模块只注册一次路由监听；每次换页先清理上一页的事件、计时器和观察器。
 * 保持 ClientRouter 的原有跳转方式，解决首次加载与 page-load 双初始化的问题。
 */
export function onPageLoad(setup: (signal: AbortSignal) => void | (() => void)) {
  let dispose = () => {};
  function mount() {
    dispose();
    const controller = new AbortController();
    const cleanup = setup(controller.signal);
    dispose = () => {
      controller.abort();
      cleanup?.();
    };
  }
  document.addEventListener("astro:page-load", mount);
  document.addEventListener("astro:before-swap", () => {
    dispose();
    dispose = () => {};
  });
  mount();
}
