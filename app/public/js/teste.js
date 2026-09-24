// Relógio em Tempo Real
function updateClock() {
  const now = new Date();
  document.getElementById('live-clock').innerText = now.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo'
  });
}
setInterval(updateClock, 1000);
updateClock();

// Configuração Genérica dos Mini Gráficos das Ferramentas
function createSparkline(canvasId, color, baseData) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['', '', '', '', '', '', '', '', '', ''],
      datasets: [{
        data: baseData,
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        backgroundColor: (context) => {
          const bg = context.chart.ctx.createLinearGradient(0, 0, 0, 100);
          bg.addColorStop(0, color.replace('1)', '0.25)'));
          bg.addColorStop(1, color.replace('1)', '0)'));
          return bg;
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false, min: 0 } }
    }
  });
}

// Inicializa Gráficos Individuais
const chartN8n = createSparkline('chart-n8n', 'rgba(244, 63, 94, 1)', [35, 42, 38, 40, 36, 45, 38, 39, 41, 38]);
const chartEleven = createSparkline('chart-eleven', 'rgba(168, 85, 247, 1)', [160, 175, 162, 180, 165, 170, 158, 165, 172, 165]);
const chartSupa = createSparkline('chart-supabase', 'rgba(16, 185, 129, 1)', [22, 25, 24, 28, 23, 22, 26, 24, 23, 24]);
const chartInside = createSparkline('chart-insidetv', 'rgba(59, 130, 246, 1)', [60, 65, 58, 70, 62, 64, 61, 66, 63, 62]);
const chartGPT = createSparkline('chart-chatgpt', 'rgba(20, 184, 166, 1)', [200, 220, 205, 230, 215, 210, 225, 208, 212, 210]);

// Inicializa Gráfico Combinado Inferior
const ctxCombined = document.getElementById('chart-combined').getContext('2d');
const combinedChart = new Chart(ctxCombined, {
  type: 'line',
  data: {
    labels: ['17:50', '17:51', '17:52', '17:53', '17:54', '17:55', '17:56'],
    datasets: [
      { label: 'n8n', data: [38, 40, 35, 42, 39, 37, 38], borderColor: '#f43f5e', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      { label: 'ElevenLabs', data: [165, 170, 160, 175, 168, 162, 165], borderColor: '#a855f7', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      { label: 'Supabase', data: [24, 26, 22, 25, 23, 24, 24], borderColor: '#10b981', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      { label: 'InsideTV', data: [62, 64, 60, 68, 63, 61, 62], borderColor: '#3b82f6', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      { label: 'ChatGPT', data: [210, 225, 205, 230, 215, 208, 210], borderColor: '#14b8a6', borderWidth: 1.5, pointRadius: 0, tension: 0.3 }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } } },
    scales: {
      x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', font: { size: 9 } } },
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', font: { size: 9 } } }
    }
  }
});

async function carregarDadosTeste() {
  try {
    const resposta = await fetch('/dados_teste.json?t=' + Date.now());
    if (!resposta.ok) throw new Error('Falha ao carregar dados_teste.json');

    const dados = await resposta.json();
    const cabecalho = dados.cabecalho || {};

    document.getElementById('dashboard-title').childNodes[0].nodeValue = `${cabecalho.titulo || ''} `;
    document.getElementById('dashboard-subtitle').textContent = cabecalho.subtitulo || '';
    document.getElementById('dashboard-status').textContent = cabecalho.status || '';
    document.getElementById('response-rate').textContent = cabecalho.taxa_resposta || '';
    document.getElementById('global-load').textContent = cabecalho.carga_global || '';

    const charts = [chartN8n, chartEleven, chartSupa, chartInside, chartGPT];
    const secoes = document.querySelectorAll('main > section');
    (dados.servicos || []).forEach((servico, indice) => {
      const secao = secoes[indice];
      if (!secao) return;

      const titulo = secao.querySelector('h2');
      const descricao = secao.querySelector('h2 + p');
      const status = secao.querySelector('div.flex.justify-between > span');
      const blocos = secao.querySelectorAll('.grid.grid-cols-2 > div');
      const rodape = secao.querySelector('.border-t');

      if (titulo) titulo.textContent = servico.nome || '';
      if (descricao) descricao.textContent = servico.descricao || '';
      if (status) status.textContent = servico.status || '';
      if (blocos[0]) blocos[0].querySelector('span:last-child').textContent = `${servico.latencia} ms`;
      if (blocos[1]) {
        blocos[1].querySelector('span:first-child').textContent = servico.metrica_nome || '';
        blocos[1].querySelector('span:last-child').textContent = servico.metrica_valor || '';
      }
      if (rodape) {
        const textosRodape = rodape.querySelectorAll('span');
        if (textosRodape[0]) textosRodape[0].innerHTML = `Uptime 30d: <strong class="text-slate-200">${servico.uptime || ''}</strong>`;
        if (textosRodape[1]) textosRodape[1].textContent = servico.rodape || '';
      }

      if (charts[indice] && Array.isArray(servico.historico)) {
        charts[indice].data.datasets[0].data = servico.historico;
        charts[indice].update('none');
      }
    });

    if (dados.grafico_combinado && Array.isArray(dados.grafico_combinado.series)) {
      combinedChart.data.labels = dados.grafico_combinado.labels || [];
      combinedChart.data.datasets = dados.grafico_combinado.series.map(serie => ({
        label: serie.label,
        data: serie.valores,
        borderColor: serie.cor,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3
      }));
      combinedChart.update('none');
    }
  } catch (erro) {
    console.error('Falha ao consumir dados da tela de teste:', erro);
  }
}

carregarDadosTeste();

// Simulação Dinâmica de Atualizações em Tempo Real (A cada 3 Segundos)
setInterval(() => {
  function updateVal(chart, elementId, base, variation) {
    const newVal = Math.floor(base + (Math.random() * variation * 2 - variation));
    document.getElementById(elementId).innerText = newVal + ' ms';
    chart.data.datasets[0].data.shift();
    chart.data.datasets[0].data.push(newVal);
    chart.update();
    return newVal;
  }

  updateVal(chartN8n, 'ping-n8n', 38, 5);
  updateVal(chartEleven, 'ping-eleven', 165, 15);
  updateVal(chartSupa, 'ping-supabase', 24, 3);
  updateVal(chartInside, 'ping-insidetv', 62, 8);
  updateVal(chartGPT, 'ping-chatgpt', 210, 20);
}, 3000);
