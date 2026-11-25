import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";
import { categoryKey } from "../src/utils/url.ts";

// 运行真实标签模块与生命周期模块；只模拟 DOM 接口和 Astro 事件，不模拟渲染/动画。
const sources = await Promise.all(
  ["lifecycle", "tags"].map(async (name) => {
    const source = await readFile(new URL(`../src/scripts/${name}.ts`, import.meta.url), "utf8");
    return ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
    }).outputText;
  }),
);

function tagDocument(enabled = true) {
  const document = new EventTarget();
  // Node EventTarget 没有 DOM 树；显式分发捕获与冒泡，复现 Astro 先注册监听的情形。
  const captureClicks = new EventTarget();
  const addListener = document.addEventListener.bind(document);
  const dispatch = document.dispatchEvent.bind(document);
  document.addEventListener = (type, listener, options) => {
    if (type === "click" && (options === true || options?.capture)) {
      captureClicks.addEventListener(type, listener, options);
    } else {
      addListener(type, listener, options);
    }
  };
  document.dispatchEvent = (event) => {
    if (event.type === "click") captureClicks.dispatchEvent(event);
    return dispatch(event);
  };
  // Astro 的冒泡监听会先判断 defaultPrevented；只在全部分发后检查会漏掉本次回归。
  const routerClickStates = [];
  document.addEventListener("click", (event) => routerClickStates.push(event.defaultPrevented));
  const posts = {
    children: [],
    replaceChildren(...children) {
      this.children = children;
    },
  };
  const count = { textContent: "" };
  let statusWrites = 0;
  let statusText = "";
  const status = {
    get textContent() {
      return statusText;
    },
    set textContent(value) {
      statusWrites++;
      statusText = value;
    },
  };
  const announcers = [];
  const addAnnouncer = () => {
    const node = {
      removed: false,
      remove() {
        this.removed = true;
      },
    };
    announcers.push(node);
  };
  const results = {
    hidden: true,
    classList: {
      toggle(_name, hidden) {
        results.hidden = hidden;
      },
    },
  };
  const pills = ["astro", "markdown", "é"].map((tag) => ({
    dataset: { tag },
    style: {},
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  }));
  const cloud = { querySelectorAll: () => pills };
  const templates = [
    { title: "A", tags: ["astro"], words: 10 },
    { title: "B", tags: ["markdown", " E\u0301 "], words: 5 },
    { title: "C", tags: ["astro", "markdown"], words: 20 },
  ].map(({ title, tags, words }) => ({
    dataset: { postTags: JSON.stringify(tags), words: String(words) },
    content: { cloneNode: () => ({ title }) },
  }));
  const nodes = {
    "#tag-cloud": cloud,
    "#tag-results": results,
    "#tag-posts": posts,
    "#tag-result-count": count,
    "#tag-result-status": status,
  };
  document.querySelector = (selector) => (enabled ? (nodes[selector] ?? null) : null);
  document.querySelectorAll = (selector) =>
    selector === ".astro-route-announcer"
      ? announcers.filter((node) => !node.removed)
      : enabled
        ? templates
        : [];
  return {
    document,
    posts,
    count,
    results,
    pills,
    status,
    addAnnouncer,
    routerClickStates,
    statusWrites: () => statusWrites,
  };
}

function fixture(path = "/blog/tags/") {
  const view = tagDocument();
  class Element {
    closest() {
      return this.link;
    }
  }
  const sandbox = {
    document: view.document,
    URL,
    AbortController,
    Element,
    location: { href: `https://example.com${path}` },
    scrollX: 0,
    scrollY: 160,
    scrollTo({ left, top }) {
      sandbox.scrollX = left;
      sandbox.scrollY = top;
    },
    history: new Proxy(
      {},
      {
        get() {
          throw new Error("标签模块不能自行操作历史记录");
        },
      },
    ),
  };
  const context = createContext(sandbox);
  function load(code, imports) {
    const exports = {};
    runInContext(`(function(require, exports) { ${code}\n})`, context)((name) => {
      assert.ok(name in imports, `意外依赖: ${name}`);
      return imports[name];
    }, exports);
    return exports;
  }
  const lifecycle = load(sources[0], {});
  load(sources[1], { "./lifecycle": lifecycle, "../utils/url": { categoryKey } });
  const emit = (type, values = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), values);
    view.document.dispatchEvent(event);
    return event;
  };
  return { ...view, sandbox, Element, emit };
}

