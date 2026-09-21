const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "travel-prep.js"), "utf8");
const context = {};
vm.runInNewContext(source, context);
const { normalizeTodoCategory, filterTodosByCategory, normalizeTodoSubcategory, sortNoticeItems, normalizeNoticeSubcategorySettings } = context.TravelPrep;
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
  assert.match(html, /id="packing-navigation"/);
  assert.match(html, /href="#notices"[^>]*>备忘录</);
  assert.match(html, /id="packing-category-filter-select"/);
  assert.match(html, /id="notice-category-manager"/);
  assert.match(html, /id="packing-list"/);
  assert.match(html, /id="notice-list"/);
});

test("memo navigation includes a food category and aligned luggage controls", () => {
  assert.match(html, /<h2 id="notices-title">备忘录</);
  assert.match(app, /notice: \{ health: "健康", toilet: "厕所", food: "美食" \}/);
  assert.match(styles, /\.packing-luggage-branch__header strong/);
  assert.match(styles, /\.packing-check-start-actions > button/);
});

test("packing exposes five editable luggage filters", () => {
  assert.match(html, /id="packing-luggage-filters"/);
  assert.match(app, /const PACKING_LUGGAGE = \[/);
  assert.match(app, /data-packing-luggage/);
  assert.match(app, /data-packing-luggage-label/);
});

test("packing workspace uses concise navigation children for luggage, purchases, and checks", () => {
  assert.match(html, /id="packing-navigation"/);
  assert.match(html, /href="#packing-details"[^>]*>行囊</);
  assert.match(html, /href="#packing-purchase"[^>]*>采购</);
  assert.match(html, /href="#packing-check"[^>]*>检查</);
  assert.match(html, /id="packing-purchase-list"/);
  assert.match(html, /id="packing-checker"/);
  assert.match(app, /data-packing-owner/);
  assert.match(app, /data-packing-container/);
  assert.match(app, /data-purchase-submit/);
  assert.match(app, /data-todo-use/);
});

test("packing uses short bag names, a single owner filter, and selected-bag checking", () => {
  assert.match(app, /label: "衣箱"/);
  assert.match(app, /label: "随包"/);
  assert.match(app, /selectedPackingOwner/);
  assert.match(app, /data-packing-check-luggage/);
  assert.match(app, /data-packing-check-reset/);
  assert.match(app, /data-packing-check-reselect/);
});

test("packing filters use list selectors with a reset action and compact luggage controls", () => {
  assert.match(html, /id="packing-owner-filter-select"/);
  assert.match(html, /id="packing-category-filter-select"/);
  assert.match(html, /data-packing-filter-reset/);
  assert.match(app, /data-packing-filter-reset/);
  assert.doesNotMatch(app, /packing-luggage-filter--all/);
  assert.match(app, /packing-item-title/);
});

test("packing keeps additions in a closable form and moves item actions into a findable overflow menu", () => {
  assert.match(html, /data-packing-form-open/);
  assert.match(html, /id="packing-form-panel" hidden/);
  assert.match(html, /data-packing-form-close/);
  assert.match(html, /data-packing-search-open/);
  assert.match(html, /id="packing-search-panel"[^>]*hidden/);
  assert.match(html, /data-packing-search-close/);
  assert.match(html, /id="packing-search-input"/);
  assert.match(html, /id="packing-property-filter-select"/);
  assert.match(app, /packingSearchText/);
  assert.match(app, /selectedPackingProperty/);
  assert.match(app, /data-packing-find/);
  assert.match(app, /todo-more__menu/);
  assert.doesNotMatch(app, /packing-property">\$\{PACKING_PROPERTY_LABELS\[property\]\}<\//);
  assert.doesNotMatch(app, /data-packing-container="\$\{escapeHtml\(todo\.id\)\}"/);
});

test("packing forms keep selectors together, names below, and synchronize workspace titles", () => {
  assert.match(html, /class="packing-form-selectors"/);
  assert.match(html, /data-packing-filter-reset>重置</);
  assert.match(html, /data-packing-form-close[^>]*>×</);
  assert.match(html, /data-packing-search-close[^>]*>×</);
  assert.match(app, /const PACKING_WORKSPACE_TITLES/);
  assert.match(app, /packing-title"\)\.textContent/);
  assert.doesNotMatch(html, /id="packing-luggage-manager"/);
  assert.match(app, /data-packing-dictionary-tab="luggage"/);
});

test("packing actions share one style, highlight reset for active filters, and collapse categories by choice", () => {
  assert.match(html, /class="packing-action-trigger"[^>]*data-packing-form-open/);
  assert.match(html, /class="packing-action-trigger"[^>]*data-packing-search-open/);
  assert.match(html, /class="packing-action-trigger"[^>]*data-packing-filter-reset/);
  assert.match(styles, /\.packing-action-trigger/);
  assert.match(styles, /\.packing-action-trigger\.is-active/);
  assert.match(app, /function hasActivePackingFilters/);
  assert.match(app, /classList\.toggle\("is-active", hasActivePackingFilters/);
  assert.match(app, /collapsedPackingCategories/);
  assert.match(app, /data-packing-category-toggle/);
  assert.match(app, /packing-category-toggle/);
});

test("packing names sort inside each category and search and add forms are mutually exclusive", () => {
  assert.match(app, /localeCompare\(b\.text, "zh-CN"/);
  assert.match(app, /packing-search-panel"\)\.hidden = true/);
  assert.match(app, /packing-form-panel"\)\.hidden = true/);
});

test("packing additions support reusable custom categories, quantity, and category-bound tags", () => {
  assert.match(html, /id="packing-custom-category"/);
  assert.match(html, /id="packing-quantity"/);
  assert.match(html, /物品标签/);
  assert.match(app, /daily: "日用品"/);
  assert.match(app, /misc: "其他"/);
  assert.match(app, /PACKING_TAGS_BY_CATEGORY/);
  assert.match(app, /clothing: \["coat", "trousers", "sweater", "base", "sleepwear", "consumable", "other"\]/);
  assert.match(app, /electronics: \["appliance"\]/);
  assert.match(app, /daily: \["consumable"\]/);
  assert.match(app, /quantity: Number\(\$\("#packing-quantity"\)\.value\) \|\| 1/);
  assert.match(app, /packing-custom-categories/);
});

test("packing additions collect an owner and a property with conditional consumable uses", () => {
  assert.match(app, /packing: \{ documents: "证件", clothing: "衣物", care: "洗护", medicine: "药品", electronics: "电子", daily: "日用品", other: "户外", misc: "其他" \}/);
  assert.match(app, /const PACKING_PROPERTY_LABELS = \{ none: "无", appliance: "电器", consumable: "消耗品", coat: "外套"/);
  assert.match(html, /id="packing-owner"/);
  assert.match(html, /id="packing-property"/);
  assert.match(html, /data-packing-uses-row/);
  assert.match(app, /property === "consumable"/);
});

test("authored purchase items seed the purchase list and retain local removals", () => {
  const purchases = tripData.preTrip.purchaseItems || [];
  assert.equal(purchases.length, 4);
  assert.ok(purchases.some((item) => item.text.includes("佳能R50相机兔笼")));
  assert.ok(purchases.some((item) => item.text.includes("旅行枕")));
  assert.ok(purchases.some((item) => item.text.includes("Glasslock")));
  assert.match(app, /authoredPurchases/);
  assert.match(app, /removedPurchaseIds/);
});

test("purchase, packing checks, and notices expose the requested scoped workflows", () => {
  assert.match(html, /id="packing-purchase-form-panel"[^>]*hidden/);
  assert.match(html, /id="packing-purchase-description"/);
  assert.match(app, /data-purchase-edit/);
  assert.match(app, /data-purchase-submit/);
  assert.match(app, /purchase\.subcategory/);
  assert.match(app, /packingCheckOwner/);
  assert.match(app, /data-packing-check-child/);
  assert.match(app, />确认无误</);
  assert.match(html, /data-notice-form-open/);
  assert.match(html, /id="notice-title-input"/);
  assert.match(html, /id="notice-detail-input"/);
  assert.match(app, /data-notice-edit/);
});

test("packing data keeps every supplied item on its own row and assigns luggage", () => {
  const packing = tripData.preTrip.packingItems.filter((item) => item.category === "packing");
  assert.equal(packing.length, 99);
  assert.ok(packing.some((item) => item.text === "身份证" && item.luggage === "daily-bag"));
  assert.ok(packing.some((item) => item.text === "三合一冲锋衣（抓绒一件，外壳两件）" && item.luggage === "clothes-case"));
  assert.ok(packing.some((item) => item.text === "一次性马桶垫（2个）" && item.luggage === "daily-bag"));
});

test("the first two days keep the supplied timed driving itinerary", () => {
  const [dayOne, dayTwo] = tripData.days;
  assert.equal(dayOne.schedule[0].time, "10:30");
  assert.ok(dayOne.schedule.some((item) => item.time === "13:00" && item.text.includes("抵达天全服务区") && item.detail.includes("打卡318标志")));
  assert.ok(dayOne.schedule.some((item) => item.time === "20:55" && item.text.includes("抵达新都桥") && item.text.includes("Holiday View")));
  assert.ok(dayOne.schedule.some((item) => item.time === "22:55" && item.text.includes("回房休息")));
  assert.equal(dayTwo.schedule[0].time, "08:00");
  assert.ok(dayTwo.schedule.some((item) => item.time === "11:57" && item.text.includes("抵达道孚县") && item.detail.includes("中国熊猫大道/G350")));
  assert.ok(dayTwo.schedule.some((item) => item.time === "14:28" && item.text.includes("抵达炉霍县") && item.detail.includes("400米道路施工")));
  assert.ok(dayTwo.schedule.some((item) => item.time === "16:40" && item.text.includes("抵达格萨尔王城")));
  assert.equal(dayTwo.locations.at(-1), "格萨尔王城");
  assert.match(app, /item\.detail \? `<div class="schedule-detail">/);
});

test("packing migration removes only the seven replaced generic system items", () => {
  assert.match(app, /const OBSOLETE_PACKING_ITEM_IDS = new Set/);
  assert.match(app, /packing-documents/);
  assert.match(app, /applyChange\("todos", \{ id: todo\.id \}, "delete"\)/);
});

test("three top-level areas are marked as independent display panels", () => {
  assert.match(html, /data-travel-panel="info"/);
  assert.match(html, /data-travel-panel="packing"/);
  assert.match(html, /data-travel-panel="notices"/);
});

test("travel information orders route before flights and uses a fresh navigation script version", () => {
  assert.ok(html.indexOf('id="route"') < html.indexOf('id="flights"'));
  assert.ok(html.indexOf('href="#route"') < html.indexOf('href="#flights"'));
  assert.match(html, /site-navigation\.js\?v=20260920-4/);
});

test("navigation marks the selected top-level panel as current", () => {
  assert.match(navigation, /packingTrigger/);
  assert.match(navigation, /noticesLink/);
  assert.match(navigation, /activePanel === "packing"/);
});

test("all top-level navigation items share the current-page highlight", () => {
  assert.match(styles, /\.topbar nav a\[aria-current="page"\]/);
  assert.match(styles, /#travel-navigation-trigger\[aria-current="page"\]/);
});

test("toilet notes retain every supplied location across trusted and warning groups", () => {
  const toilets = tripData.preTrip.packingItems.filter((item) => item.subcategory === "toilet");
  assert.equal(toilets.filter((item) => item.group === "殿堂级").length, 9);
  assert.equal(toilets.filter((item) => item.group === "雷区警示").length, 8);
  assert.ok(toilets.some((item) => item.text === "四姑娘山双桥沟" && item.detail.includes("全自动感应冲水")));
  assert.ok(toilets.some((item) => item.text === "墨石公园厕所" && item.detail.includes("为什么要搅拌阿")));
});

test("Dege-area toilet notes retain all supplied conditions and are mapped", () => {
  const toilets = tripData.preTrip.packingItems.filter((item) => item.subcategory === "toilet");
  const pins = tripData.preTrip.toiletMapPins || [];
  const find = (id) => toilets.find((item) => item.id === id);
  assert.ok(find("toilet-manigango-petrochina")?.detail.includes("第一个比较不错的厕所"));
  assert.ok(find("toilet-yulong-visitor-center")?.detail.includes("绝对是TOP级别"));
  assert.ok(find("toilet-queershan-tunnel")?.detail.includes("具体情况暂不明"));
  assert.ok(find("toilet-dege-printing-house")?.detail.includes("仅供应急"));
  assert.ok(find("toilet-gatuo-temple")?.detail.includes("两星水平"));
  assert.ok(find("toilet-bluesong-lake")?.detail.includes("极其不推荐"));
  assert.ok(pins.some((pin) => pin.todoId === "toilet-manigango-petrochina"));
  assert.ok(pins.some((pin) => pin.todoId === "toilet-bluesong-lake"));
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

test("notice subcategory settings preserve a manual group order and collapsed groups", () => {
  const settings = normalizeNoticeSubcategorySettings({
    order: ["使用经验与消耗", "装备购买建议", "未知分组"],
    collapsed: ["装备购买建议", "未知分组"]
  }, ["装备购买建议", "使用经验与消耗", "科学用药指南"]);

  assert.deepEqual([...settings.order], ["使用经验与消耗", "装备购买建议", "科学用药指南"]);
  assert.deepEqual([...settings.collapsed], ["装备购买建议"]);
});

test("notices provide a single-category selector and drag-managed collapsible subcategories", () => {
  assert.match(html, /id="notice-category-tabs"/);
  assert.match(html, /id="notice-category-manager"/);
  assert.match(app, /collapsedNoticeGroups/);
  assert.match(app, /draggable="true"/);
  assert.match(app, /ondrop/);
  assert.match(app, /data-notice-group-label/);
  assert.doesNotMatch(app, /data-notice-category-move/);
});

test("memos keep health, toilet, and food categories and reset subcategories to expanded by default", () => {
  assert.match(app, /notice: \{ health: "健康", toilet: "厕所", food: "美食" \}/);
  assert.doesNotMatch(app, /rental: "租车与验车"/);
  assert.match(app, /notice-group-settings-v2/);
  assert.match(app, /collapsed: \[\]/);
});

test("packing overview shows each person's actual category and tag quantities without expected-goal management", () => {
  assert.match(html, /href="#packing-overview"[^>]*>总览</);
  assert.match(html, /id="packing-overview"/);
  assert.match(app, /overview: "行囊总览"/);
  assert.match(app, /function packingOverviewCategoryTotals/);
  assert.match(app, /packingQuantityFor\(todo\)/);
  assert.match(app, /data-packing-overview-owner/);
  assert.doesNotMatch(app, /data-essential-form-open/);
  assert.doesNotMatch(app, /data-essential-edit/);
  assert.doesNotMatch(app, /预期数量/);
  assert.match(styles, /\.packing-overview-value/);
});

test("packing supports an untagged option, migrates common to it, and shows its item category in the overview", () => {
  assert.match(app, /value="" \$\{!selected \? "selected" : ""\}>无标签/);
  assert.match(app, /todo\.property === "common" \|\| todo\.property === "none"\) return ""/);
  assert.match(app, /label: !tag \? packingCategoryLabel\(category\)/);
  assert.doesNotMatch(app, /common: "常用"/);
});

test("packing overview gives each person a stronger visual hierarchy than item categories and tags", () => {
  assert.match(styles, /\.packing-overview-card__heading \{[^}]*font-size: 22px/);
  assert.match(styles, /\.packing-overview-tag \{[^}]*font-size: 17px/);
});

test("deleted authored packing items stay deleted instead of being seeded again on the next visit", () => {
  assert.match(app, /function removedAuthoredPackingTodoIdsKey/);
  assert.match(app, /removedAuthoredTodoIds\.has\(item\.id\)/);
  assert.match(app, /rememberRemovedAuthoredPackingTodo\(todo\)/);
});

test("consumable uses stay inline with the packing item name before the overflow menu", () => {
  assert.match(app, /packing-item-meta packing-item-meta--inline/);
  assert.match(app, /packing-item-meta packing-item-meta--inline.*data-todo-use/);
  assert.match(styles, /\.packing-item-meta--inline \{[^}]*margin-top: 0/);
});

test("D1 shared mode gates access with a remembered invite code and migrates existing packing data once", () => {
  assert.equal(tripData.config.persistence.mode, "d1");
  assert.deepEqual(tripData.config.persistence.sharedCollections, ["todos"]);
  assert.match(html, /id="shared-access-gate"/);
  assert.match(html, /id="shared-access-form"/);
  assert.match(app, /function requestSharedAccessCode/);
  assert.match(app, /function migrateLocalTodosToD1/);
  assert.match(app, /function d1LocalMigrationKey/);
  assert.match(app, /accessCode: state\.sharedAccessCode/);
});

test("shared trip API hashes invite codes and restricts record writes to the requested collection", () => {
  const api = fs.readFileSync(path.join(__dirname, "..", "functions", "api", "trip", "[tripId].js"), "utf8");
  const schema = fs.readFileSync(path.join(__dirname, "..", "migrations", "0001_shared_trip.sql"), "utf8");
  assert.match(api, /x-travel-access-code/);
  assert.match(api, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(api, /TRIP_DB/);
  assert.match(api, /ALLOWED_COLLECTIONS/);
  assert.match(api, /trip_initialization/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS trip_access/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS trip_records/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS trip_initialization/);
});

test("packing and notice category headings keep their chevrons beside the category name", () => {
  assert.match(app, /packing-category-toggle.*packing-category-toggle__title.*<i aria-hidden="true">⌄<\/i>.*<small>/);
  assert.match(app, /notice-subcategory__toggle.*notice-subcategory__title.*<i aria-hidden="true">⌄<\/i>.*<small>/);
});

test("packing rows keep the overflow trigger inside the row and add form fields on one desktop row", () => {
  assert.match(styles, /\.todo-item \{[^}]*padding-inline/);
  assert.match(html, /packing-form-selectors--add[\s\S]*packing-input[\s\S]*packing-add-todo-form__actions/);
  assert.match(styles, /\.packing-form-selectors--add \{[^}]*grid-template-columns:.*minmax\(180px, 2fr\).*auto/);
});

test("packing overflow control is compact and does not draw a white square", () => {
  assert.match(styles, /\.todo-more summary \{[^}]*width: 24px[^}]*height: 24px[^}]*border: 0[^}]*background: transparent/);
});

test("packing overflow menu can duplicate an item above delete without changing the original", () => {
  assert.match(app, /data-packing-find[\s\S]*todo-edit[\s\S]*data-todo-copy[\s\S]*todo-delete/);
  assert.match(app, /event\.target\.closest\("\[data-todo-copy\]"\)/);
  assert.match(app, /const duplicate = \{ \.\.\.todo,[\s\S]*completed: false/);
  assert.doesNotMatch(app, /text: `\$\{todo\.text\}（副本）`/);
  assert.match(app, /state\.todos\.push\(duplicate\)/);
});

test("packing items support a full-field edit form and dismiss overflow menus outside the row", () => {
  assert.match(app, /editingPackingTodoId/);
  assert.match(app, /data-packing-edit-form/);
  assert.match(app, /data-packing-edit-cancel/);
  assert.match(app, /data-packing-edit-category/);
  assert.match(app, /data-packing-edit-owner/);
  assert.match(app, /data-packing-edit-property/);
  assert.match(app, /data-packing-edit-quantity/);
  assert.match(app, /data-packing-edit-uses/);
  assert.match(app, /event\.target\.closest\("\.todo-more"\)/);
  assert.match(app, /\$\("#packing-list"\)\.onsubmit/);
});

test("packing edit save uses an explicit click action for dynamic edit forms", () => {
  assert.match(app, /data-packing-edit-submit/);
  assert.match(app, /event\.target\.closest\("\[data-packing-edit-submit\]"\)/);
  assert.match(app, /submitPackingEdit\(\{ target: editSave\.closest/);
});

test("custom packing category names use a dedicated row below the add-item fields", () => {
  assert.match(html, /data-packing-custom-category-row[^>]*hidden/);
  assert.match(styles, /\.todo-form\.packing-add-todo-form \{[^}]*grid-template-columns: 1fr/);
});

test("packing overview folds shared items into both personal cards without a shared card", () => {
  assert.match(app, /\.filter\(\(todo\) => \[owner, "shared"\]\.includes\(packingOwnerFor\(todo\)\)\)/);
  assert.match(app, /const owners = \["ma-jia", "zai-zai"\]/);
  assert.doesNotMatch(app, /const owners = \["shared", "ma-jia", "zai-zai"\]/);
});

test("packing add and edit forms provide matching custom category and tag fields", () => {
  assert.match(html, /data-packing-custom-category-row[^>]*hidden/);
  assert.match(html, /data-packing-custom-property-row[^>]*hidden/);
  assert.match(app, /packing-custom-category-field[^>]*data-packing-edit-custom-category-row/);
  assert.match(app, /packing-custom-category-field[^>]*data-packing-edit-custom-property-row/);
  assert.match(app, /新增标签…/);
  assert.match(app, /function packingPropertyLabel/);
});

test("saved custom packing tags are reusable through their assigned item categories", () => {
  assert.match(app, /function packingCustomPropertyValues\(\)/);
  assert.match(app, /function packingTagAssociationsKey\(\)/);
  assert.match(app, /function packingTagsForCategory\(category\)/);
  assert.match(app, /const packingPropertyFilterOptions = \[/);
});

test("packing overview groups tag totals in collapsible categories sorted by quantity", () => {
  assert.match(app, /collapsedPackingOverviewCategories/);
  assert.match(app, /function packingOverviewCategoryTotals\(owner\)/);
  assert.match(app, /packing-overview-category-toggle/);
  assert.match(app, /data-packing-overview-category/);
  assert.match(app, /sort\(\(first, second\) => second\.quantity - first\.quantity\)/);
});

test("packing overview resolves categories and tags through the dictionary and opens tag item lists", () => {
  assert.match(app, /function packingDictionaryCategoryFor\(todo\)/);
  assert.match(app, /function packingDictionaryPropertyFor\(todo, category/);
  assert.match(app, /data-packing-overview-tag/);
  assert.match(app, /packing-overview-dialog/);
  assert.match(app, /data-packing-overview-dialog-close/);
});

test("packing supports untagged items, child-only luggage folding, and luggage reset before checking", () => {
  assert.match(app, /function packingDictionaryPropertyFor\(todo, category/);
  assert.match(app, /data-packing-luggage-add-open/);
  assert.match(app, /data-packing-check-luggage-reset/);
  assert.match(app, /hasChildren \? `<details/);
  assert.match(app, /value=""[^>]*>无标签/);
  assert.match(app, /function packingDictionaryLuggageFor\(todo\)/);
});

test("packing dictionary exposes category-to-tag associations and manages them", () => {
  assert.match(html, /href="#packing-dictionary"[^>]*>字典</);
  assert.match(html, /id="packing-dictionary"/);
  assert.match(app, /dictionary: "字典设置"/);
  assert.match(app, /data-packing-dictionary-tag/);
  assert.match(app, /data-packing-dictionary-tag-add/);
  assert.match(app, /attachPackingTagToCategory/);
});

test("packing dictionary creates a tag from each category overflow menu instead of a top-level form", () => {
  assert.doesNotMatch(app, /packing-dictionary__add/);
  assert.match(app, /data-packing-dictionary-tag-create/);
  assert.match(app, /data-packing-dictionary-tag-add/);
  assert.match(app, /data-packing-dictionary-category-delete/);
});

test("dictionary has category and luggage-use subcategories with sortable categories", () => {
  assert.match(app, /activePackingDictionaryTab/);
  assert.match(app, /data-packing-dictionary-tab="luggage"/);
  assert.match(app, /data-packing-dictionary-category-drag/);
  assert.match(app, /function movePackingDictionaryCategory\(/);
  assert.match(app, /data-packing-luggage-add/);
  assert.match(app, /data-packing-luggage-parent/);
  assert.match(app, /data-packing-luggage-icon/);
  assert.match(app, /packing-overview-owner="all"[^>]*>共同</);
});

test("packing luggage management hides detail container filters and uses direct actions", () => {
  assert.doesNotMatch(html, /id="packing-container-filter-group"/);
  assert.match(app, /class="packing-luggage-actions"/);
  assert.match(app, /data-packing-luggage-parent/);
  assert.match(app, /todo\.container = key/);
  assert.match(app, /todo\.luggage = parent \|\| key/);
});

test("new packing categories and labels synchronize into dictionary branches", () => {
  assert.match(app, /function syncPackingDictionaryCategory\(category, property = ""\)/);
  assert.match(app, /state\.packingCustomCategories\[subcategory\] = label/);
  assert.match(app, /syncPackingDictionaryCategory\(subcategory, property\)/);
});

test("packing dictionary uses a collapsible tree and supports dragging tags between categories", () => {
  assert.match(app, /<details class="packing-dictionary-branch"/);
  assert.match(app, /draggable="true" data-packing-dictionary-tag/);
  assert.match(app, /ondragstart/);
  assert.match(app, /event\.dataTransfer\.getData\("text\/plain"\)/);
  assert.match(app, /ondrop/);
  assert.match(app, /data-packing-dictionary-unlink/);
});

test("packing dictionary reorders tags, keeps open branches open after removal, and manages categories from an overflow menu", () => {
  assert.match(app, /data-packing-dictionary-tag-drop/);
  assert.match(app, /function movePackingDictionaryTag\(/);
  assert.match(app, /function rememberOpenPackingDictionaryBranches\(/);
  assert.match(app, /expandedPackingDictionaryCategories/);
  assert.match(app, /data-packing-dictionary-category-edit/);
  assert.match(app, /data-packing-dictionary-category-delete/);
  assert.match(app, /todo-more__menu/);
});

test("packing dictionary hides tag counts, dismisses category editing on outside clicks, and confirms only nonempty category deletion", () => {
  assert.doesNotMatch(app, /<small>\$\{tags\.length\} 个标签<\/small>/);
  assert.match(app, /packingDictionaryOutsideHandler/);
  assert.match(app, /data-packing-dictionary-category-edit/);
  assert.match(app, /if \(tags\.length && !window\.confirm/);
  assert.match(styles, /packing-dictionary-branch__actions \{[^}]*right: 18px/);
});

test("packing additions keep the last category, owner, tag, and quantity for repeated entry", () => {
  assert.match(app, /packingAddDefaults: \{ subcategory: "documents", owner: "shared", property: "", quantity: "1", usesTotal: "1" \}/);
  assert.match(app, /state\.packingAddDefaults = \{ subcategory, owner, property/);
  assert.match(app, /\$\("#packing-subcategory"\)\.value = packingAddDefaults\.subcategory/);
  assert.doesNotMatch(app, /\$\("#packing-owner"\)\.value = "shared"/);
  assert.doesNotMatch(app, /\$\("#packing-quantity"\)\.value = "1"/);
});
