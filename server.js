require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

const PORT = process.env.PORT || 3000;

const publicPath = path.resolve(__dirname, 'app', 'public');

// JSON recebido do hub (srv-pve) fica no volume persistente do Balena (/data),
// para sobreviver a restart/atualização do container. Enquanto nenhum JSON
// chegar, a tela teste.html usa o app/public/dados_teste.json embutido na imagem.
const DATA_DIR = process.env.DATA_DIR || '/data';
const jsonRecebidoPath = path.join(DATA_DIR, 'dados_teste.json');
const jsonPadraoPath = path.join(publicPath, 'dados_teste.json');

// Integração com o hub (variáveis de dispositivo/fleet no balenaCloud)
const HUB_TOKEN = process.env.HUB_TOKEN;       // valida o POST do hub (header X-Hub-Token)
const HUB_URL = process.env.HUB_URL;           // ex: http://192.168.0.10:8080
const SEGMENTO = process.env.SEGMENTO;         // slug do segmento, ex: noc
const DEVICE_TOKEN = process.env.DEVICE_TOKEN; // usado para buscar o JSON atual no boot

function tokenValido(recebido) {
  if (!HUB_TOKEN || !recebido) return false;
  const a = Buffer.from(String(recebido));
  const b = Buffer.from(HUB_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Grava de forma atômica (arquivo temporário + rename) para o dashboard nunca
// ler um JSON pela metade.
function gravarJson(conteudo) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${jsonRecebidoPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(conteudo));
  fs.renameSync(tmp, jsonRecebidoPath);
}

// 1. Healthcheck (usado pelo hub para mostrar online/offline)

app.get('/health', (req, res) => {

  res.json({
    ok: true,
    segmento: SEGMENTO || null,
    json_recebido: fs.existsSync(jsonRecebidoPath)
  });

});

// 2. Webhook: o hub envia o JSON do segmento

app.post('/webhook/dashboard', express.json({ limit: '5mb' }), (req, res) => {

  if (!HUB_TOKEN) {
    return res.status(503).json({ error: 'HUB_TOKEN não configurado no dispositivo' });
  }

  if (!tokenValido(req.get('X-Hub-Token'))) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Corpo deve ser um objeto JSON' });
  }

  try {

    gravarJson(req.body);

    console.log(`JSON atualizado pelo hub (segmento=${req.get('X-Segmento')}, hash=${req.get('X-Payload-Hash')})`);

    res.json({ ok: true });

  } catch (err) {

    console.error('Erro ao gravar JSON recebido:', err);

    res.status(500).json({ error: 'Falha ao gravar JSON' });

  }

});

// 3. Diagnóstico de tela: a página informa o que o navegador enxerga e o valor
// aparece em `balena logs <uuid> --service web`. Útil para achar overscan e
// diferença entre a resolução do painel e o tamanho da janela do Chromium.

app.post('/diag/tela', express.json({ limit: '4kb' }), (req, res) => {

  const d = req.body || {};

  console.log(
    `[diag] tela: screen=${d.screen} disponivel=${d.disponivel} janela=${d.janela} ` +
    `documento=${d.documento} dpr=${d.dpr} zoom_visual=${d.zoomVisual}`
  );

  res.json({ ok: true });

});

// 4. Compensação de overscan por CSS (alternativa a mexer no vídeo do Pi).
// Percentual cortado em cada lado, definido por variável de device no balenaCloud:
//   OVERSCAN_LEFT / OVERSCAN_RIGHT / OVERSCAN_TOP / OVERSCAN_BOTTOM  (ex.: 2 = 2%)
// Para testar sem reiniciar nada, use ?os=esq,dir,topo,base na URL.
// Ex.: http://127.0.0.1:3000/?os=0,2,0,2

const overscanConfig = {
  left: Number(process.env.OVERSCAN_LEFT) || 0,
  right: Number(process.env.OVERSCAN_RIGHT) || 0,
  top: Number(process.env.OVERSCAN_TOP) || 0,
  bottom: Number(process.env.OVERSCAN_BOTTOM) || 0
};

app.get('/js/overscan.js', (req, res) => {

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

  res.setHeader('Cache-Control', 'no-store');

  res.send(`(function () {
  var cfg = ${JSON.stringify(overscanConfig)};

  var q = new URLSearchParams(location.search).get('os');
  if (q) {
    var v = q.split(',').map(Number);
    if (v.length === 4 && v.every(function (n) { return isFinite(n) && n >= 0 && n < 25; })) {
      cfg = { left: v[0], right: v[1], top: v[2], bottom: v[3] };
    }
  }

  if (!cfg.left && !cfg.right && !cfg.top && !cfg.bottom) return;

  // Encolhe a página e desloca para o lado que não é cortado.
  var sx = 1 - (cfg.left + cfg.right) / 100;
  var sy = 1 - (cfg.top + cfg.bottom) / 100;
  var dx = (cfg.left - cfg.right) / 2;
  var dy = (cfg.top - cfg.bottom) / 2;

  var estilo = document.createElement('style');
  estilo.id = 'overscan-css';
  estilo.textContent =
    'html { background: #000; overflow: hidden; }' +
    'body { transform: translate(' + dx + '%, ' + dy + '%) scale(' + sx + ', ' + sy + '); ' +
    'transform-origin: 50% 50%; }';
  (document.head || document.documentElement).appendChild(estilo);

  console.log('[overscan] aplicado', JSON.stringify(cfg));
})();`);

});

// 5. Rota explícita para o JSON (antes do static, para priorizar o JSON recebido)

app.get('/dados_teste.json', (req, res) => {

  const jsonFilePath = fs.existsSync(jsonRecebidoPath) ? jsonRecebidoPath : jsonPadraoPath;

  fs.readFile(jsonFilePath, 'utf8', (err, data) => {

    if (err) {

      console.error('Erro de leitura do JSON:', err);

      return res.status(404).json({
        error: 'Arquivo JSON não encontrado'
      });

    }

    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate'
    );

    res.setHeader(
      'Content-Type',
      'application/json; charset=utf-8'
    );

    res.status(200).send(data);

  });

});

// 6. Servir arquivos estáticos (css, js, imagens)

app.use(express.static(publicPath));

app.use('/js', express.static(path.join(publicPath, 'js')));

// 7. Fallback apenas para rotas desconhecidas (HTML)

app.get('*', (req, res) => {

  res.sendFile(path.join(publicPath, 'teste.html'));

});

// 8. No boot, se ainda não há JSON recebido, busca o atual no hub (tenta a cada 60s)

async function buscarJsonInicial() {

  if (fs.existsSync(jsonRecebidoPath) || !HUB_URL || !SEGMENTO || !DEVICE_TOKEN) return;

  try {

    const resp = await fetch(`${HUB_URL}/api/segmentos/${encodeURIComponent(SEGMENTO)}/atual`, {
      headers: { 'X-Device-Token': DEVICE_TOKEN },
      signal: AbortSignal.timeout(10000)
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    gravarJson(await resp.json());

    console.log(`JSON inicial obtido do hub (segmento=${SEGMENTO})`);

  } catch (err) {

    console.warn(`Não foi possível buscar JSON inicial no hub: ${err.message}. Nova tentativa em 60s.`);

    setTimeout(buscarJsonInicial, 60000);

  }

}

app.listen(PORT, '0.0.0.0', () => {

  console.log(`Servidor rodando na porta ${PORT}`);

  buscarJsonInicial();

});
