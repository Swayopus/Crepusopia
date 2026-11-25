import { onPageLoad } from "./lifecycle";
import { siteConfig } from "../config";
import { prepareBodyFonts } from "./font-loading";

onPageLoad((signal) => {
  const block = document.querySelector<HTMLElement>(".hitokoto-block");
  if (!block) return;
  delete block.dataset.hitokotoError;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: siteConfig.timezone }).format(
    new Date(),
  );
  // 组件内的同步脚本已在绘制前恢复当天缓存，不重复替换正文或发起请求。
  if (block.dataset.cacheDate === date) {
    block.dataset.hitokotoState = "cached";
    // 缓存可能含首页构建时没有的字；不请求 API，但仍需激活对应分片。
    void prepareBodyFonts(block.textContent ?? "", getComputedStyle(block).fontSize, signal);
    return;
  }
  const show = (text: string, from: string, author = "") => {
    if (signal.aborted) return;
    block.querySelector(".hitokoto-text")!.textContent = `"${text}"`;
    block.querySelector(".hitokoto-footer")!.textContent =
      `—— ${from}${author ? `(${author})` : ""}`;
  };
  block.dataset.hitokotoState = "loading";
  void (async () => {
    try {
      const params = new URLSearchParams({ encode: "json", charset: "utf-8" });
      // 多分类按官方格式重复 c 参数，不能用逗号拼成单个分类值。
      for (const category of siteConfig.hitokoto.categories) params.append("c", category);
      let data;
      for (let attempt = 0; ; attempt++) {
        try {
          signal.throwIfAborted();
          block.dataset.hitokotoAttempts = String(attempt + 1);
          const response = await fetch(`https://v1.hitokoto.cn/?${params}`, {
            signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
          });
          if (!response.ok) throw new Error(`一言请求失败（HTTP ${response.status}）`);
          data = await response.json();
          break;
        } catch (error) {
          // 只给网络错误/超时一次恢复机会；换页、HTTP 错误或无效 JSON 不重试。
          const retryable =
            error instanceof TypeError ||
            (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name));
          if (signal.aborted || attempt >= 1 || !retryable) throw error;
          block.dataset.hitokotoState = "retrying";
          await new Promise<void>((resolve) => {
            const done = () => {
              clearTimeout(timer);
              signal.removeEventListener("abort", done);
              resolve();
            };
            const timer = setTimeout(done, 1000);
            signal.addEventListener("abort", done, { once: true });
          });
        }
      }
      if (signal.aborted) return;
      if (
        typeof data.hitokoto !== "string" ||
        !data.hitokoto.trim() ||
        !siteConfig.hitokoto.categories.some((type) => type === data.type)
      )
        throw new Error("一言内容或分类无效");
      const from = typeof data.from === "string" ? data.from : "未知";
      const fromWho = typeof data.from_who === "string" ? data.from_who : "";
      if (!signal.aborted)
        try {
          localStorage.setItem(
            "hitokoto_cache",
            JSON.stringify({ date, type: data.type, text: data.hitokoto, from, fromWho }),
          );
        } catch {}
      block.dataset.hitokotoState = "preparing-fonts";
      await prepareBodyFonts(
        `${data.hitokoto}${from}${fromWho}`,
        getComputedStyle(block).fontSize,
        signal,
      );
      if (signal.aborted) return;
      const apply = () => {
        show(data.hitokoto, from, fromWho);
        block.dataset.hitokotoState = "ready";
      };
      const rect = block.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight) apply();
      else {
        block.dataset.hitokotoState = "deferred";
        // 内容长短由外部接口决定，字体就绪也不能避免换行差异。
        // 正在阅读时先缓存，等此区域离开视口再更新；下次访问在绘制前恢复。
        const observer = new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting) {
            apply();
            observer.disconnect();
          }
        });
        observer.observe(block);
        signal.addEventListener("abort", () => observer.disconnect(), { once: true });
      }
    } catch (error) {
      if (signal.aborted) return;
      block.dataset.hitokotoState = "fallback";
      block.dataset.hitokotoError =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      show("Simplicity is the ultimate sophistication.", "Leonardo da Vinci");
    }
  })();
});
