(() => {
  function normalizeTodoCategory(todo) {
    return todo?.category === "packing" ? "packing" : "notice";
  }

  function filterTodosByCategory(todos, category) {
    return todos.filter((todo) => normalizeTodoCategory(todo) === category);
  }

  function normalizeTodoSubcategory(todo) {
    return String(todo?.subcategory || "other");
  }

  const noticeSubcategoryOrder = ["health", "rental", "road", "toilet", "trip", "other"];
  const noticeGroupOrder = ["吸氧费用", "温馨提示", "装备购买建议", "使用经验与消耗", "科学用药指南", "殿堂级", "雷区警示"];

  function sortNoticeItems(items) {
    const subcategoryRank = (item) => {
      const rank = noticeSubcategoryOrder.indexOf(normalizeTodoSubcategory(item));
      return rank === -1 ? noticeSubcategoryOrder.length : rank;
    };
    const groupRank = (item) => {
      const rank = noticeGroupOrder.indexOf(String(item?.group || ""));
      return rank === -1 ? noticeGroupOrder.length : rank;
    };
    return items.map((item, index) => ({ item, index })).sort((a, b) =>
      subcategoryRank(a.item) - subcategoryRank(b.item) || groupRank(a.item) - groupRank(b.item) || a.index - b.index
    ).map(({ item }) => item);
  }

  function normalizeNoticeCategorySettings(settings, categoryKeys) {
    const keys = [...new Set(categoryKeys.map(String))];
    const requestedOrder = Array.isArray(settings?.order) ? settings.order.map(String) : [];
    const order = [...requestedOrder.filter((key) => keys.includes(key)), ...keys.filter((key) => !requestedOrder.includes(key))]
      .filter((key, index, all) => all.indexOf(key) === index);
    const labels = Object.fromEntries(Object.entries(settings?.labels || {}).filter(([key, value]) =>
      keys.includes(key) && typeof value === "string" && value.trim()
    ).map(([key, value]) => [key, value.trim().slice(0, 24)]));
    const collapsed = (Array.isArray(settings?.collapsed) ? settings.collapsed : []).map(String)
      .filter((key, index, all) => keys.includes(key) && all.indexOf(key) === index);
    return { order, labels, collapsed };
  }

  globalThis.TravelPrep = { normalizeTodoCategory, filterTodosByCategory, normalizeTodoSubcategory, sortNoticeItems, normalizeNoticeCategorySettings };
})();
