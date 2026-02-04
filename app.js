const STORAGE_KEY = "fluxo-data-v1";
const CATEGORY_KEYWORDS = {
  Alimentação: ["pizza", "mercado", "restaurante", "ifood", "lanche", "hamburguer"],
  Saúde: ["farmacia", "médico", "medico", "academia", "remedio"],
  Lazer: ["uber", "cinema", "viagem", "netflix", "show", "streaming"],
  Contas: ["luz", "agua", "aluguel", "internet", "condominio"],
  Compras: ["roupa", "eletronico", "amazon", "shopping"],
  Outros: [],
  Receitas: ["salario", "freelance", "pix", "bonus"],
};

const state = {
  incomeGoal: 4500,
  categoryGoals: {
    Alimentação: 900,
    Saúde: 450,
    Lazer: 500,
    Contas: 1200,
    Compras: 650,
  },
  fixedCosts: [],
  transactions: [],
  learned: {},
};

const elements = {
  currentBalance: document.getElementById("current-balance"),
  monthIncome: document.getElementById("month-income"),
  monthExpense: document.getElementById("month-expense"),
  dailySafe: document.getElementById("daily-safe"),
  weeklyBalance: document.getElementById("weekly-balance"),
  spotlightGoal: document.getElementById("spotlight-goal"),
  dailyAverage: document.getElementById("daily-average"),
  smartInput: document.getElementById("smart-input"),
  addTransaction: document.getElementById("add-transaction"),
  smartPreview: document.getElementById("smart-preview"),
  previewDesc: document.getElementById("preview-desc"),
  previewCategory: document.getElementById("preview-category"),
  previewAmount: document.getElementById("preview-amount"),
  goals: document.getElementById("goals"),
  fixedList: document.getElementById("fixed-list"),
  addFixed: document.getElementById("add-fixed"),
  statement: document.getElementById("statement"),
  categoryChart: document.getElementById("category-chart"),
  chartLegend: document.getElementById("chart-legend"),
  filterType: document.getElementById("filter-type"),
  filterCategory: document.getElementById("filter-category"),
  exportCsv: document.getElementById("export-csv"),
  exportJson: document.getElementById("export-json"),
  importFile: document.getElementById("import-file"),
};

const templates = {
  goal: document.getElementById("goal-template"),
  fixed: document.getElementById("fixed-template"),
  statementGroup: document.getElementById("statement-group-template"),
  statementItem: document.getElementById("statement-item-template"),
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.assign(state, data);
  } catch (error) {
    console.warn("Falha ao carregar dados", error);
  }
};

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

const detectCategory = (description) => {
  const normalized = normalize(description);
  if (state.learned[normalized]) {
    return state.learned[normalized];
  }
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }
  return "Outros";
};

const parseSmartInput = (value) => {
  const normalized = value.replace(/,/g, ".").trim();
  const numberMatch = normalized.match(/(-?\d+(?:\.\d+)?)/);
  const amount = numberMatch ? Number(numberMatch[1]) : 0;
  const description = normalized.replace(numberMatch?.[1] ?? "", "").trim() || "Sem descrição";
  const isIncome = normalized.startsWith("+") || /receita|salario|salário|bonus|pix/i.test(normalized);
  const category = isIncome ? "Receitas" : detectCategory(description);
  return {
    description,
    amount: Math.abs(amount),
    type: isIncome ? "income" : "expense",
    category,
  };
};

const updateSmartPreview = () => {
  const value = elements.smartInput.value;
  if (!value) {
    elements.previewDesc.textContent = "-";
    elements.previewCategory.textContent = "-";
    elements.previewAmount.textContent = "-";
    return;
  }
  const parsed = parseSmartInput(value);
  elements.previewDesc.textContent = parsed.description;
  elements.previewCategory.textContent = parsed.category;
  elements.previewAmount.textContent = currency.format(parsed.amount || 0);
};

const addTransaction = () => {
  const value = elements.smartInput.value.trim();
  if (!value) return;
  const parsed = parseSmartInput(value);
  if (!parsed.amount) return;
  const now = new Date();
  const entry = {
    id: crypto.randomUUID(),
    description: parsed.description,
    amount: parsed.amount,
    type: parsed.type,
    category: parsed.category,
    date: now.toISOString(),
  };
  state.transactions.unshift(entry);
  state.learned[normalize(parsed.description)] = parsed.category;
  elements.smartInput.value = "";
  updateSmartPreview();
  saveState();
  render();
};

const formatAmount = (amount, type) =>
  `${type === "expense" ? "-" : "+"}${currency.format(amount)}`;

