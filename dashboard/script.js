// dashboard/script.js

// --- ESTADO GLOBAL ---
const state = {
  transactions: [],
  filtered: [],
  chart: null,
  lastId: 100,
  simulationHandle: null,
  apiOnline: false,
};

document.addEventListener("DOMContentLoaded", () => {
  fetchData(); // Carga inicial desde API o modo demo si falla
  wireSearch(); // Búsqueda en vivo
});

// --- CONEXIÓN A LA API (con fallback a MODO DEMO) ---
async function fetchData() {
  const status = document.getElementById("status");
  const live = document.getElementById("live-indicator");

  try {
    // Ruta RELATIVA al mismo servidor que sirve el frontend (evita CORS)
    const response = await fetch("/dashboard");
    if (!response.ok) throw new Error("API no disponible");

    const data = await response.json();

    // API funcionando
    state.apiOnline = true;
    if (live) {
      live.textContent = "● EN VIVO";
      live.style.color = "#2ecc71";
    }
    if (status) status.textContent = "API conectada";

    state.transactions = Array.isArray(data.transactions)
      ? data.transactions
      : [];
    state.filtered = state.transactions.slice();

    updateUI(data);
    startRealtimeSimulation();
  } catch (error) {
    // API caída → MODO DEMO
    console.warn("API caída. Activando MODO DEMO.", error?.message || "");
    state.apiOnline = false;

    if (live) {
      live.textContent = "● MODO DEMO";
      live.style.color = "#e74c3c";
    }
    if (status) status.textContent = "Modo Demo Activo";

    stopRealtimeSimulation();

    // Cargar datos locales de demo (ubicado en /dashboard/data.json)
    try {
      const local = await fetch("./data.json").then((r) => r.json());
      state.transactions = Array.isArray(local.transactions)
        ? local.transactions
        : [];
      state.filtered = state.transactions.slice();
      updateUI(local);
    } catch (e) {
      console.error("No se pudo cargar data.json en modo demo:", e);
      if (status) status.textContent = "No se pudo cargar datos de demo";
    }
  }
}

// --- PINTADO GENERAL DE LA UI ---
function updateUI(data) {
  renderMetrics(data.metrics);
  renderTable(state.filtered);
  renderChart(state.filtered);
}

// --- MÉTRICAS (Tarjetas blancas controladas por CSS) ---
function renderMetrics(metrics) {
  const container = document.getElementById("metrics-cards");
  if (!container) return;

  const list = Array.isArray(metrics) ? metrics : [];

  // Usamos clases (sin estilos inline) para que tu CSS controle la apariencia
  container.innerHTML = list
    .map(
      (m) => `
        <div class="metric-card">
          <div class="title">${m.title ?? ""}</div>
          <div class="value">${m.value ?? ""}</div>
        </div>
      `,
    )
    .join("");
}

// --- TABLA ---
function renderTable(rows) {
  const tbody = document.getElementById("tbody-transacciones");
  if (!tbody) return;

  tbody.innerHTML = "";

  // Muestra las últimas 7 (ordenadas descendente por fecha agregada)
  rows
    .slice(-7)
    .reverse()
    .forEach((t) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${t.id}</td>
        <td>${t.product}</td>
        <td>${formatDate(t.date)}</td>
        <td style="text-align:right;">$${Number(t.amount).toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    });
}

// --- BÚSQUEDA EN VIVO ---
function wireSearch() {
  const input = document.getElementById("search");
  if (!input) return;

  input.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();

    if (!q) {
      state.filtered = state.transactions.slice();
    } else {
      state.filtered = state.transactions.filter(
        (t) =>
          (t.product || "").toLowerCase().includes(q) ||
          String(t.id || "")
            .toLowerCase()
            .includes(q),
      );
    }

    renderTable(state.filtered);
    renderChart(state.filtered);
  });
}

// --- GRÁFICO ---
function renderChart(rows) {
  const canvas = document.getElementById("ventasPorDiaChart");
  if (!canvas) return;

  const dataSource =
    Array.isArray(rows) && rows.length ? rows : state.transactions;

  // Sumarizar por hora:minuto (últimos 50 registros)
  const map = {};
  dataSource.slice(-50).forEach((t) => {
    const label = new Date(t.date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    map[label] = (map[label] || 0) + Number(t.amount);
  });

  const labels = Object.keys(map);
  const values = Object.values(map);

  if (state.chart) {
    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = values;
    state.chart.update();
  } else {
    // Requiere Chart.js por CDN en index.html
    state.chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Ventas USD",
            data: values,
            borderColor: "#610000",
            backgroundColor: "rgba(97,0,0,0.10)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
        },
        scales: {
          x: { ticks: { autoSkip: true, maxTicksLimit: 8 } },
          y: { beginAtZero: true },
        },
      },
    });
  }
}

// --- SIMULACIÓN (SOLO SI LA API ESTÁ ARRIBA) ---
function startRealtimeSimulation() {
  if (state.simulationHandle || !state.apiOnline) return;

  state.simulationHandle = setInterval(() => {
    if (!state.apiOnline) return;

    const products = ["RAM DDR4", "SSD 1TB", "Mouse Pro", "Monitor 24'"];
    const newTx = {
      id: `txn_${++state.lastId}`,
      product: products[Math.floor(Math.random() * products.length)],
      date: new Date().toISOString(),
      amount: +(Math.random() * 150 + 20).toFixed(2),
    };

    state.transactions.push(newTx);
    if (state.transactions.length > 500) {
      state.transactions = state.transactions.slice(-500);
    }

    state.filtered = state.transactions.slice();
    renderTable(state.filtered);
    renderChart(state.filtered);
  }, 5000);
}

function stopRealtimeSimulation() {
  if (state.simulationHandle) clearInterval(state.simulationHandle);
  state.simulationHandle = null;
}

// --- UTIL ---
function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("es-VE", { hour12: false });
}
