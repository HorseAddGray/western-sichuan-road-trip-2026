# 旅途心情归属实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在每日行程的旅途心情中保存归属人，并按“归属人：内容”展示。

**Architecture:** 在现有 itinerary state 的心情记录上新增可选 `owner` 字段。弹窗表单默认选择马甲；渲染层只在存在 owner 时添加前缀，以兼容已有记录。

**Tech Stack:** 原生 JavaScript、HTML 字符串模板、Node.js 内置测试。

---

### Task 1: 为旅途心情增加归属字段

**Files:**
- Modify: `app.js:71,682-696,881-946`
- Test: `tests/travel-prep-categories.test.cjs:256-265`

- [ ] **Step 1: 写入失败回归测试**

```js
test("daily itinerary moods store an owner and display it before the content", () => {
  assert.match(app, /data-itinerary-mood-owner/);
  assert.match(app, /owner: "majia"/);
  assert.match(app, /\$\{escapeHtml\(itineraryMoodOwnerLabel\(note\.owner\)\)\}：/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: 新增测试因缺少归属字段而失败。

- [ ] **Step 3: 实现最小数据与展示逻辑**

```js
const ITINERARY_MOOD_OWNERS = Object.freeze({ majia: "马甲", zaizai: "仔仔" });

function itineraryMoodOwnerLabel(owner) {
  return ITINERARY_MOOD_OWNERS[owner] || "";
}
```

在表单加入 `name="owner"` 的下拉框；新建默认值为 `majia`；保存时把 `owner` 写入 note。渲染内容时仅在 `owner` 有效的情况下添加“归属人：”前缀。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: 所有测试通过。

- [ ] **Step 5: 提交**

```bash
git add app.js tests/travel-prep-categories.test.cjs docs/superpowers/plans/2026-09-28-itinerary-mood-owner.md
git commit -m "feat: assign itinerary moods to travelers"
```