const getMonthTransactions = () => {
  const now = new Date();
  return state.transactions.filter((item) => {
    const date = new Date(item.date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
};

const getRecentTransactions = (days) => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);
  return state.transactions.filter((item) => new Date(item.date) >= cutoff);
};

const calculateSummary = () => {
  const monthItems = getMonthTransactions();
  const income = monthItems.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const expense = monthItems.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const fixedTotal = state.fixedCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const balance = income - expense - fixedTotal;
  return { income, expense, fixedTotal, balance };
};

const calculateDailySafe = () => {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const { income, expense, fixedTotal } = calculateSummary();
  const remaining = state.incomeGoal + income - expense - fixedTotal;
  return remaining / Math.max(daysLeft, 1);
};

const renderSummary = () => {
  const { income, expense, balance } = calculateSummary();
  elements.currentBalance.textContent = currency.format(balance);
  elements.monthIncome.textContent = currency.format(income);
  elements.monthExpense.textContent = currency.format(expense);
  elements.dailySafe.textContent = currency.format(calculateDailySafe());
};

const renderWidgets = () => {
  const lastWeek = getRecentTransactions(7);
  const weekIncome = lastWeek.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const weekExpense = lastWeek.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  elements.weeklyBalance.textContent = currency.format(weekIncome - weekExpense);

  const monthExpenses = getMonthTransactions().filter((t) => t.type === "expense");
  const totalExpense = monthExpenses.reduce((sum, t) => sum + t.amount, 0);
  const daysElapsed = new Date().getDate();
  elements.dailyAverage.textContent = currency.format(totalExpense / Math.max(daysElapsed, 1));

  const spotlight = Object.entries(state.categoryGoals).map(([category, goal]) => {
    const used = monthExpenses.filter((t) => t.category === category).reduce((sum, t) => sum + t.amount, 0);
    return { category, used, goal, ratio: goal ? used / goal : 0 };
  });
  spotlight.sort((a, b) => b.ratio - a.ratio);
  const top = spotlight[0];
  elements.spotlightGoal.textContent = top ? `${top.category} • ${Math.round(top.ratio * 100)}%` : "-";
};

const drawChart = () => {
  const canvas = elements.categoryChart;
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = 260 * window.devicePixelRatio;
  context.scale(window.devicePixelRatio, window.devicePixelRatio);
  context.clearRect(0, 0, rect.width, 260);

  const categories = Object.keys(state.categoryGoals);
  const monthExpenses = getMonthTransactions().filter((t) => t.type === "expense");
  const totals = categories.map((category) =>
    monthExpenses.filter((t) => t.category === category).reduce((sum, t) => sum + t.amount, 0),
  );
  const maxValue = Math.max(...totals, 1);
  const barWidth = rect.width / (categories.length * 1.4);
  const gap = barWidth * 0.4;
  const baseY = 220;

  const colors = ["#0df26c", "#5ef9a6", "#2ad0ff", "#9b7bff", "#ff7a90"];
  categories.forEach((category, index) => {
    const value = totals[index];
    const height = (value / maxValue) * 140;
    const x = 20 + index * (barWidth + gap);
    const y = baseY - height;
    context.fillStyle = colors[index % colors.length];
    context.globalAlpha = 0.9;
    context.fillRect(x, y, barWidth, height);
    context.globalAlpha = 1;
  });

  elements.chartLegend.innerHTML = "";
  categories.forEach((category, index) => {
    const legend = document.createElement("div");
    legend.className = "legend-item";
    legend.innerHTML = `<span class="legend-swatch" style="background:${colors[index % colors.length]}"></span>${category}`;
    elements.chartLegend.appendChild(legend);
  });
};

const renderGoals = () => {
  elements.goals.innerHTML = "";
  const summary = calculateSummary();
  const usedByCategory = getMonthTransactions()
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const categories = Object.keys(state.categoryGoals);
  const allGoals = [
    { key: "income", label: "Renda mensal", value: state.incomeGoal, used: summary.income },
    ...categories.map((category) => ({
      key: category,
      label: category,
      value: state.categoryGoals[category],
      used: usedByCategory[category] || 0,
    })),
  ];

  allGoals.forEach((goal) => {
    const node = templates.goal.content.cloneNode(true);
    const label = node.querySelector(".label");
    const valueButton = node.querySelector(".goal-value");
    const progress = node.querySelector(".progress-bar");

    label.textContent = goal.label;
    valueButton.textContent = currency.format(goal.value);
    const percentage = goal.value ? Math.min((goal.used / goal.value) * 100, 100) : 0;
    progress.style.width = `${percentage}%`;

    valueButton.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "number";
      input.value = goal.value;
      input.className = "goal-value";
      input.addEventListener("blur", () => {
        const newValue = Number(input.value);
        if (goal.key === "income") {
          state.incomeGoal = newValue;
        } else {
          state.categoryGoals[goal.key] = newValue;
        }
        saveState();
        render();
      });
      valueButton.replaceWith(input);
      input.focus();
    });

    elements.goals.appendChild(node);
  });
};

