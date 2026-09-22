# 备忘录位置归档与精确跳转 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精确定位星标行程关联景点，并让美食链接与景点链接按景点位置统一管理。

**Architecture:** `openItineraryScenicMemo` 在目标节点渲染与锚点导航完成后执行两帧后的居中滚动。链接表单逻辑抽象为「位置链接」模式，景点和美食共享景点归属、分享解析、文章排序和上下文菜单；分组排序沿用现有 `noticeGroupOrder`，扩展为所有备忘录类别可见的管理入口。

**Tech Stack:** 原生 JavaScript、静态 HTML/CSS、Node 内置测试、Playwright。

---

### Task 1: 精确定位星标行程跳转

**Files:**
- Modify: `app.js:695-710`
- Modify: `tests/travel-prep-categories.test.cjs`
- Modify: `.superpowers/itinerary-mood-ui-check.py`

- [ ] **Step 1: 写失败测试**

```js
test("starred itinerary links settle on the expanded scenic memo target", () => {
  assert.match(app, /requestAnimationFrame\(\(\) => requestAnimationFrame/);
  assert.match(app, /target\.scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests\travel-prep-categories.test.cjs`

Expected: 新测试因没有双帧定位逻辑失败。

- [ ] **Step 3: 最小实现与浏览器断言**

在 `openItineraryScenicMemo` 的渲染后使用嵌套 `requestAnimationFrame` 查找目标，居中滚动并添加高亮。浏览器脚本点击星标标题后断言目标可见且带 `.notice-subcategory--target`。

- [ ] **Step 4: 运行测试确认通过并提交**

Run: `node --test tests\travel-prep-categories.test.cjs`

Commit: `git add app.js tests/travel-prep-categories.test.cjs && git commit -m "fix: settle itinerary scenic navigation"`

### Task 2: 美食按归属景点管理链接

**Files:**
- Modify: `app.js:1699-1778,2117-2128,2448-2512,2773-2821`
- Modify: `index.html:174-180`
- Modify: `tests/travel-prep-categories.test.cjs`

- [ ] **Step 1: 写失败测试**

```js
test("food links use the scenic destination picker and shared link controls", () => {
  assert.match(app, /const isLocationLinks = \["scenic", "food"\]\.includes/);
  assert.match(app, /data-location-link-target/);
  assert.match(app, /activeCategory === "food"/);
  assert.match(app, /data-scenic-link-feature/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests\travel-prep-categories.test.cjs`

Expected: 新测试因美食仍使用普通信息表单失败。

- [ ] **Step 3: 实现共享位置链接模式**

将景点链接字段改为位置链接字段；当活跃类别为 `scenic` 或 `food` 时，表单展示「归属景点」选择器，数据源始终为景点分组。提交时保留活跃类别，`group` 写入选择的景点名称；既有文章渲染、加精、删除、右键/长按与拖动排序逻辑接受这两个类别。

- [ ] **Step 4: 运行测试确认通过并提交**

Run: `node --test tests\travel-prep-categories.test.cjs`

Commit: `git add app.js index.html tests/travel-prep-categories.test.cjs && git commit -m "feat: organize food links by scenic destination"`

### Task 3: 所有备忘录类别的子类别排序验证与发布

**Files:**
- Modify: `app.js:2127,2514-2550`
- Modify: `.superpowers/itinerary-mood-ui-check.py`

- [ ] **Step 1: 写失败测试**

```js
test("every memo category exposes a drag-managed subcategory order", () => {
  assert.match(app, /管理子类别排序/);
  assert.match(app, /state\.noticeGroupOrder\[state\.activeNoticeSubcategory\]/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests\travel-prep-categories.test.cjs`

Expected: 新测试因管理入口文案不明确失败。

- [ ] **Step 3: 实现、浏览器验证、发布**

将所有类别的管理入口统一为「管理子类别排序」，保留现有拖动保存逻辑。浏览器脚本验证美食选择归属景点、菜单在页面外点击关闭、星标目标居中可见。然后运行：`node --test tests\travel-prep-categories.test.cjs && node --test tests\runtime\runtime-storage.test.cjs && node --check app.js && npm run validate && git diff --check`。提交后推送主分支并用 `npx wrangler pages deploy . --project-name western-sichuan-road-trip-2026 --branch main --commit-dirty=true` 发布。
