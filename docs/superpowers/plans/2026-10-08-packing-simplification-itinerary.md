# 行囊清单精简与前两日行程调整实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精简行囊清单的用户入口，并将 Day 1、Day 2 改为最新路线。

**Architecture:** 从 HTML 导航和行囊明细渲染中移除不再需要的入口，不删除底层已保存的历史数据。直接更新 `trip-data.json` 的 Day 1/2 节点，使时间线、路线和地点列表从同一数据源读取新路线。

**Tech Stack:** 原生 HTML/JavaScript、JSON 行程数据、Node.js 内置测试。

---

### Task 1: 精简行囊清单界面

**Files:**
- Modify: `index.html:36-43,119-150`
- Modify: `app.js:121,1805,1925,2053-2058,3110-3116,3179-3189`
- Test: `tests/travel-prep-categories.test.cjs:53-63,92-99`

- [ ] **Step 1: 写入失败回归测试**

```js
test("packing keeps only overview and details, without luggage actions", () => {
  assert.doesNotMatch(html, /href="#packing-purchase"/);
  assert.doesNotMatch(html, /href="#packing-check"/);
  assert.doesNotMatch(html, /id="packing-luggage-filters"/);
  assert.doesNotMatch(app, /data-packing-find/);
  assert.doesNotMatch(app, /data-packing-container/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: 新增测试因旧导航和操作入口仍存在而失败。

- [ ] **Step 3: 最小化移除用户入口**

删除采购、检查的导航和内容容器；删除行囊明细的行囊用途筛选；更多菜单仅保留编辑、复制、删除。同步删除无入口的 hash 路由、查找和转移事件处理。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: 所有页面测试通过。

### Task 2: 更新 Day 1 与 Day 2 路线

**Files:**
- Modify: `trip-data.json:178-319`
- Test: `tests/travel-prep-categories.test.cjs:187-199`

- [ ] **Step 1: 写入失败回归测试**

```js
assert.ok(dayOne.schedule.some((item) => item.time === "17:15" && item.text === "从康定县城出发前往新都桥。"));
assert.ok(!dayOne.schedule.some((item) => item.text.includes("红海子")));
assert.deepEqual(dayTwo.locations, ["新都桥", "塔公镇", "炉霍县", "甘孜县"]);
assert.ok(dayTwo.schedule.some((item) => item.text === "抵达塔公镇。"));
assert.ok(dayTwo.schedule.some((item) => item.text === "从塔公镇出发前往炉霍县。"));
assert.ok(dayTwo.schedule.some((item) => item.text === "从炉霍县出发前往甘孜县。"));
assert.ok(dayTwo.schedule.some((item) => item.text === "抵达甘孜县。"));
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: 测试因 Day 1 红海子与 Day 2 旧路线仍存在而失败。

- [ ] **Step 3: 用新路线替换原始行程节点**

Day 1 保留 17:15 时间并改为直达新都桥，删除红海子到访和二次出发节点。Day 2 保留现有时间节点，改用塔公镇、炉霍县、甘孜县并移除噶玛拉咖啡馆、道孚县和格萨尔王城。

- [ ] **Step 4: 运行完整验证并提交**

Run: `node --test tests/travel-prep-categories.test.cjs && node --test tests/runtime/runtime-storage.test.cjs && npm run validate`

Expected: 全部通过。

```bash
git add index.html app.js trip-data.json tests/travel-prep-categories.test.cjs docs/superpowers/plans/2026-10-08-packing-simplification-itinerary.md
git commit -m "feat: simplify packing and update itinerary"
```
