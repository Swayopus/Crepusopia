import { onPageLoad } from "./lifecycle";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  // 非安全上下文或剪贴板权限不可用时，保留传统复制回退。
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.cssText = "position:fixed;opacity:0";
  document.body.append(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
onPageLoad((signal) => {
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  document.addEventListener(
    "click",
    async (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLElement>(".copy-row, .copy-all-btn");
      if (!button?.dataset.copy) return;
      const ok = await copyText(button.dataset.copy);
      if (signal.aborted) return;
      if (!ok) {
        button.title = "复制失败，请手动选择信息复制";
        return;
      }
      const pill = button.querySelector(".copy-pill");
      const label = button.querySelector(".copy-label");
      if (pill) pill.textContent = "Copied";
      if (label) label.textContent = "Copied";
      // 每个按钮只保留最后一次反馈；已结束的定时器不留在集合中。
      clearTimeout(timers.get(button));
      timers.set(
        button,
        setTimeout(() => {
          timers.delete(button);
          if (pill) pill.textContent = "Copy";
          if (label) label.textContent = "Copy All";
        }, 1500),
      );
    },
    { signal },
  );
  return () => timers.forEach((timer) => clearTimeout(timer));
});
