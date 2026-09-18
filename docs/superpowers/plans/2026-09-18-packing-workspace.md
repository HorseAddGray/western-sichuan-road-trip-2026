# 行囊工作区 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用行囊明细、采购清单和检查行囊管理物品归属、位置、消耗和核对流程。

**Architecture:** 物品继续使用现有 `todos` 本地存储，增加标签、箱包位置、一次性次数和检查状态字段。采购项和收纳包定义保存在单独的本地存储键；页面只渲染当前页签的数据，避免影响注意事项。

**Tech Stack:** 原生 HTML、CSS、JavaScript、Node 内置测试、Playwright。

---

### Task 1: 添加工作区状态测试

**Files:**
- Modify: `tests/travel-prep-categories.test.cjs`
- Test: `tests/travel-prep-categories.test.cjs`

- [ ] 写入失败测试，断言页面存在 `packing-workspace-tabs`、`packing-purchase-list`、`packing-checker`，且应用含采购、检查和一次性用品的数据属性。
- [ ] 运行 `node --test tests/travel-prep-categories.test.cjs`，确认新测试失败。

### Task 2: 实现三个工作区和物品字段

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/travel-prep-categories.test.cjs`

- [ ] 添加三个页签及各自容器。
- [ ] 让行囊物品读取、编辑并保存 `owner`、`container`、`usesTotal`、`usesRemaining`、`checked` 字段。
- [ ] 添加马甲、仔仔、共同、待分配标签筛选和大箱包/收纳包两层筛选。
- [ ] 运行测试，确认通过。

### Task 3: 实现采购与检查流程

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Test: `tests/travel-prep-categories.test.cjs`

- [ ] 采购清单支持新增、删除和提交到行囊；提交项以待分配状态进入行囊。
- [ ] 检查模式支持开始重置、逐项确认和完成状态。
- [ ] 一次性用品支持使用一次和用尽样式。
- [ ] 运行测试和浏览器验证。

### Task 4: 发布

**Files:**
- Modify: `index.html`

- [ ] 更新资源缓存版本。
- [ ] 运行 `node --check app.js`、`node --test tests/travel-prep-categories.test.cjs`、`npm run validate`。
- [ ] 提交、推送 main 并部署 Cloudflare Pages。
