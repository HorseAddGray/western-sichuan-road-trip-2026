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
  const noticeGroupOrder = ["吸氧费用", "温馨提示", "科学用药指南", "殿堂级", "雷区警示"];

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

  globalThis.TravelPrep = { normalizeTodoCategory, filterTodosByCategory, normalizeTodoSubcategory, sortNoticeItems };
})();
