import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { prepareBodyFonts, BODY_FONT, HOME_FONT } from "../src/scripts/font-loading.ts";

/** 记录实际准备了哪份字体；不把同族重叠匹配错误藏在统一的成功返回值中。 */
function fixture(
  t: TestContext,
  options: { home?: boolean; pending?: boolean; lazy?: boolean } = {},
) {
  const calls: { font: string; text: string }[] = [];
  let homeLoads = 0;
  const home = {
    family: `"${HOME_FONT}"`,
    unicodeRange: "U+20-7E, U+4F60, U+597D",
    load: async () => {
      homeLoads++;
      return home;
    },
  };
  const fonts = Object.assign(options.home === false ? [] : [home], {
    load: async (font: string, text: string) => {
      calls.push({ font, text });
      return [];
    },
  });
  let starts = 0;
  const attributes = new Map<string, string>();
  const sheet = Object.assign(new EventTarget(), {
    sheet: null,
    dataset: {} as { fontsFull?: string; fontsReady?: string },
    rel: "",
    media: "",
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  });
  Object.defineProperty(sheet, "href", {
    set(value: string) {
      starts++;
      attributes.set("href", value);
    },
  });
  let mounted = options.pending ? sheet : null;
  const config = options.lazy
    ? {
        content: "/_astro/fonts-test.css",
        after: () => {
          mounted = sheet;
        },
      }
    : null;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      fonts,
      querySelector: (selector: string) => (selector.startsWith("link") ? mounted : config),
      createElement: (name: string) => {
        assert.equal(name, "link");
        return sheet;
      },
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  });
  return { calls, home, sheet, homeLoads: () => homeLoads, starts: () => starts };
}

test("首页已覆盖的字只准备合并子集，不等待完整映射或请求重叠分片", { timeout: 2000 }, async (t) => {
  const f = fixture(t, { lazy: true });
  await prepareBodyFonts("你好 A", "16px", new AbortController().signal);
  assert.equal(f.homeLoads(), 1);
  assert.deepEqual(f.calls, []);
  assert.equal(f.starts(), 0);
});

test("DOM 缓存文本的换行和制表不会被当成缺字而下载完整映射", async (t) => {
  const f = fixture(t, { lazy: true });
  await prepareBodyFonts('\n\t"你好 A"\r\n', "16px", new AbortController().signal);
  assert.equal(f.homeLoads(), 1);
  assert.equal(f.starts(), 0);
  assert.deepEqual(f.calls, []);
});

test("并发缺字请求只激活一次映射，取消一方不阻断另一方", async (t) => {
  const f = fixture(t, { lazy: true });
  const controller = new AbortController();
  const first = prepareBodyFonts("𠀃", "16px", controller.signal);
  const second = prepareBodyFonts("𠀄", "18px", new AbortController().signal);
  assert.equal(f.starts(), 1);
  assert.equal(f.sheet.rel, "stylesheet");
  assert.equal(f.sheet.media, "all");
  assert.equal(f.sheet.getAttribute("data-astro-transition-persist"), "/_astro/fonts-test.css");
  controller.abort();
  await first;
  f.sheet.dispatchEvent(new Event("load"));
  await second;
  assert.equal(f.sheet.dataset.fontsReady, "true");
  assert.deepEqual(f.calls, [{ font: `18px "${BODY_FONT}"`, text: "𠀄" }]);
});

test("混合文本只把缺失字符交给完整分片，扩展汉字不拆成代理项", async (t) => {
  const f = fixture(t);
  await prepareBodyFonts("你好𠀃好𠀃", "18px", new AbortController().signal);
  assert.equal(f.homeLoads(), 1);
  assert.deepEqual(f.calls, [{ font: `18px "${BODY_FONT}"`, text: "𠀃" }]);
});

test("没有首页 face 的开发环境和内页使用完整分片", async (t) => {
  const f = fixture(t, { home: false });
  await prepareBodyFonts("你好𠀃", "18px", new AbortController().signal);
  assert.equal(f.homeLoads(), 0);
  assert.deepEqual(f.calls, [{ font: `18px "${BODY_FONT}"`, text: "你好𠀃" }]);
});

test("缺失字符等待完整映射加载后才准备字体", async (t) => {
  const f = fixture(t, { pending: true });
  const ready = prepareBodyFonts("好𠀃", "16px", new AbortController().signal);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(f.calls, []);
  f.sheet.dispatchEvent(new Event("load"));
  await ready;
  assert.deepEqual(f.calls, [{ font: `16px "${BODY_FONT}"`, text: "𠀃" }]);
});

test("换页中止完整映射等待，不再请求旧页面的字体", async (t) => {
  const f = fixture(t, { pending: true });
  const controller = new AbortController();
  const ready = prepareBodyFonts("好𠀃", "16px", controller.signal);
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.abort();
  await ready;
  f.sheet.dispatchEvent(new Event("load"));
  assert.deepEqual(f.calls, []);
});

test("映射和字体失败解除等待，交给浏览器正常字体回退", async (t) => {
  const f = fixture(t, { pending: true });
  f.home.load = async () => {
    throw new Error("字体不可用");
  };
  const ready = prepareBodyFonts("好𠀃", "16px", new AbortController().signal);
  await new Promise<void>((resolve) => setImmediate(resolve));
  f.sheet.dispatchEvent(new Event("error"));
  await ready;
  assert.deepEqual(f.calls, [{ font: `16px "${BODY_FONT}"`, text: "𠀃" }]);
});

test("进入准备前已中止时不加载任何字体", async (t) => {
  const f = fixture(t);
  const controller = new AbortController();
  controller.abort();
  await prepareBodyFonts("你好𠀃", "16px", controller.signal);
  assert.equal(f.homeLoads(), 0);
  assert.deepEqual(f.calls, []);
});