const renderFixedCosts = () => {
  elements.fixedList.innerHTML = "";
  if (!state.fixedCosts.length) {
    const empty = document.createElement("p");
    empty.className = "label";
    empty.textContent = "Nenhum gasto fixo cadastrado.";
    elements.fixedList.appendChild(empty);
    return;
  }
  state.fixedCosts.forEach((cost) => {
    const node = templates.fixed.content.cloneNode(true);
    node.querySelector("strong").textContent = cost.name;
    node.querySelector(".label").textContent = `${currency.format(cost.amount)} • dia ${cost.day}`;
    node.querySelector(".remove").addEventListener("click", () => {
      state.fixedCosts = state.fixedCosts.filter((item) => item.id !== cost.id);
      saveState();
      render();
    });
    elements.fixedList.appendChild(node);
  });
};

const renderFilters = () => {
  const baseCategories = Object.keys(state.categoryGoals);
  const categories = [
    "all",
    ...new Set([...baseCategories, ...state.transactions.map((t) => t.category)]),
  ];
  elements.filterCategory.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category === "all" ? "Todas categorias" : category;
    elements.filterCategory.appendChild(option);
  });
};

const renderStatement = () => {
  elements.statement.innerHTML = "";
  const typeFilter = elements.filterType.value;
  const categoryFilter = elements.filterCategory.value;
  const filtered = state.transactions.filter((item) => {
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesType && matchesCategory;
  });
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "label";
    empty.textContent = "Nenhum lançamento por aqui ainda.";
    elements.statement.appendChild(empty);
    return;
  }
  const grouped = filtered.reduce((acc, item) => {
    const date = new Date(item.date);
    const key = date.toDateString();
    acc[key] = acc[key] || { date, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {});

  Object.values(grouped)
    .sort((a, b) => b.date - a.date)
    .forEach((group) => {
      const node = templates.statementGroup.content.cloneNode(true);
      node.querySelector("h3").textContent = `${dateFormatter.format(group.date)} • ${monthFormatter.format(group.date)}`;
      const list = node.querySelector(".statement-items");
      group.items.forEach((item) => {
        const itemNode = templates.statementItem.content.cloneNode(true);
        itemNode.querySelector("strong").textContent = item.description;
        itemNode.querySelector(".label").textContent = item.category;
        const amount = itemNode.querySelector(".amount");
        amount.textContent = formatAmount(item.amount, item.type);
        amount.classList.add(item.type);
        list.appendChild(itemNode);
      });
      elements.statement.appendChild(node);
    });
};

const exportCsv = () => {
  const header = "id,description,amount,type,category,date";
  const rows = state.transactions.map((t) =>
    [t.id, t.description, t.amount, t.type, t.category, t.date]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([header, "\n", ...rows].join("\n"), { type: "text/csv" });
  downloadFile(blob, "fluxo-extrato.csv");
};

const exportJson = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  downloadFile(blob, "fluxo-backup.json");
};

const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const importFile = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  if (file.name.endsWith(".json")) {
    try {
      const data = JSON.parse(text);
      Object.assign(state, data);
    } catch (error) {
      alert("Backup inválido.");
    }
  } else if (file.name.endsWith(".csv")) {
    const lines = text.split("\n").slice(1).filter(Boolean);
    state.transactions = lines.map((line) => {
      const values = line.split(",").map((value) => value.replace(/^"|"$/g, ""));
      return {
        id: values[0],
        description: values[1],
        amount: Number(values[2]),
        type: values[3],
        category: values[4],
        date: values[5],
      };
    });
  }
  saveState();
  render();
};

const addFixedCost = () => {
  const name = prompt("Nome do gasto fixo:");
  if (!name) return;
  const amount = Number(prompt("Valor mensal (R$):"));
  if (!amount) return;
  const day = Number(prompt("Dia de vencimento:")) || 1;
  state.fixedCosts.push({
    id: crypto.randomUUID(),
    name,
    amount,
    day,
  });
  saveState();
  render();
};

const render = () => {
  renderSummary();
  renderWidgets();
  renderGoals();
  renderFixedCosts();
  renderFilters();
  renderStatement();
  drawChart();
};

const init = () => {
  loadState();
  render();
  updateSmartPreview();
  elements.smartInput.addEventListener("input", updateSmartPreview);
  elements.addTransaction.addEventListener("click", addTransaction);
  elements.smartInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      addTransaction();
    }
  });
  elements.addFixed.addEventListener("click", addFixedCost);
  elements.filterType.addEventListener("change", renderStatement);
  elements.filterCategory.addEventListener("change", renderStatement);
  elements.exportCsv.addEventListener("click", exportCsv);
  elements.exportJson.addEventListener("click", exportJson);
  elements.importFile.addEventListener("change", importFile);
  window.addEventListener("resize", () => {
    drawChart();
  });
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}

init();
