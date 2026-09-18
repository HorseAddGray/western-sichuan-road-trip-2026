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
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const tripData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "trip-data.json"), "utf8"));

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
  assert.ok(html.indexOf('href="#route"') < html.indexOf('href="#flights"'));
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

test("toilet notes retain every supplied location in separate trusted and warning groups", () => {
  const toilets = tripData.preTrip.packingItems.filter((item) => item.subcategory === "toilet");
  assert.equal(toilets.filter((item) => item.group === "殿堂级").length, 7);
  assert.equal(toilets.filter((item) => item.group === "雷区警示").length, 7);
  assert.ok(toilets.some((item) => item.text === "四姑娘山双桥沟" && item.detail.includes("全自动感应冲水")));
  assert.ok(toilets.some((item) => item.text === "墨石公园厕所" && item.detail.includes("为什么要搅拌阿")));
});

test("toilet category renders supplied detail under its trusted and warning groups", () => {
  assert.match(app, /toilet: "厕所"/);
  assert.match(app, /todo\.group/);
  assert.match(app, /todo\.detail/);
});

test("toilet category has a map with one marker for every toilet note", () => {
  const toilets = tripData.preTrip.packingItems.filter((item) => item.subcategory === "toilet");
  const pins = tripData.preTrip.toiletMapPins || [];
  assert.equal(pins.length, toilets.length);
  assert.deepEqual(new Set(pins.map((pin) => pin.todoId)).size, toilets.length);
  assert.match(html, /id="toilet-map"/);
  assert.match(app, /function renderToiletMap/);
});

test("notices are information cards, while the toilet map supports day filters and highlighted map targets", () => {
  assert.match(html, /placeholder="添加一条信息"/);
  assert.match(app, /toilet-map-day/);
  assert.match(app, /is-highlighted/);
  assert.match(app, /notice-item/);
  assert.doesNotMatch(app, /\$\("#notice-list"\)\.onchange = updateTodo/);
});

test("oxygen guidance preserves every supplied fee and the full safety reminder", () => {
  const oxygen = tripData.preTrip.packingItems.filter((item) => item.subcategory === "health" && item.group === "吸氧费用");
  const reminder = tripData.preTrip.packingItems.find((item) => item.id === "oxygen-reminder");
  assert.equal(oxygen.length, 6);
  assert.ok(oxygen.some((item) => item.text === "理塘县" && item.detail.includes("床位费+取暖费21元/人")));
  assert.ok(reminder?.detail.includes("低海拔地区慢慢过渡到高海拔"));
});
