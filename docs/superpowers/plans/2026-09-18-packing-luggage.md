# 行囊清单与行李配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将逐项川西行囊清单和可编辑、可筛选的五件行李缩略图加入旅行页。

**Architecture:** `trip-data.json` 为每项初始行囊保存分类和用途键。`app.js` 根据用途键生成缩略图、组合用途与分类筛选，并将用途名称保存在浏览器本地。现有行囊列表负责继续显示、勾选、编辑和删除。

**Tech Stack:** 静态 HTML、CSS、原生 JavaScript、Node 内置测试、Playwright。

---

### Task 1: 定义用途筛选的回归测试

**Files:**
- Modify: `tests/travel-prep-categories.test.cjs`
- Test: `tests/travel-prep-categories.test.cjs`

- [ ] **Step 1: 写入失败测试**

```js
test("packing exposes five editable luggage filters", () => {
  assert.match(html, /id="packing-luggage-filters"/);
  assert.match(app, /PACKING_LUGGAGE/);
  assert.match(app, /data-packing-luggage/);
  assert.match(app, /data-packing-luggage-label/);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: 新测试因缺少 `packing-luggage-filters` 失败。

- [ ] **Step 3: 提交测试前的失败结果不提交到 Git**

测试只用于确认需求尚未实现；进入下一任务后和生产代码一并提交。

### Task 2: 实现行李缩略图和用途名称编辑

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/travel-prep-categories.test.cjs`

- [ ] **Step 1: 添加五件行李的显示与筛选状态**

```js
const PACKING_LUGGAGE = [
  { key: "clothes-case", icon: "🧳", label: "衣物与穿搭行李箱" },
  { key: "care-case", icon: "🧳", label: "洗护与防晒行李箱" },
  { key: "medicine-pack", icon: "🎒", label: "药品与急救背包" },
  { key: "camera-pack", icon: "🎒", label: "电子与拍摄设备背包" },
  { key: "daily-bag", icon: "👜", label: "证件与生活杂物挎包" }
];
```

- [ ] **Step 2: 在行囊标题下渲染 `#packing-luggage-filters`**

每件行李使用 `data-packing-luggage`，显示筛选数量；管理区使用 `data-packing-luggage-label` 编辑显示名称。

- [ ] **Step 3: 让列表同时按类别和行李筛选**

```js
const visibleTodos = categoryTodos.filter((todo) =>
  (!state.selectedPackingSubcategories.size || state.selectedPackingSubcategories.has(normalizeTodoSubcategory(todo))) &&
  (!state.selectedPackingLuggage || todo.luggage === state.selectedPackingLuggage)
);
```

- [ ] **Step 4: 运行绿色测试**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: 所有测试通过。

### Task 3: 写入逐项初始行囊数据

**Files:**
- Modify: `trip-data.json`
- Modify: `tests/travel-prep-categories.test.cjs`
- Test: `tests/travel-prep-categories.test.cjs`

- [ ] **Step 1: 添加失败数据测试**

```js
test("packing data keeps supplied items one per row and assigns each luggage", () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "trip-data.json"), "utf8"));
  const packing = data.preTrip.packingItems.filter((item) => item.category === "packing");
  assert.ok(packing.some((item) => item.text === "身份证" && item.luggage === "daily-bag"));
  assert.ok(packing.some((item) => item.text === "三合一冲锋衣（抓绒一件，外壳两件）"));
  assert.ok(packing.some((item) => item.text === "一次性马桶垫（2个）"));
});
```

- [ ] **Step 2: 运行失败测试**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: 因尚无逐项记录与 `luggage` 键失败。

- [ ] **Step 3: 替换七条概括型初始行囊数据**

为用户提供的每项物品创建独立记录，保存分类、用途键和 `completed: false`。

- [ ] **Step 4: 运行绿色测试和数据校验**

Run: `node --test tests/travel-prep-categories.test.cjs; npm run validate`

Expected: 测试全部通过，`validate-lite: PASS`。

### Task 4: 浏览器验证与发布

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 用 Playwright 验证**

打开 `#packing`，确认五件行李出现；点击“药品与急救背包”后仅显示该用途；编辑用途名称、勾选物品和删除入口均可用。

- [ ] **Step 2: 更新缓存版本并做最终检查**

Run: `node --check app.js; node --test tests/travel-prep-categories.test.cjs; npm run validate`

Expected: 三个命令通过。

- [ ] **Step 3: 提交和发布**

Run: `git add app.js index.html styles.css trip-data.json tests/travel-prep-categories.test.cjs docs/superpowers && git commit -m "feat: add luggage packing organizer" && git push origin main && npx wrangler pages deploy . --project-name western-sichuan-road-trip-2026 --branch main`

Expected: GitHub main 与 Cloudflare Pages 都包含新版本。
