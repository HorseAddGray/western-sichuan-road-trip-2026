# 每日行程备注、景点评价与备忘录联动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在每日行程的节点间保存备注，在已收录景点节点上保存马甲/仔仔评价并跳转至备忘录，且删除甘孜县指定旧链接。

**Architecture:** 以 `tickets` 运行时集合中的单个 `__itinerary_state__` 记录保存行程确认时间、间隔备注和双人评分，避免新增后端集合。`dayCard()` 依据稳定节点键渲染时间线便签、星标景点按钮和评分控件；跳转时切换备忘录景点分类并高亮目标折叠项。

**Tech Stack:** 原生 HTML、CSS、JavaScript、Cloudflare D1 运行时存储、Node 内置测试。

---

### Task 1: 为行程日志建立可同步状态模型

**Files:**
- Modify: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\app.js:20-60, 462-520, 920-1008`
- Modify: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\trip-data.json:12-18`
- Test: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\tests\runtime\runtime-storage.test.cjs`

- [ ] **Step 1: Write the failing storage test**

  Add a test that creates an adapter with `collections: ["tickets"]`, upserts this record, reloads, and asserts every field survives:

  ```js
  await adapter.applyChange("tickets", {
    id: "__itinerary_state__",
    completions: { "1:d1-service": "2026-09-28T13:00:00.000Z" },
    notes: { "1:d1-service": [{ id: "note-a", text: "服务区咖啡不错", createdAt: "2026-09-28T13:10:00.000Z" }] },
    ratings: { "1:d1-service": { majia: "up", zaizai: "down" } }
  }, "upsert");
  const snapshot = await adapter.load();
  assert.deepEqual(snapshot.tickets[0].ratings["1:d1-service"], { majia: "up", zaizai: "down" });
  ```

- [ ] **Step 2: Run the storage test to verify it fails**

  Run: `node --test tests/runtime/runtime-storage.test.cjs`

  Expected: FAIL because the itinerary state adapter helpers have not been added to `app.js` and shared tickets are not configured.

- [ ] **Step 3: Implement minimal state helpers and D1 configuration**

  In `app.js`, add `state.itineraryState = { completions: {}, notes: {}, ratings: {} }`; reserve `const ITINERARY_STATE_ID = "__itinerary_state__"`; extract the matching tickets record during `loadSharedState()`; and implement:

  ```js
  function itineraryStateRecord() {
    return { id: ITINERARY_STATE_ID, ...state.itineraryState };
  }

  function saveItineraryState() {
    localStorage.setItem(scheduleCompletionStorageKey(), JSON.stringify(state.itineraryState.completions));
    return saveSharedChange("tickets", itineraryStateRecord()).catch(console.error);
  }
  ```

  Keep the existing local completion key as a fallback only when no persisted itinerary-state record exists. In `trip-data.json`, change `sharedCollections` to `["todos", "tickets"]` so D1 receives this record.

- [ ] **Step 4: Run the storage test to verify it passes**

  Run: `node --test tests/runtime/runtime-storage.test.cjs`

  Expected: PASS, including the new itinerary-state persistence test.

- [ ] **Step 5: Commit the state model**

  ```bash
  git add -- app.js trip-data.json tests/runtime/runtime-storage.test.cjs
  git commit -m "feat: persist itinerary notes and ratings"
  ```

### Task 2: 连接节点、备注和景点评分到每日时间线

**Files:**
- Modify: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\app.js:462-720`
- Modify: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\styles.css` (daily timeline rule block)
- Test: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\tests\travel-prep-categories.test.cjs`

- [ ] **Step 1: Write the failing page-data test**

  Add assertions that require the new controls and state wiring:

  ```js
  assert.match(app, /data-itinerary-note-add/);
  assert.match(app, /data-itinerary-rating/);
  assert.match(app, /itineraryScenicDestination\(/);
  assert.match(app, /data-itinerary-scenic-open/);
  assert.match(styles, /itinerary-rating__circle--up/);
  assert.match(styles, /itinerary-rating__circle--down/);
  ```

- [ ] **Step 2: Run the page-data test to verify it fails**

  Run: `node --test tests/travel-prep-categories.test.cjs`

  Expected: FAIL because the new itinerary controls and CSS classes do not exist.

- [ ] **Step 3: Implement the time-line note and rating UI**

  Add these focused helpers in `app.js`:

  ```js
  function itineraryNotesFor(key) { return state.itineraryState.notes[key] || []; }
  function itineraryRatingFor(key, owner) { return state.itineraryState.ratings[key]?.[owner] || ""; }
  function itineraryScenicDestination(item) {
    const text = String(item.text || "");
    const aliases = { "甘孜县城": "甘孜县", "康定县城": "康定镇", "康定": "康定镇", "新都桥": "新都桥镇", "塔公草原": "塔公镇" };
    const scenic = state.todos.filter((todo) => window.TravelPrep.normalizeTodoCategory(todo) === "notice" && window.TravelPrep.normalizeTodoSubcategory(todo) === "scenic");
    return scenic.find((todo) => {
      const group = todo.group || todo.text;
      const alias = Object.entries(aliases).find(([, target]) => target === group)?.[0];
      return text.includes(group) || Boolean(alias && text.includes(alias));
    }) || null;
  }
  ```

  In `dayCard()`, render each schedule item with an optional star-prefixed button only when `itineraryScenicDestination(item)` resolves. Put the compact `马甲` and `仔仔` rating circles in a right-side `<div class="itinerary-ratings">`. Insert one `行程安排 / 备注` block after every item except the last; include add, edit and delete controls for saved note cards. Rating choices use buttons carrying `data-itinerary-rating="up|down|clear"`; the visible result is exactly one of an empty dashed circle, green round check, or red round cross.

  Add delegated `#timeline` click and submit handlers that mutate `state.itineraryState`, call `saveItineraryState()`, and re-render while keeping the day open. Use `crypto.randomUUID()` for new note ids, with `Date.now().toString(36)` as fallback.

  In `styles.css`, use a three-column schedule grid on desktop (time, toggle, content/rating), a dotted left rule for interval notes, 28px circular rating buttons, and a single-column rating layout below 760px. Ensure buttons retain visible keyboard focus and no note control appears on the final node.

