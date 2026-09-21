# 景点新增链接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许备忘录景点分类从小红书分享文本中新增标题和链接。

**Architecture:** 复用景点 todo 的 `links` 数组。渲染层仅在景点分类展示链接表单；提交层解析分享文本并更新所选景点 todo，再交给既有 D1/local 持久化适配器。

**Tech Stack:** 静态 HTML、原生 JavaScript、Node 内置 test runner。

---

### Task 1: 锁定新增链接契约

**Files:**
- Modify: `tests/travel-prep-categories.test.cjs`

- [ ] **Step 1: Write the failing test**

```js
test("scenic memo entry parses a pasted Xiaohongshu share into the selected scenic links", () => {
  assert.match(app, /function parseScenicShareText\(value\)/);
  assert.match(app, /data-scenic-link-target/);
  assert.match(app, /data-scenic-link-share/);
  assert.match(app, /data-scenic-link-submit/);
  assert.match(app, /target\.links\.push\(parsed\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: the new test fails because the parser and form attributes do not exist.

### Task 2: Render and save scenic links

**Files:**
- Modify: `index.html:154-168`
- Modify: `app.js:1128-1134, 1910-1926, 2481-2540`

- [ ] **Step 1: Add the parser and scenic form rendering**

```js
function parseScenicShareText(value) {
  const match = String(value || "").match(/https?:\/\/[^\s)]+/);
  if (!match) return null;
  const title = String(value || "").slice(0, match.index).trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1) || "";
  return title ? { title, url: match[0] } : null;
}
```

- [ ] **Step 2: Bind the submit action**

```js
target.links = todoLinksFor(target);
target.links.push(parsed);
saveSharedChange("todos", target).catch(console.error);
```

- [ ] **Step 3: Run focused test to verify it passes**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: all travel preparation tests pass.

### Task 3: Verify runtime safety

**Files:**
- Modify: `app.js`
- Modify: `index.html`

- [ ] **Step 1: Run syntax and storage tests**

Run: `node --check app.js; node --test tests/runtime/runtime-storage.test.cjs; npm run validate`

Expected: commands succeed; validation may retain the known informational incomplete-state warning.

- [ ] **Step 2: Check patch whitespace**

Run: `git diff --check`

Expected: no whitespace errors.
