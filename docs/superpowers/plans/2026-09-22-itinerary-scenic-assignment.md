# 每日行程关联景点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让每日行程标题可以单选关联一个备忘录景点，并从带星标的标题跳转至该景点。

**Architecture:** 在既有 `itineraryState` 中新增 `scenicAssignments` 映射，键使用既有 `scheduleCompletionKey`，值保存景点分组名称。`dayCard` 根据映射渲染星标标题，固定右键/长按菜单写入映射；跳转复用 `openItineraryScenicMemo`。

**Tech Stack:** 原生 JavaScript、静态 HTML/CSS、Node 内置测试、Playwright。

---

### Task 1: 添加关联状态与失败测试

**Files:**
- Modify: `app.js:10-20,600-690`
- Modify: `tests/travel-prep-categories.test.cjs`

- [ ] **Step 1: 写失败测试**

```js
test("daily itinerary stores one manually selected scenic destination per time node", () => {
  assert.match(app, /scenicAssignments: \{\}/);
  assert.match(app, /function itineraryScenicAssignmentFor\(key\)/);
  assert.match(app, /state\.itineraryState\.scenicAssignments\[key\]/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests\travel-prep-categories.test.cjs`

Expected: 新测试因缺少 `scenicAssignments` 与读取函数失败。

- [ ] **Step 3: 实现最小数据层**

```js
itineraryState: { completions: {}, notes: {}, ratings: {}, scenicAssignments: {} },

function itineraryScenicAssignmentFor(key) {
  const group = state.itineraryState.scenicAssignments?.[key];
  return typeof group === "string" && group.trim() ? group : "";
}
```

读取旧状态时确保 `scenicAssignments` 为对象。

- [ ] **Step 4: 运行测试确认通过并提交**

Run: `node --test tests\travel-prep-categories.test.cjs`

Commit: `git add app.js tests/travel-prep-categories.test.cjs && git commit -m "feat: store itinerary scenic assignments"`

### Task 2: 渲染星标标题与选择菜单

**Files:**
- Modify: `app.js:680-995`
- Modify: `index.html:88-96`
- Modify: `styles.css:208-260,672-680`
- Modify: `tests/travel-prep-categories.test.cjs`

- [ ] **Step 1: 写失败测试**

```js
test("daily itinerary titles select one scenic memo destination from a context menu", () => {
  assert.match(html, /id="itinerary-scenic-menu"/);
  assert.match(app, /data-itinerary-scenic-assign/);
  assert.match(app, /data-itinerary-scenic-clear/);
  assert.match(app, /data-itinerary-scenic-menu-open/);
  assert.match(app, /itineraryScenicAssignmentFor\(completionKey\)/);
  assert.match(styles, /\.itinerary-scenic-menu \{/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests\travel-prep-categories.test.cjs`

Expected: 新测试因缺少景点菜单和标题标记失败。

- [ ] **Step 3: 实现最小 UI 与事件**

在 `#itinerary-note-menu` 后新增 `<div class="itinerary-scenic-menu" id="itinerary-scenic-menu" role="menu" hidden></div>`。

`dayCard` 用 `itineraryScenicAssignmentFor(completionKey)` 决定是否渲染 `⭐` 和 `data-itinerary-scenic-open`。标题总是带 `data-itinerary-scenic-menu-open`，可右键/长按打开菜单。菜单列出当前 `notice/scenic` 分组、提供清除按钮；选择或清除后保存状态并重新渲染。菜单外点击关闭，样式沿用旅途心情菜单尺寸。

- [ ] **Step 4: 运行测试确认通过并提交**

Run: `node --test tests\travel-prep-categories.test.cjs`

Commit: `git add app.js index.html styles.css tests/travel-prep-categories.test.cjs && git commit -m "feat: assign scenic memos to itinerary nodes"`

### Task 3: 浏览器验证与发布

**Files:**
- Modify: `.superpowers/itinerary-mood-ui-check.py`

- [ ] **Step 1: 添加真实交互断言**

在已展开的节点标题上右键，断言 `#itinerary-scenic-menu` 可见；选择第一个 `data-itinerary-scenic-assign` 后断言标题有 `⭐`；点击该标题后断言备忘录目标有 `.notice-subcategory--target`。

- [ ] **Step 2: 运行浏览器测试**

Run: `python C:\Users\87477\.codex\skills\webapp-testing\scripts\with_server.py --server "python -m http.server 4183" --port 4183 -- python .superpowers\itinerary-mood-ui-check.py`

Expected: `browser check passed`。

- [ ] **Step 3: 完整验证、提交与发布**

Run: `node --test tests\travel-prep-categories.test.cjs && node --test tests\runtime\runtime-storage.test.cjs && node --check app.js && npm run validate && git diff --check`

Commit and deploy: `git add app.js index.html styles.css tests/travel-prep-categories.test.cjs .superpowers\itinerary-mood-ui-check.py && git commit -m "test: verify itinerary scenic assignment" && git push origin main && npx wrangler pages deploy . --project-name western-sichuan-road-trip-2026 --branch main --commit-dirty=true`
