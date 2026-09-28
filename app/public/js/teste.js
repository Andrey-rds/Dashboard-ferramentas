const viewsOrder = ['diario', 'semanal', 'mensal'];
const ROTATION_INTERVAL = 30;
let currentViewIndex = 0;
let timerSeconds = ROTATION_INTERVAL;
let mainChart = null;
let viewsData = {};
let radioProcesses = [];
let errorMessages = [];

async function carregarDados() {
  const resposta = await fetch('/dados_radio_locutor.json?t=' + Date.now());
  if (!resposta.ok) throw new Error('Falha ao carregar dados_radio_locutor.json');

  const dados = await resposta.json();
  viewsData = dados.visoes || {};
  radioProcesses = dados.processos_radio || [];
  errorMessages = dados.mensagens_erro || [];
}

function initChart() {
  const data = viewsData.diario;
  const ctx = document.getElementById('mainChart').getContext('2d');

  mainChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Sucesso (Código 200)',
          data: data.chartSucesso,
          backgroundColor: '#f59e0b',
          borderColor: '#f59e0b',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Problema (Código != 200)',
          data: data.chartProblema,
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#16181e',
          borderColor: '#202430',
          borderWidth: 1,
          titleFont: { size: 13, weight: 'bold', family: 'Outfit' },
          bodyFont: { size: 12, family: 'JetBrains Mono' },
          padding: 8
        }
      },
      scales: {
        x: {
          grid: { color: '#1e222d', lineWidth: 1 },
          ticks: { color: '#94a3b8', font: { size: 11, weight: 'bold', family: 'Outfit' } }
        },
        y: {
          grid: { color: '#1e222d', lineWidth: 1 },
          ticks: { color: '#64748b', font: { size: 10, weight: 'bold', family: 'JetBrains Mono' } }
        }
      }
    }
  });
}