test("标签切换复用当前 DOM 和加载器，保留点击位置；历史遍历保留路由器位置", async () => {
  const f = fixture();
  const from = new URL(f.sandbox.location.href);
  const to = new URL("?tag=astro", from);
  let fetched = false;
  const preparation = f.emit("astro:before-preparation", {
    from,
    to,
    loader: async () => {
      fetched = true;
    },
    newDocument: null,
  });
  await preparation.loader();
  assert.equal(fetched, false);
  assert.equal(preparation.newDocument, f.document);
  let swappedDocument = false;
  const swap = f.emit("astro:before-swap", {
    from,
    to,
    newDocument: f.document,
    navigationType: "push",
    swap: () => {
      swappedDocument = true;
    },
  });
  swap.swap();
  assert.equal(swappedDocument, false);
  assert.deepEqual(
    f.posts.children.map((post) => post.title),
    ["A", "C"],
  );
  assert.equal(f.status.textContent, "标签 astro：2 篇 · 共 30 字");
  const writes = f.statusWrites();
  f.sandbox.location.href = to.href;
  f.sandbox.scrollY = 0; // Astro 的 moveToLocation 默认重置位置。
  f.emit("astro:after-swap");
  f.emit("astro:page-load");
  assert.equal(f.statusWrites(), writes, "相同结果不应因 page-load 再次触发播报");
  assert.equal(f.sandbox.scrollY, 160);

  const back = f.emit("astro:before-swap", {
    from: to,
    to: from,
    newDocument: f.document,
    navigationType: "traverse",
    swap() {},
  });
  back.swap();
  f.sandbox.scrollY = 85; // Astro 从目标历史项恢复的位置不得被覆盖。
  f.emit("astro:after-swap");
  assert.equal(f.sandbox.scrollY, 85);
  assert.equal(f.results.hidden, true);
  assert.equal(f.status.textContent, "显示全部标签");
});

test("保留 body 的连续标签过渡不会累积 Astro 公告层", () => {
  const f = fixture();
  f.addAnnouncer();
  f.addAnnouncer();
  for (let index = 0; index < 6; index++) {
    // 对应 router.js 的 onPageLoad(); announce(); 顺序，包括迟到的旧公告。
    f.emit("astro:page-load");
    assert.equal(f.document.querySelectorAll(".astro-route-announcer").length, 0);
    f.addAnnouncer();
    assert.equal(f.document.querySelectorAll(".astro-route-announcer").length, 1);
  }
});

test("跨页返回在替换前完成过滤，文章导航仍使用原交换流程", () => {
  const f = fixture();
  const article = tagDocument(false);
  const tags = new URL(f.sandbox.location.href);
  const post = new URL("../posts/example/", tags);
  const originalSwap = () => {};
  const leave = f.emit("astro:before-swap", {
    from: tags,
    to: post,
    newDocument: article.document,
    navigationType: "push",
    swap: originalSwap,
  });
  assert.equal(leave.swap, originalSwap);

  const incoming = tagDocument();
  const back = f.emit("astro:before-swap", {
    from: post,
    to: new URL("?tag=%20E%CC%81%20", tags),
    newDocument: incoming.document,
    navigationType: "traverse",
    swap: originalSwap,
  });
  assert.equal(back.swap, originalSwap);
  assert.equal(incoming.count.textContent, "1 篇 · 共 5 字");
  assert.deepEqual(
    incoming.posts.children.map((item) => item.title),
    ["B"],
  );
  assert.equal(incoming.pills[2].attributes["aria-current"], "true");
});

test("重复标签在路由冒泡监听前取消，修饰键和其他标签点击仍放行", () => {
  const f = fixture("/blog/tags/?tag=astro");
  const target = new f.Element();
  target.link = { href: f.sandbox.location.href };
  assert.equal(f.emit("click").defaultPrevented, false);
  // Event.target 是只读属性；使用真实事件分发后由测试 Element 暴露 closest。
  const click = new Event("click", { cancelable: true });
  Object.defineProperty(click, "target", { value: target });
  f.document.dispatchEvent(click);
  assert.equal(click.defaultPrevented, true);
  assert.equal(f.routerClickStates.at(-1), true, "Astro 处理点击前就必须知道导航已取消");
  for (const properties of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ]) {
    const modified = new Event("click", { cancelable: true });
    Object.defineProperty(modified, "target", { value: target });
    Object.assign(modified, properties);
    f.document.dispatchEvent(modified);
    assert.equal(modified.defaultPrevented, false);
    assert.equal(f.routerClickStates.at(-1), false);
  }
  target.link = { href: new URL("?tag=markdown", f.sandbox.location.href).href };
  const other = new Event("click", { cancelable: true });
  Object.defineProperty(other, "target", { value: target });
  f.document.dispatchEvent(other);
  assert.equal(f.routerClickStates.at(-1), false, "其他标签仍交给路由器切换");
});
