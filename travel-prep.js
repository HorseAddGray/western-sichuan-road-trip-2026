(() => {
  function normalizeTodoCategory(todo) {
    return todo?.category === "packing" ? "packing" : "notice";
  }

  function filterTodosByCategory(todos, category) {
    return todos.filter((todo) => normalizeTodoCategory(todo) === category);
  }

  globalThis.TravelPrep = { normalizeTodoCategory, filterTodosByCategory };
})();
