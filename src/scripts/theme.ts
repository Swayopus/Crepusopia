// 模块脚本只执行一次，避免内联脚本在 ClientRouter 切页后重复注册点击事件。
document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("#theme-toggle-btn")) {
    window.applyTheme(!document.documentElement.classList.contains("dark"), true);
  }
});
