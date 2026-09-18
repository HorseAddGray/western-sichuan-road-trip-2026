# 行囊物品属性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让行囊与采购项支持短类别、人物归属、物品属性及仅消耗品可见的可用次数。

**Architecture:** 保留现有 `todo` 和 `packingPurchases` 本地数据结构，只增加 `property` 字段并将次数绑定到 `consumable`。`app.js` 负责渲染、条件显示和提交，`index.html` 提供表单和筛选说明。

**Tech Stack:** 原生 HTML、CSS、JavaScript、Node 测试、Playwright。

---

### Task 1: 锁定数据与表单契约

**Files:**
- Modify: `tests/travel-prep-categories.test.cjs`

- [ ] **Step 1: 写失败测试**

```js
test("packing records expose short categories and item properties", () => {
  assert.match(app, /documents: "证件"/);
  assert.match(app, /property: "common"/);
  assert.match(app, /data-packing-property/);
  assert.match(index, /data-packing-uses-row/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: 新增测试因短类别、属性字段和条件次数行尚不存在而失败。

### Task 2: 实现行囊属性与筛选说明

**Files:**
- Modify: `index.html:114-132`
- Modify: `app.js:823-1245`
- Modify: `styles.css`

- [ ] **Step 1: 以最小改动实现**

```js
const PACKING_PROPERTY_LABELS = { common: "常用", appliance: "电器", consumable: "消耗品" };
const usesTotal = property === "consumable" ? Number(usesInput.value) || 0 : 0;
```

新增表单选择归属与属性；属性变更时切换次数行的 `hidden`，并在物品卡显示属性标签。

- [ ] **Step 2: 运行测试确认通过**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: 全部测试通过。

### Task 3: 验证真实交互并发布

**Files:**
- Create: `work/verify-packing-item-properties.py`

- [ ] **Step 1: 用浏览器验证**

```python
page.goto("http://127.0.0.1:4173/#packing")
page.locator('[data-packing-property="consumable"]').select_option("consumable")
assert page.locator('[data-packing-uses-row]').is_visible()
page.locator('[data-packing-property="common"]').select_option("common")
assert page.locator('[data-packing-uses-row]').is_hidden()
```

- [ ] **Step 2: 检查并发布**

Run: `node --check app.js`, `npm run validate`, `git push origin main`, `npx wrangler pages deploy . --project-name western-sichuan-road-trip-2026 --branch main`

Expected: 校验通过，Cloudflare 返回新的部署网址。
