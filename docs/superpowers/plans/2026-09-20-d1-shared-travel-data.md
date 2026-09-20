# D1 Shared Travel Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store the travel page's shared to-do records in Cloudflare D1 so 马甲 and 仔仔 can edit the same data from different devices after entering one shared access code.

**Architecture:** Keep the existing browser runtime adapter API. Switch the trip configuration to its existing D1 mode and add an authenticated Pages Function at `/api/trip/:tripId`; it validates a code hash stored only in D1 and reads or updates individual records. The first authenticated device migrates its existing local to-do records to an empty D1 database so current packing changes are retained.

**Tech Stack:** Cloudflare Pages Functions, Cloudflare D1, existing browser JavaScript runtime adapter, Node test runner, Wrangler.

---

### Task 1: Cover authenticated D1 transport

**Files:**
- Modify: `tests/runtime/runtime-storage.test.cjs`
- Modify: `runtime-storage.js`

- [x] **Step 1: Write the failing test**

```js
test("D1 transport includes a configured shared access code", async () => {
  // Mock fetch and assert its GET and POST requests receive x-travel-access-code.
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/runtime/runtime-storage.test.cjs`

Expected: FAIL because the current D1 request has no shared access header.

- [x] **Step 3: Write minimal implementation**

```js
const headers = accessCode ? { "x-travel-access-code": accessCode } : {};
```

Use the headers on D1 GET and POST requests only.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/runtime/runtime-storage.test.cjs`

Expected: PASS.

### Task 2: Add the shared access gate and local-data migration

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Modify: `tests/travel-prep-categories.test.cjs`

- [x] **Step 1: Write the failing test**

```js
test("D1 mode gates shared data behind a saved access code and migrates local todos only when remote data is empty", () => {
  // Assert the access gate and one-time migration helpers exist.
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: FAIL because there is no access gate or migration helper.

- [x] **Step 3: Write minimal implementation**

Add a modal access-code form shown before a D1 adapter loads. Save the entered code in the current browser only, pass it to the D1 adapter, and only copy legacy local to-dos into D1 when the authenticated remote to-do collection is empty.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: PASS.

### Task 3: Add the Pages Function and D1 schema

**Files:**
- Create: `functions/api/trip/[tripId].js`
- Create: `migrations/0001_shared_trip.sql`
- Modify: `tests/travel-prep-categories.test.cjs`

- [x] **Step 1: Write the failing test**

```js
test("shared trip API validates access code hashes and accepts record-level D1 changes", () => {
  // Assert the function uses TRIP_DB, validates x-travel-access-code, and limits collections.
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: FAIL because the route and schema do not exist.

- [x] **Step 3: Write minimal implementation**

Create tables for a per-trip access-code hash and JSON records. The function permits same-origin GET/POST requests only after hashing and comparing the supplied code, then returns the snapshot shape expected by `runtime-storage.js`.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/travel-prep-categories.test.cjs`

Expected: PASS.

### Task 4: Provision and verify production

**Files:**
- Modify: `trip-data.json`
- Create locally, do not commit: `wrangler.jsonc`

- [x] **Step 1: Create D1 database and apply schema**

Run `npx wrangler d1 create western-sichuan-road-trip-data`, then execute `migrations/0001_shared_trip.sql` remotely. Insert only a SHA-256 hash for the generated shared access code.

- [x] **Step 2: Bind D1 and deploy**

Use the local Wrangler configuration to bind `TRIP_DB` to the existing Pages project, then deploy the main branch.

- [x] **Step 3: Verify access and persistence**

Verify unauthenticated API calls return 401, correct-code reads return 200, an upsert returns the record, and a subsequent read returns the same record.

- [ ] **Step 4: Commit safe source changes**

Commit application code, schema, tests, and the D1 configuration mode. Do not commit a database ID, access code, or local Wrangler configuration.