- [ ] **Step 4: Run the page-data test to verify it passes**

  Run: `node --test tests/travel-prep-categories.test.cjs`

  Expected: PASS, including the tests for controls, resolver and rating states.

- [ ] **Step 5: Commit the timeline interface**

  ```bash
  git add -- app.js styles.css tests/travel-prep-categories.test.cjs
  git commit -m "feat: add itinerary notes and scenic ratings"
  ```

### Task 3: 跳转至备忘录景点并高亮目标

**Files:**
- Modify: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\app.js:1180-1300, 2550-2720`
- Modify: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\styles.css` (notice highlight rule)
- Test: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\tests\travel-prep-categories.test.cjs`

- [ ] **Step 1: Write the failing jump test**

  Add a test requiring the intended navigation contract:

  ```js
  assert.match(app, /state\.activeNoticeSubcategory = "scenic"/);
  assert.match(app, /collapsedNoticeGroups\.delete\(noticeGroupId\("scenic", scenic\.group\)\)/);
  assert.match(app, /notice-subcategory--target/);
  ```

- [ ] **Step 2: Run the page-data test to verify it fails**

  Run: `node --test tests/travel-prep-categories.test.cjs`

  Expected: FAIL because schedule scene buttons do not yet switch to the memo panel or target a scenic group.

- [ ] **Step 3: Implement focused memo navigation**

  Add `openItineraryScenicMemo(group)` that sets `location.hash = "#notices"`, sets `state.activeNoticeSubcategory = "scenic"`, expands `noticeGroupId("scenic", group)`, calls `renderTravelPrep()`, then scrolls the matching `[data-notice-group]` element into view and applies `notice-subcategory--target` for 2200ms. Attach it to `[data-itinerary-scenic-open]` in the timeline event handler.

  Add a restrained outline/soft teal flash to `.notice-subcategory--target`; do not alter ordinary scenic cards or article sorting.

- [ ] **Step 4: Run the page-data test to verify it passes**

  Run: `node --test tests/travel-prep-categories.test.cjs`

  Expected: PASS, including the memo-navigation assertions.

- [ ] **Step 5: Commit the memo jump**

  ```bash
  git add -- app.js styles.css tests/travel-prep-categories.test.cjs
  git commit -m "feat: link itinerary scenic stops to memos"
  ```

### Task 4: 删除甘孜县旧文章并验证整体发布

**Files:**
- Modify: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\trip-data.json:1310-1340`
- Modify: `C:\Users\87477\Documents\Codex\2026-09-18\qu\outputs\川西自驾双人成行\tests\travel-prep-categories.test.cjs`

- [ ] **Step 1: Write the failing content test**

  Update the 甘孜县 fixture assertions to require 8 links and reject the old direct-item URL:

  ```js
  assert.equal(ganzi?.links?.length, 8);
  assert.ok(!ganzi?.links?.some((link) => link.url.includes("69dce871000000001a034e75")));
  assert.ok(ganzi?.links?.some((link) => link.url.includes("15oxTfrI8zc")));
  ```

- [ ] **Step 2: Run the content test to verify it fails**

  Run: `node --test tests/travel-prep-categories.test.cjs`

  Expected: FAIL because the original direct-item URL is still the first 甘孜县 article.

- [ ] **Step 3: Remove the first 甘孜县 reference and upgrade its authored version**

  Delete only the `https://www.xiaohongshu.com/discovery/item/69dce871000000001a034e75...` link object from `scenic-ganzi-county`. Increase `referenceVersion` from `2` to `3` so existing D1 snapshots receive the content correction without replacing any manually reordered same-version records later.

- [ ] **Step 4: Run all validation checks**

  Run:

  ```bash
  node --test tests/travel-prep-categories.test.cjs
  node --test tests/runtime/runtime-storage.test.cjs
  node --check app.js
  npm run validate
  git diff --check
  ```

  Expected: all tests pass; the existing `To Do` warning from `validate-lite` remains informational.

- [ ] **Step 5: Commit and deploy**

  ```bash
  git add -- app.js styles.css trip-data.json tests/travel-prep-categories.test.cjs tests/runtime/runtime-storage.test.cjs
  git commit -m "feat: add itinerary journal and scenic feedback"
  git push origin main
  npx wrangler pages deploy . --project-name western-sichuan-road-trip-2026 --branch main --commit-dirty=true
  ```

- [ ] **Step 6: Verify public data**

  Fetch `https://western-sichuan-road-trip-2026.pages.dev/trip-data.json` with a cache-busting query and assert that `scenic-ganzi-county.referenceVersion === 3`, its link count is `8`, and none of its URLs contains `69dce871000000001a034e75`.
