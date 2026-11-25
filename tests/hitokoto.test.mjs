import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { siteConfig } from "../src/config.ts";

const source = await readFile(new URL("../src/scripts/hitokoto.ts", import.meta.url), "utf8");
const script = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;

/** 执行真实客户端模块，仅替代网络、字体和 DOM，避免测试依赖外网是否在线。 */
async function fixture(data, cached = false, options = {}) {
  const requests = [],
    writes = [],
    fonts = [],
    waits = [];
  const text = { textContent: '"cached"' },
    footer = { textContent: "—— Author" };
  const block = {
    dataset: cached
      ? {
          cacheDate: new Intl.DateTimeFormat("en-CA", { timeZone: siteConfig.timezone }).format(
            new Date(),
          ),
        }
      : {},
    get textContent() {
      return `${text.textContent}${footer.textContent}`;
    },
    querySelector: (selector) => (selector === ".hitokoto-text" ? text : footer),
    getBoundingClientRect: () =>
      options.visible ? { top: 100, bottom: 160 } : { top: -100, bottom: -1 },
  };
  const controller = new AbortController();
  const signal = controller.signal;
  let onIntersection;
  const imports = {
    "./lifecycle": { onPageLoad: (setup) => setup(signal) },
    "../config": { siteConfig },
    "./font-loading": {
      prepareBodyFonts: async (value) => {
        fonts.push(value);
      },
    },
  };
  runInNewContext(script, {
    exports: {},
    require: (name) => {
      assert.ok(name in imports);
      return imports[name];
    },
    document: { querySelector: () => block },
    getComputedStyle: () => ({ fontSize: "16px" }),
    localStorage: { setItem: (key, value) => writes.push({ key, value: JSON.parse(value) }) },
    URLSearchParams,
    AbortSignal,
    Error,
    TypeError,
    Date,
    Intl,
    innerHeight: 823,
    setTimeout: (callback, delay) => {
      waits.push(delay);
      const timer = { cancelled: false };
      queueMicrotask(() => {
        if (!timer.cancelled) {
          if (options.abortOnRetry) controller.abort();
          else callback();
        }
      });
      return timer;
    },
    clearTimeout: (timer) => {
      timer.cancelled = true;
    },
    IntersectionObserver: class {
      constructor(callback) {
        onIntersection = callback;
      }
      observe() {}
      disconnect() {}
    },
    fetch: async (url) => {
      requests.push(new URL(url));
      if (requests.length <= (options.failures ?? 0))
        throw options.networkError ?? new TypeError("Failed to fetch");
      const status = options.httpStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
          if (options.jsonError) throw options.jsonError;
          return data;
        },
      };
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  return {
    requests,
    writes,
    fonts,
    waits,
    dataset: block.dataset,
    leaveViewport: () => onIntersection?.([{ isIntersecting: false }]),
    get text() {
      return text.textContent;
    },
  };
}

test("一言请求以重复 c 参数限定四类，校验响应后连同分类缓存并准备字体", async () => {
  for (const type of ["d", "h", "i", "k"]) {
    const f = await fixture({ type, hitokoto: "测试句子", from: "作品", from_who: "作者" });
    assert.equal(f.requests.length, 1);
    const url = f.requests[0];
    assert.equal(url.origin, "https://v1.hitokoto.cn");
    assert.equal(url.searchParams.get("encode"), "json");
    assert.equal(url.searchParams.get("charset"), "utf-8");
    assert.deepEqual(url.searchParams.getAll("c"), ["d", "h", "i", "k"]);
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].key, "hitokoto_cache");
    assert.equal(f.writes[0].value.type, type);
    assert.equal(f.writes[0].value.text, "测试句子");
    assert.deepEqual(f.fonts, ["测试句子作品作者"]);
    assert.equal(f.text, '"测试句子"');
  }
});

test("其他分类、缺失分类和空句子不会展示或写入每日缓存", async () => {
  const invalid = [undefined, "a", "b", "c", "e", "f", "g", "j", "l"].map((type) => ({
    type,
    hitokoto: "不允许的句子",
  }));
  invalid.push({ type: "i", hitokoto: " " });
  for (const data of invalid) {
    const f = await fixture(data);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.fonts, []);
    assert.equal(f.text, '"Simplicity is the ultimate sophistication."');
  }
});

test("已同步恢复的当天有效缓存不重新请求，但仍准备所需字体", async () => {
  const f = await fixture(null, true);
  assert.deepEqual(f.requests, []);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.fonts, ['"cached"—— Author']);
  assert.equal(f.text, '"cached"');
  assert.equal(f.dataset.hitokotoState, "cached");
});

test("网络失败或超时后只延迟重试一次，恢复后正常缓存及显示", async () => {
  for (const networkError of [
    new TypeError("Failed to fetch"),
    new DOMException("Timed out", "TimeoutError"),
  ]) {
    const f = await fixture({ type: "k", hitokoto: "重试成功" }, false, {
      failures: 1,
      networkError,
    });
    assert.equal(f.requests.length, 2);
    assert.deepEqual(f.waits, [1000]);
    assert.equal(f.writes.length, 1);
    assert.equal(f.text, '"重试成功"');
    assert.equal(f.dataset.hitokotoState, "ready");
    assert.equal(f.dataset.hitokotoAttempts, "2");
  }
});

test("连续网络失败后结束重试并保留可诊断的回退原因", async () => {
  const f = await fixture(null, false, { failures: 10 });
  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.waits, [1000]);
  assert.deepEqual(f.writes, []);
  assert.equal(f.text, '"Simplicity is the ultimate sophistication."');
  assert.equal(f.dataset.hitokotoState, "fallback");
  assert.match(f.dataset.hitokotoError, /TypeError: Failed to fetch/);
});

test("换页中止重试等待后不发出第二次请求，也不写入缓存", async () => {
  const f = await fixture(null, false, { failures: 1, abortOnRetry: true });
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.fonts, []);
});

test("HTTP 或 JSON 格式错误不触发网络重试", async () => {
  for (const options of [{ httpStatus: 503 }, { jsonError: new SyntaxError("Invalid JSON") }]) {
    const f = await fixture(null, false, options);
    assert.equal(f.requests.length, 1);
    assert.deepEqual(f.waits, []);
    assert.equal(f.dataset.hitokotoState, "fallback");
  }
});

test("请求成功并准备字体后仍保留原有的移出视口更新规则", async () => {
  const f = await fixture({ type: "i", hitokoto: "新句子" }, false, { visible: true });
  assert.equal(f.writes.length, 1);
  assert.equal(f.dataset.hitokotoState, "deferred");
  assert.equal(f.text, '"cached"');
  f.leaveViewport();
  assert.equal(f.text, '"新句子"');
  assert.equal(f.dataset.hitokotoState, "ready");
});