function updateDashboardUI(viewKey) {
  const data = viewsData[viewKey];
  if (!data) return;

  document.getElementById('tv-view-name').innerText = data.viewName;
  document.getElementById('badge-period-1').innerText = data.badgeText;
  document.getElementById('chart-title').innerText = data.chartTitle;
  document.getElementById('kpi-total').innerText = data.total;
  document.getElementById('kpi-total-sub').innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> ${data.trendTotal}`;
  document.getElementById('kpi-sucesso').innerText = data.sucesso;
  document.getElementById('kpi-sucesso-rate').innerText = data.sucessoRate;
  document.getElementById('kpi-sucesso-bar').style.width = data.sucessoRate;
  document.getElementById('kpi-problema').innerText = data.problema;
  document.getElementById('kpi-problema-rate').innerText = data.problemaRate;
  document.getElementById('kpi-problema-bar').style.width = data.problemaRate;

  if (mainChart) {
    mainChart.data.labels = data.labels;
    mainChart.data.datasets[0].data = data.chartSucesso;
    mainChart.data.datasets[1].data = data.chartProblema;
    mainChart.update();
  }
}

function startTimerLoop() {
  setInterval(() => {
    const now = new Date();
    document.getElementById('header-clock').innerText = now.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });

    timerSeconds -= 0.1;
    if (timerSeconds <= 0) {
      timerSeconds = ROTATION_INTERVAL;
      currentViewIndex = (currentViewIndex + 1) % viewsOrder.length;
      updateDashboardUI(viewsOrder[currentViewIndex]);
    }

    const percentage = (timerSeconds / ROTATION_INTERVAL) * 100;
    document.getElementById('timer-bar').style.width = percentage + '%';
    document.getElementById('timer-text').innerText = `${Math.ceil(timerSeconds)}s`;
  }, 100);
}

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generateInitialTables() {
  const tableUltimas = document.getElementById('list-ultimas');
  const tableProblemas = document.getElementById('list-problemas');
  tableUltimas.innerHTML = '';
  tableProblemas.innerHTML = '';

  const now = new Date();

  for (let i = 0; i < 5; i++) {
    const timeStr = new Date(now.getTime() - i * 16000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const proc = getRandomItem(radioProcesses);
    const is200 = Math.random() > 0.15;
    const status = is200 ? '200' : getRandomItem(['500', '503', '404']);
    const latency = Math.floor(Math.random() * 180 + 30) + 'ms';

    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-800/30 transition border-b border-gray-800/40';
    row.innerHTML = `
      <td class="p-1.5 px-2 text-gray-400 font-medium">${timeStr}</td>
      <td class="p-1.5 px-2 font-bold text-gray-200 truncate max-w-[200px]">${proc}</td>
      <td class="p-1.5 px-2 text-center">
        <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${is200 ? 'bg-yellow-950/80 text-yellow-400 border border-yellow-800/60' : 'bg-red-950/80 text-red-400 border border-red-800/60'}">
          ${status} ${is200 ? 'OK' : 'FAIL'}
        </span>
      </td>
      <td class="p-1.5 px-2 text-right text-gray-300 font-bold">${latency}</td>
    `;
    tableUltimas.appendChild(row);
  }

  for (let i = 0; i < 5; i++) {
    const timeStr = new Date(now.getTime() - i * 50000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const proc = getRandomItem(radioProcesses);
    const err = getRandomItem(errorMessages);
    const code = err.split(' ')[1];

    const row = document.createElement('tr');
    row.className = 'hover:bg-red-950/20 transition border-b border-gray-800/40';
    row.innerHTML = `
      <td class="p-1.5 px-2 text-gray-400 font-medium">${timeStr}</td>
      <td class="p-1.5 px-2 font-bold text-gray-200 truncate max-w-[180px]">${proc}</td>
      <td class="p-1.5 px-2 text-center">
        <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-950/80 text-red-400 border border-red-800/60">${code}</span>
      </td>
      <td class="p-1.5 px-2 text-red-300 font-bold truncate max-w-[220px]">${err}</td>
    `;
    tableProblemas.appendChild(row);
  }
}

function startLiveStreamSimulation() {
  setInterval(() => {
    const tableUltimas = document.getElementById('list-ultimas');
    const timeStr = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const proc = getRandomItem(radioProcesses);
    const is200 = Math.random() > 0.18;
    const status = is200 ? '200' : getRandomItem(['500', '503', '404']);
    const latency = Math.floor(Math.random() * 180 + 30) + 'ms';

    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-800/30 transition border-b border-gray-800/40 bg-blue-950/20';
    row.innerHTML = `
      <td class="p-1.5 px-2 text-gray-300 font-medium">${timeStr}</td>
      <td class="p-1.5 px-2 font-extrabold text-white truncate max-w-[200px]">${proc}</td>
      <td class="p-1.5 px-2 text-center">
        <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${is200 ? 'bg-yellow-950/80 text-yellow-400 border border-yellow-800/60' : 'bg-red-950/80 text-red-400 border border-red-800/60'}">
          ${status} ${is200 ? 'OK' : 'FAIL'}
        </span>
      </td>
      <td class="p-1.5 px-2 text-right text-gray-200 font-bold">${latency}</td>
    `;

    tableUltimas.insertBefore(row, tableUltimas.firstChild);
    if (tableUltimas.children.length > 5) tableUltimas.removeChild(tableUltimas.lastChild);

    if (!is200) {
      const tableProblemas = document.getElementById('list-problemas');
      const err = getRandomItem(errorMessages);
      const errRow = document.createElement('tr');
      errRow.className = 'hover:bg-red-950/30 transition border-b border-gray-800/40 bg-red-950/30';
      errRow.innerHTML = `
        <td class="p-1.5 px-2 text-gray-300 font-medium">${timeStr}</td>
        <td class="p-1.5 px-2 font-extrabold text-white truncate max-w-[180px]">${proc}</td>
        <td class="p-1.5 px-2 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-950/80 text-red-400 border border-red-800/60">${status}</span>
        </td>
        <td class="p-1.5 px-2 text-red-300 font-bold truncate max-w-[220px]">${err}</td>
      `;
      tableProblemas.insertBefore(errRow, tableProblemas.firstChild);
      if (tableProblemas.children.length > 5) tableProblemas.removeChild(tableProblemas.lastChild);
    }
  }, 4000);
}

window.addEventListener('load', async () => {
  try {
    await carregarDados();
    initChart();
    updateDashboardUI('diario');
    generateInitialTables();
    startTimerLoop();
    startLiveStreamSimulation();
  } catch (erro) {
    console.error('Falha ao inicializar o dashboard:', erro);
  }
});
