/** 首页附加子集与完整正文分片分开命名，避免显式 load 同时加载重叠字形。 */
export const HOME_FONT = "LXGW WenKai GB Screen Home";
export const BODY_FONT = "LXGW WenKai GB Screen";

/** 内页复用已有链接；首页仅在缺字时把配置转换成真实的样式链接。 */
function fullFontSheet(): HTMLLinkElement | null {
  const existing = document.querySelector<HTMLLinkElement>("link[data-fonts-full]");
  if (existing) return existing;
  const config = document.querySelector<HTMLMetaElement>('meta[name="crepusopia-fonts-full"]');
  if (!config) return null;
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.media = "all";
  sheet.href = config.content;
  sheet.dataset.fontsFull = "";
  sheet.setAttribute("data-astro-transition-persist", config.content);
  // 同一任务内插入并注册下方监听；缓存命中时 load 也在后续任务中触发。
  config.after(sheet);
  return sheet;
}

/** 在展示动态文字前准备实际需要的字体；开发环境没有首页子集时沿用完整字库。 */
export async function prepareBodyFonts(text: string, size: string, signal: AbortSignal) {
  if (signal.aborted) return;
  const home = [...document.fonts].find(
    (face) => face.family.replace(/^["']|["']$/g, "") === HOME_FONT,
  );
  // 范围直接读取当前页面的 face，换页、更新文章后无需另行维护字符名单。
  const ranges = (home?.unicodeRange ?? "")
    .split(",")
    .filter(Boolean)
    .map((range) => {
      const [start, end = start] = range.trim().slice(2).split("-");
      return [parseInt(start, 16), parseInt(end, 16)];
    });
  // DOM 文本中的换行、制表等控制字符不需要字形，不能误触发完整映射。
  const characters = [...new Set(Array.from(text.replace(/[\u0000-\u001f\u007f]/g, "")))];
  const missing = characters.filter((char) => {
    const code = char.codePointAt(0)!;
    return !ranges.some(([start, end]) => start <= code && code <= end);
  });
  if (home && missing.length < characters.length) {
    // 直接加载这个 face；FontFaceSet.load 会把同家族的重叠范围一起加载。
    await home.load().catch(() => {});
  }
  if (!missing.length || signal.aborted) return;

  const sheet = fullFontSheet();
  if (sheet && !sheet.sheet && !sheet.dataset.fontsReady) {
    // 仅未覆盖的字符需要等待完整声明；加载失败或换页均解除等待。
    await new Promise<void>((resolve) => {
      const done = () => {
        sheet.removeEventListener("load", loaded);
        sheet.removeEventListener("error", failed);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const loaded = () => {
        sheet.dataset.fontsReady = "true";
        done();
      };
      const failed = () => {
        sheet.dataset.fontsReady = "failed";
        done();
      };
      // 多个调用可共同等待同一链接，取消某一调用不会取消其余加载。
      sheet.addEventListener("load", loaded, { once: true });
      sheet.addEventListener("error", failed, { once: true });
      signal.addEventListener("abort", done, { once: true });
    });
  }
  if (signal.aborted) return;
  await document.fonts.load(`${size} "${BODY_FONT}"`, missing.join("")).catch(() => {});
}
