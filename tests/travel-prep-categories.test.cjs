const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "travel-prep.js"), "utf8");
const context = {};
vm.runInNewContext(source, context);
const { normalizeTodoCategory, filterTodosByCategory, normalizeTodoSubcategory } = context.TravelPrep;
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const navigation = fs.readFileSync(path.join(__dirname, "..", "site-navigation.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

test("uncategorized items belong to notices", () => {
  assert.equal(normalizeTodoCategory({ text: "验车" }), "notice");
});

test("filters only the selected category", () => {
  const todos = [{ text: "验车" }, { text: "氧气瓶", category: "packing" }];
  assert.deepEqual(filterTodosByCategory(todos, "packing"), [todos[1]]);
});

test("missing subcategory becomes other", () => {
  assert.equal(normalizeTodoSubcategory({ category: "packing" }), "other");
});

test("packing and notices have independent navigation and controls", () => {
  assert.match(html, /href="#packing"[^>]*>行囊清单</);
  assert.match(html, /href="#notices"[^>]*>注意事项</);
  assert.match(html, /id="packing-category-filters"/);
  assert.match(html, /id="notice-category-tabs"/);
  assert.match(html, /id="packing-list"/);
  assert.match(html, /id="notice-list"/);
});

test("three top-level areas are marked as independent display panels", () => {
  assert.match(html, /data-travel-panel="info"/);
  assert.match(html, /data-travel-panel="packing"/);
  assert.match(html, /data-travel-panel="notices"/);
});

test("travel information orders route before flights and uses a fresh navigation script version", () => {
  assert.ok(html.indexOf('id="route"') < html.indexOf('id="flights"'));
  assert.match(html, /site-navigation\.js\?v=20260918-2/);
});

test("navigation marks the selected top-level panel as current", () => {
  assert.match(navigation, /packingLink/);
  assert.match(navigation, /noticesLink/);
  assert.match(navigation, /activePanel === "packing"/);
});

test("all top-level navigation items share the current-page highlight", () => {
  assert.match(styles, /\.topbar nav a\[aria-current="page"\]/);
  assert.match(styles, /#travel-navigation-trigger\[aria-current="page"\]/);
});
