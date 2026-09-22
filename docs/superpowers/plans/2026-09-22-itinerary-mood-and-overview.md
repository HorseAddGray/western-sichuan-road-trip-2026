# Itinerary Mood and Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 分类记录每日旅途心情、改善日程待办触控，并消除行囊总览的无标签重复项。

**Architecture:** 扩展现有 `itineraryState.notes` 记录字段而不引入新存储集合；复用已有评分状态。景点链接继续写入景点 todo 的 `links` 数组；总览渲染层过滤无标签子项。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Node 内置测试。

---

### Task 1: 写失败测试

**Files:**
- Modify: `tests/travel-prep-categories.test.cjs`

- [ ] **Step 1: 增加记录、总览和链接入口的断言**

```js
assert.match(app, /itinerary-mood-type/);
assert.match(app, /data-itinerary-mood-name/);
assert.match(app, /note\.createdAt/);
assert.match(app, /tag\.key\);/);
assert.match(html, /scenic-link-new-target/);
```

- [ ] **Step 2: 确认测试失败**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: new assertions fail because this UI and filtering do not yet exist.

### Task 2: 实现旅途心情和日程触控

**Files:**
- Modify: `app.js:564-608, 633-653, 758-859`
- Modify: `styles.css:208-247`
- Modify: `trip-data.json` 新都桥抵达节点

- [ ] **Step 1: 渲染和保存分类记录**

```js
const note = { id, type, name, text, createdAt };
notes.sort((first, second) => String(first.createdAt).localeCompare(String(second.createdAt)));
```

- [ ] **Step 2: 仅对美食、酒店、景点渲染评分**

```js
const rated = ["food", "hotel", "scenic"].includes(note.type);
```

- [ ] **Step 3: 扩大日程确认按钮并增加文本间距**

Update `.schedule-item`, `.schedule-item__toggle`, and `.schedule-item__check` without changing node completion storage.

### Task 3: 实现总览与链接表单调整

**Files:**
- Modify: `app.js:1642-1692, 1937-1943, 2548-2564`
- Modify: `index.html:169-174`
- Modify: `styles.css` 景点链接表单间距

- [ ] **Step 1: 过滤无标签总览子项**

```js
const tags = Object.values(category.tags).filter((tag) => tag.key);
```

- [ ] **Step 2: 支持新增景点链接目标**

Create a scenic todo from the entered scenic name before appending the parsed link.

### Task 4: 验证

**Files:**
- Test: `tests/travel-prep-categories.test.cjs`
- Test: `tests/runtime/runtime-storage.test.cjs`

- [ ] **Step 1: Run checks**

Run: `node --test tests/travel-prep-categories.test.cjs; node --test tests/runtime/runtime-storage.test.cjs; node --check app.js; npm run validate; git diff --check`

Expected: all tests pass and no whitespace errors appear.
