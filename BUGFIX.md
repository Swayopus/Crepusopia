# Bug 修复记录

## 2026-06-27

### 移动端 TOC 抽屉首次进入点不开

**现象：** 手机端首次进入文章页面（或刷新），右下角目录悬浮按钮点击无反应。切换一次页面后恢复正常。

**根因：** `TOC.astro` 的移动端目录初始化依赖 `DOMContentLoaded` 和 `astro:page-load` 两个事件。首次加载时两者均触发，`_tocMobileReady` 在第一次绑好 click handler 后被 `astro:page-load` 重置为 `false`，导致同一个 toggle 按钮绑了两次 handler —— 第一次打开抽屉，第二次立刻关闭，看起来像没反应。切页后只有 `astro:page-load` 触发，只绑一次，所以正常。

**修复：** 放弃模块级变量 `_tocMobileReady`，改为在 toggle 按钮 DOM 元素上打 `data-toc-bound="1"` 标记。该标记随 View Transition 导航后的新 DOM 自动消失，无需手动重置。`astro:page-load` 回调不再重置任何状态，直接调 `bootTocMobile()`，由标记判断是否需重新绑定。

**影响文件：** `src/components/TOC.astro`

### 移动端侧栏打开后顶栏漂移消失

**现象：** 手机端页面下滑一段距离后，点击汉堡按钮打开侧栏，sticky 顶栏消失。将背景页划回顶部后顶栏才重新出现。

**根因：** 旧方案用 `document.body.style.overflow = "hidden"` 锁背景滚动。这导致 body 的滚动容器重置，`position: sticky` 的顶栏跟随滚动位置跳到顶部（在 fixed 侧栏的 z-index 之上不可见）。

**修复：** 改为保存/恢复 `window.scrollY` + `body { position: fixed; top: -scrollY }` 的方案。打开侧栏时锁住 body 位置但不丢失滚动上下文，关闭时恢复。

**影响文件：** `src/layouts/Layout.astro`
