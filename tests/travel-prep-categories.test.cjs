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

test("preparation card provides category controls", () => {
  assert.match(html, /data-prep-category="notice"/);
  assert.match(html, /data-prep-category="packing"/);
  assert.match(html, /id="todo-category"/);
});
