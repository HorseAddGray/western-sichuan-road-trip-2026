const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "travel-prep.js"), "utf8");
const context = {};
vm.runInNewContext(source, context);
const { normalizeTodoCategory, filterTodosByCategory, normalizeTodoSubcategory, sortNoticeItems, normalizeNoticeCategorySettings } = context.TravelPrep;
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
  assert.match(html, /id="notice-category-manager"/);
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

test("toilet map appears below the notice information form and above the notice cards", () => {
  const formPosition = html.indexOf('id="notice-form"');
  const mapPosition = html.indexOf('id="toilet-map"');
  const listPosition = html.indexOf('id="notice-list"');

  assert.ok(formPosition < mapPosition, "the map should follow the notice form");
  assert.ok(mapPosition < listPosition, "the map should precede the notice cards");
});

test("oxygen guidance preserves every supplied fee and splits the two existing reminders", () => {
  const oxygen = tripData.preTrip.packingItems.filter((item) => item.subcategory === "health" && item.group === "吸氧费用");
  const refillReminder = tripData.preTrip.packingItems.find((item) => item.id === "oxygen-reminder");
  const responseReminder = tripData.preTrip.packingItems.find((item) => item.id === "oxygen-response-reminder");
  assert.equal(oxygen.length, 6);
  assert.ok(oxygen.some((item) => item.text === "理塘县" && item.detail.includes("床位费+取暖费21元/人")));
  assert.equal(refillReminder?.detail, "氧气袋每到个地方都充满（低海拔地区充更合适）");
  assert.ok(responseReminder?.detail.includes("低海拔地区慢慢过渡到高海拔"));
});

test("health notices retain every new travel tip and separate medical guidance from safety advice", () => {
  const health = tripData.preTrip.packingItems.filter((item) => item.subcategory === "health");
  const find = (id) => health.find((item) => item.id === id);
  assert.ok(find("health-meals")?.detail.includes("三顿饭的碳水一定要吃够"));
  assert.ok(find("health-energy")?.detail.includes("藏式热奶茶或酥油茶"));
  assert.ok(find("health-bathing")?.detail.includes("前2天不洗头洗澡"));
  assert.ok(find("health-severe-signals")?.detail.includes("粉红色泡沫痰"));
  assert.ok(find("health-urgent-response")?.detail.includes("别等天亮"));
  assert.ok(find("medical-headache")?.detail.includes("间隔必须超过24小时"));
  assert.ok(find("medical-altitude")?.detail.includes("氯化钾缓释片"));
  assert.ok(find("medical-safety")?.detail.includes("咨询医生/药师"));
  assert.match(app, /legacyOxygenReminder/);
});

test("oxygen equipment guidance retains all purchase, use, and safety details", () => {
  const equipment = tripData.preTrip.packingItems.filter((item) => item.subcategory === "health" && ["装备购买建议", "使用经验与消耗"].includes(item.group));
  const find = (id) => equipment.find((item) => item.id === id);
  assert.equal(equipment.length, 8);
  assert.ok(find("oxygen-bag-buying")?.detail.includes("60L"));
  assert.ok(find("oxygen-nasal-tube")?.detail.includes("不配鼻氧管"));
  assert.ok(find("oxygen-connector")?.detail.includes("连不上"));
  assert.ok(find("oxygen-medical-purity")?.detail.includes("医用纯氧"));
  assert.ok(find("oxygen-not-overfill")?.detail.includes("容易炸（胀破）"));
});

test("notice details use the defined category and group order without scrambling each group", () => {
  const notes = [
    { text: "雷区地点", subcategory: "toilet", group: "雷区警示" },
    { text: "温馨提示", subcategory: "health", group: "温馨提示" },
    { text: "第一处吸氧", subcategory: "health", group: "吸氧费用" },
    { text: "第二处吸氧", subcategory: "health", group: "吸氧费用" },
    { text: "殿堂地点", subcategory: "toilet", group: "殿堂级" }
  ];

  assert.deepEqual(sortNoticeItems(notes).map((item) => item.text), ["第一处吸氧", "第二处吸氧", "温馨提示", "殿堂地点", "雷区地点"]);
});

test("notice cards place a black dot before each detail", () => {
  assert.match(styles, /\.notice-item::before/);
  assert.match(styles, /background:\s*#13262f/);
});

test("notice category settings preserve a manual order, edited names, and collapsed categories", () => {
  const settings = normalizeNoticeCategorySettings({
    order: ["toilet", "health", "unknown"],
    labels: { toilet: "如厕指南", health: "高原健康", unknown: "忽略" },
    collapsed: ["toilet", "unknown"]
  }, ["health", "rental", "toilet"]);

  assert.deepEqual([...settings.order], ["toilet", "health", "rental"]);
  assert.deepEqual(JSON.parse(JSON.stringify(settings.labels)), { toilet: "如厕指南", health: "高原健康" });
  assert.deepEqual([...settings.collapsed], ["toilet"]);
});

test("notices provide collapsible category panels and local category management", () => {
  assert.match(html, /id="notice-category-manager"/);
  assert.match(app, /collapsedNoticeSubcategories/);
  assert.match(app, /data-notice-category-move/);
  assert.match(app, /data-notice-category-label/);
});
