# 行囊行布局调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 调整行囊与注意事项的折叠标题、行内更多操作和新增物品表单，使其在桌面与移动端都保持清晰对齐。

**Architecture:** 保留既有按钮事件和表单字段 ID，仅重排可折叠标题的内部元素与新增表单的字段容器。CSS 负责桌面单行网格及窄屏回退；不改变数据、筛选、折叠状态或提交逻辑。

**Tech Stack:** 原生 HTML、CSS、JavaScript 字符串模板、Node 内置测试运行器。

---

### Task 1: 为三项布局要求添加回归断言

**Files:**
- Modify: `tests/travel-prep-categories.test.cjs`
- Modify: `app.js`
- Modify: `index.html`
- Modify: `styles.css`

- [x] **Step 1: 写入失败测试**

在 `tests/travel-prep-categories.test.cjs` 追加：

```js
test("packing and notice category headings keep their chevrons beside the category name", () => {
  assert.match(app, /packing-category-toggle.*packing-category-toggle__title.*<i aria-hidden="true">⌄<\/i>.*<small>/);
  assert.match(app, /notice-subcategory__toggle.*notice-subcategory__title.*<i aria-hidden="true">⌄<\/i>.*<small>/);
});

test("packing rows keep the overflow trigger inside the row and add form fields on one desktop row", () => {
  assert.match(styles, /\.todo-item \{[^}]*padding-inline/);
  assert.match(html, /packing-form-selectors--add[\s\S]*packing-input[\s\S]*packing-add-todo-form__actions/);
  assert.match(styles, /\.packing-form-selectors--add \{[^}]*grid-template-columns:.*minmax\(180px, 2fr\).*auto/);
});
```

- [x] **Step 2: 运行测试确认失败**

运行：

```powershell
node --test tests/travel-prep-categories.test.cjs
```

预期：新增的类别标题断言失败，因为当前箭头位于完成数之后。

- [x] **Step 3: 最小实现**

在 `app.js` 的 `packingCategoryMarkup` 和 `noticeItemMarkup` 字符串中，把标题部分替换为：

```js
<span class="packing-category-toggle__title">${label}<i aria-hidden="true">⌄</i></span><small>${done} / ${items.length}</small>
```

及：

```js
<span class="notice-subcategory__title">${escapeHtml(label)}<i aria-hidden="true">⌄</i></span><small>${groupedItems.length} 条</small>
```

在 `index.html` 中把 `#packing-input` 的标签移动到 `.packing-form-selectors--add` 内，并把 `.packing-add-todo-form__actions` 移到它之后；保留所有现有 id、label 与提交按钮文字。

在 `styles.css` 中应用：

```css
.packing-category-toggle, .notice-subcategory__toggle { grid-template-columns: minmax(0, 1fr) auto; }
.packing-category-toggle__title, .notice-subcategory__title { display: inline-flex; align-items: center; gap: 5px; }
.packing-category-toggle__title i, .notice-subcategory__title i { width: 18px; }
.todo-item { padding-inline: 8px; box-sizing: border-box; }
.packing-form-selectors--add { grid-template-columns: repeat(4, minmax(85px, 1fr)) minmax(180px, 2fr) auto; }
```

并在现有 `@media (max-width: 699px)` 中覆盖新增网格为两列，让名称字段占满整行、添加按钮保持可点击。

- [x] **Step 4: 运行测试确认通过**

运行：

```powershell
node --test tests/travel-prep-categories.test.cjs
```

预期：所有断言通过。

- [x] **Step 5: 提交布局修改**

```powershell
git add app.js index.html styles.css tests/travel-prep-categories.test.cjs
git commit -m "style: align packing rows and category toggles"
```

### Task 2: 全量验证并发布

**Files:**
- Modify: `index.html`

- [x] **Step 1: 更新缓存版本**

把 `index.html` 中 `styles.css` 与 `app.js` 的查询版本递增，确保已打开网页的浏览器重新读取布局资源。

- [x] **Step 2: 运行完整验证**

运行：

```powershell
node --test tests/travel-prep-categories.test.cjs
node --test tests/runtime/runtime-storage.test.cjs
npm run validate
```

预期：两个测试文件均无失败，生成校验输出 `validate-lite: PASS`。

- [ ] **Step 3: 发布并检查公开页资源**

运行：

```powershell
npx wrangler pages deploy . --project-name western-sichuan-road-trip-2026 --branch main
Invoke-WebRequest -Uri https://western-sichuan-road-trip-2026.pages.dev/ -UseBasicParsing
```

预期：部署成功，公开 HTML 含有新的 `styles.css` 与 `app.js` 版本号。

- [ ] **Step 4: 提交缓存版本并推送**

```powershell
git add index.html docs/superpowers/plans/2026-09-20-packing-row-alignment.md
git commit -m "chore: publish aligned packing layout"
git push origin main
```
