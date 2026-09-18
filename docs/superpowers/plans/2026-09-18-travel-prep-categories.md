# Travel Prep Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split travel preparation into switchable, independently editable Notice and Packing lists while retaining local browser persistence.

**Architecture:** Add a category to each Todo; missing categories remain notices for backward compatibility. Retain the existing local Todo collection and filter its display by the selected category.

**Tech Stack:** Vanilla HTML, CSS, browser JavaScript, Node.js built-in test runner.

---

### Task 1: Category helper tests

**Files:** Create `tests/travel-prep-categories.test.cjs`; modify `app.js`.

- [ ] Write a failing test asserting an item without category normalizes to `notice`, and a packing filter only returns items with `category: "packing"`.
- [ ] Run `node --test tests/travel-prep-categories.test.cjs`; expect failure because the helpers do not exist.
- [ ] Add `normalizeTodoCategory(todo)` and `filterTodosByCategory(todos, category)` to `app.js`; only `packing` remains packing and all other values normalize to notice.
- [ ] Re-run the test; expect PASS.
- [ ] Commit with `git commit -m "test: cover travel prep categories"`.

### Task 2: Switchable preparation card

**Files:** Modify `index.html:96-106`, `styles.css:350-365`, `app.js:781-823`, and `tests/travel-prep-categories.test.cjs`.

- [ ] Write a failing DOM test requiring notice and packing tabs, a `#todo-category` select, and an item edit action.
- [ ] Run `node --test tests/travel-prep-categories.test.cjs`; expect failure because these controls do not exist.
- [ ] Add tab buttons and the select input. Track `state.activeTodoCategory`; render only its items and progress; save new items in its category; support inline text editing through the existing Todo adapter.
- [ ] Add focused CSS for tabs, select, and the edit action while preserving the existing card layout.
- [ ] Run `node --test tests/travel-prep-categories.test.cjs tests/runtime/runtime-storage.test.cjs`; expect all tests PASS.
- [ ] Commit with `git commit -m "feat: split travel prep into categories"`.

### Task 3: Initial data and publishing

**Files:** Modify `trip-data.json`.

- [ ] Set each existing rental reminder in `preTrip.packingItems` to `category: "notice"`; do not invent packing items.
- [ ] Run `npm run build:map`, `npm run validate`, and `node --test tests/runtime/runtime-storage.test.cjs tests/travel-prep-categories.test.cjs`; expect all checks PASS.
- [ ] Commit with `git commit -m "data: categorize travel preparation reminders"`.
- [ ] Push with `git push origin main`, then deploy with `npx --yes wrangler pages deploy . --project-name western-sichuan-road-trip-2026 --branch main`; expect Cloudflare deployment completion.
