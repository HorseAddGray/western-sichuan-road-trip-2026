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

  globalThis.TravelPrep = { normalizeTodoCategory, filterTodosByCategory, normalizeTodoSubcategory };
})();
