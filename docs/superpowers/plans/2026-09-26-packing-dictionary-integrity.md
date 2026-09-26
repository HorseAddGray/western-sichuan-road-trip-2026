# Packing Dictionary Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep packing categories, tags, and luggage locations stable across updates and devices while protecting category deletion with explicit migration.

**Architecture:** Store the dictionary as one versioned ticket record, reconcile it against packing items without rewriting item keys, and save it with existing ticket adapters. Render deletion and luggage operations from the restored dictionary.

**Tech Stack:** Vanilla JavaScript, HTML/CSS, runtime-storage.js, Node test runner, Playwright.

---

### Task 1: Persist the shared dictionary

**Files:** `app.js:1240-1419,1461-1590,1990-2045`; `tests/travel-prep-categories.test.cjs`

- [ ] Add this failing test before implementation:

```js
test("packing dictionary is restored before display and preserves item categories and tags", () => {
  assert.match(app, /const PACKING_DICTIONARY_STATE_ID = "packing-dictionary-state-v1"/);
  assert.match(app, /normalizePackingDictionaryState\(dictionaryRecord/);
  assert.match(app, /reconcilePackingDictionaryFromTodos\(state\.todos\)/);
  assert.doesNotMatch(app, /return categories\.includes\(category\) \? category : \(categories\.includes\("other"\)/);
});
```

- [ ] Run `node --test tests/travel-prep-categories.test.cjs --test-name-pattern="packing dictionary is restored"`; it must fail because no shared dictionary record exists.
- [ ] Implement `PACKING_DICTIONARY_STATE_ID`, `normalizePackingDictionaryState(record)`, `savePackingDictionaryState()`, and `reconcilePackingDictionaryFromTodos(todos)`. Persist custom categories, category labels/deletions/order, tag associations, and luggage labels/tree in one `tickets` record. Load the record before controls render. Reconciliation adds missing category or tag dictionary entries from items but never changes `todo.subcategory` or `todo.property`.
- [ ] Run the focused test again; it must pass.
- [ ] Commit with `git add app.js tests/travel-prep-categories.test.cjs` and `git commit -m "fix: persist packing dictionary state"`.

### Task 2: Protect populated category deletion

**Files:** `app.js:1549-1572,1878-1903,2321-2330`; `styles.css`; `tests/travel-prep-categories.test.cjs`

- [ ] Add this failing test before implementation:

```js
test("deleting a populated packing category requires migration and a random four digit code", () => {
  assert.match(app, /data-packing-category-delete-dialog/);
  assert.match(app, /data-packing-category-delete-target/);
  assert.match(app, /data-packing-category-delete-code/);
  assert.match(app, /generatePackingDeleteCode\(\)/);
  assert.match(app, /todo\.property = ""/);
});
```

- [ ] Run `node --test tests/travel-prep-categories.test.cjs --test-name-pattern="deleting a populated packing category"`; it must fail because the dialog does not exist.
- [ ] Implement a dialog for populated categories with affected count, distinct target category, a generated four-digit nonrepeating code, code input, cancel and disabled confirm. After valid confirm, update each source item to the target and set `property = ""`, await the updates, then remove the category and its tag association. Empty categories keep direct delete.
- [ ] Run the focused test again; it must pass.
- [ ] Commit with `git add app.js styles.css tests/travel-prep-categories.test.cjs` and `git commit -m "feat: protect populated packing category deletion"`.

### Task 3: Assign items to luggage

**Files:** `app.js:1618-1664,1665-1824,1878-1903,2937-2951`; `styles.css`; `tests/travel-prep-categories.test.cjs`; `.superpowers/packing-dictionary-ui-check.py`

- [ ] Add this failing test before implementation:

```js
test("packing supports category-to-luggage assignment and item transfer with dynamic luggage parents", () => {
  assert.match(app, /data-packing-luggage-category-assign/);
  assert.match(app, /data-packing-category-luggage/);
  assert.match(app, /transferPackingTodoToLuggage\(todo, key\)/);
  assert.match(app, /packingLuggageItem\(todo\.container\)\?\.parent/);
});
```

- [ ] Run `node --test tests/travel-prep-categories.test.cjs --test-name-pattern="category-to-luggage assignment"`; it must fail because no assignment helpers exist.
- [ ] Implement `transferPackingTodoToLuggage(todo, key)` and `transferPackingCategoryToLuggage(category, key)`. The helper sets a child container plus its current parent luggage, or sets both fields to a root luggage. Add “按类别放入” to every luggage branch and “转移行囊” to every item. Resolve parents with `packingLuggageItem`, never fixed `PACKING_CONTAINERS`.
- [ ] Run the focused test and browser check; both must pass: `python C:\Users\87477\.codex\skills\webapp-testing\scripts\with_server.py --server "python -m http.server 4183" --port 4183 -- python .superpowers\packing-dictionary-ui-check.py`.
- [ ] Commit with `git add app.js styles.css tests/travel-prep-categories.test.cjs` and `git commit -m "feat: assign packing categories to luggage"`.

### Task 4: Validate and publish

**Files:** `index.html`; `tests/travel-prep-categories.test.cjs`; `tests/runtime/runtime-storage.test.cjs`

- [ ] Change `app.js?v=20260922-67` to the next dated version.
- [ ] Run `node --test tests/travel-prep-categories.test.cjs`, `node --test tests/runtime/runtime-storage.test.cjs`, `node --check app.js`, `npm run validate`, and `git diff --check`; all must pass.
- [ ] Commit all implementation and plan files, push `main`, deploy with Wrangler, then verify production exposes the dictionary identifier, delete-dialog marker and transfer helper.
