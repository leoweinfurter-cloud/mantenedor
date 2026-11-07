// Requer: npm i playwright (e um Chromium instalado). Rodar: node avaliacao/tests/e2e_playwright.js
// Teste ponta a ponta no Chromium com Supabase simulado (rota interceptada).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'); const OUT = require('os').tmpdir();
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'text/plain' }); res.end(fs.readFileSync(f));
});
const falhas = [];
const abrirTudo = p => p.evaluate(() => document.querySelectorAll('details.avl-sec').forEach(d => d.open = true));
function ok(c, m) { if (!c) { falhas.push(m); console.log('  FAIL ' + m); } else console.log('  ok   ' + m); }

(async () => {
  await new Promise(r => srv.listen(8765, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 400, height: 800 }, serviceWorkers: 'allow' });
  // Supabase falso
  const tabelas = { avl_avaliacoes: {}, avl_bens: {}, avl_cotacoes: {} }; let clock = 0; const posts = [];
  await ctx.route('https://mtmcrpigiwsxfwxkqdkz.supabase.co/**', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname.startsWith('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: 'u1', email: 'leo@teste.com' } }) });
    }
    const t = url.pathname.replace('/rest/v1/', '');
    if (req.method() === 'POST') {
      const rows = JSON.parse(req.postData()); posts.push({ t, n: rows.length });
      rows.forEach(r => { tabelas[t][r.id] = Object.assign({}, tabelas[t][r.id] || {}, r, { atualizado_em: '2026-11-06T10:00:00.' + String(++clock).padStart(6, '0') + '+00:00' }); });
      return route.fulfill({ status: 201, body: '' });
    }
    const m = /atualizado_em=gt\.([^&]+)/.exec(url.search); const desde = m ? decodeURIComponent(m[1]) : '';
    const rows = Object.values(tabelas[t]).filter(r => r.atualizado_em > desde).sort((a, b) => a.atualizado_em < b.atualizado_em ? -1 : 1);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  const page = await ctx.newPage();
  const erros = []; page.on('pageerror', e => erros.push(e.message + ' @ ' + page.url() + ' ' + (e.stack||'').split('\n').slice(1,3).join('|'))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
  const B = 'http://localhost:8765/avaliacao/';

  console.log('Login');
  await page.goto(B + 'index.html'); await page.waitForURL('**/login.html');
  await page.fill('#email', 'leo@teste.com'); await page.fill('#senha', 'x'); await page.click('#btn');
  await page.waitForURL('**/index.html'); ok(true, 'login redireciona para a lista');
  await page.waitForSelector('.avl-empty');

  console.log('Nova avaliação');
  await page.click('text=+ Nova avaliação'); await page.waitForURL('**/avaliacao.html*');
  await page.waitForSelector('[data-f="titulo"]');
  await page.fill('[data-f="titulo"]', 'Processo 123 — Dissolução Alfa');
  await page.fill('[data-f="cliente"]', 'Silva Advogados'); await page.fill('[data-f="empresa_avaliada"]', 'Alfa Usinagem Ltda');
  await page.fill('[data-f="data_base"]', '2026-11-03'); await page.fill('[data-f="art_numero"]', '12345678');
  await page.fill('[data-f="pressupostos"]', 'Bens avaliados no estado em que se encontravam.');
  await page.waitForTimeout(900);

  console.log('Primeiro bem (torno CNC, comparativo)');
  await page.click('[data-tab="bens"]'); await page.click('#fab'); await page.waitForURL('**/bem.html*');
  await page.waitForSelector('[data-f="descricao"]'); await abrirTudo(page);
  await page.fill('[data-f="descricao"]', 'Torno CNC'); await page.fill('[data-f="fabricante"]', 'Romi'); await page.fill('[data-f="modelo"]', 'GL 240');
  await page.fill('[data-f="serie"]', 'ABC123'); await page.fill('[data-f="ano_fabricacao"]', '2016'); await page.fill('[data-f="capacidade"]', '240 mm');
  await page.selectOption('[data-f="funcionamento"]', 'completo'); await page.selectOption('[data-f="estado"]', 'c'); await page.fill('[data-f="valor_novo"]', '480000');
  await page.selectOption('[data-f="vida_util_ref"]', 'torno');
  ok(await page.inputValue('[data-f="vida_util_anos"]') === '20', 'vida útil preenchida pelo tipo de bem (20 anos)');
  await page.selectOption('[data-f="nr12"]', 'conforme');
  for (let i = 0; i < 4; i++) await page.click('text=+ foto (');
  ok((await page.inputValue('[data-f="fotos_qtd"]')) === '4', 'fotos: quantidade = nomes adicionados');
  ok((await page.$$('.avl-chip')).length === 4, 'quatro nomes de arquivo');
  // dados de mercado
  const dados = [[2017, 320000], [2015, 290000], [2016, 300000], [2018, 350000]];
  let n = 0;
  for (const [ano, preco] of dados) {
    await page.click('text=+ Oferta de usado'); n++;
    await page.waitForFunction(k => document.querySelectorAll('.avl-cot').length === k, n);
    const cards = await page.$$('.avl-cot'); const card = cards[cards.length - 1];
    await (await card.$('[data-f="preco"]')).fill(String(preco)); await (await card.$('[data-f="ano"]')).fill(String(ano)); await (await card.$('[data-f="fonte"]')).fill('Mercado Máquinas');
  }
  await page.waitForTimeout(300);
  const txt = await page.textContent('#resultado');
  const mval = /R\$\s*([\d.]+,\d{2})/.exec(txt); const valor = mval ? parseFloat(mval[1].replace(/\./g, '').replace(',', '.')) : 0;
  ok(valor > 268000 && valor < 280000, 'valor adotado ≈ R$ 274 mil (obtido ' + (mval && mval[0]) + ')');
  ok(/Grau III/.test(txt), 'grau III com 4 dados + vistoria completa');
  ok(/Conferência \(ibape\)/.test(txt), 'conferência cruzada pela curva IBAPE');
  await page.waitForTimeout(900);

  console.log('Salvar e novo bem → bem em Ross-Heidecke');
  await Promise.all([page.waitForNavigation(), page.click('text=Salvar e novo bem')]);
  await page.waitForSelector('[data-f="descricao"]'); await abrirTudo(page);
  ok((await page.inputValue('[data-f="numero"]')) === '2', 'segundo bem recebe nº 2');
  await page.fill('[data-f="descricao"]', 'Compressor de parafuso'); await page.fill('[data-f="ano_fabricacao"]', '2018');
  await page.selectOption('[data-f="estado"]', 'd'); await page.selectOption('[data-f="vida_util_ref"]', 'compressor');
  await page.selectOption('[data-f="metodo"]', 'rossheidecke'); await page.fill('[data-f="valor_novo"]', '80000');
  await page.selectOption('[data-f="propriedade"]', 'propria'); await page.selectOption('[data-f="onus"]', 'alienacao_fiduciaria'); await page.fill('[data-f="onus_saldo"]', '20000'); await page.fill('[data-f="onus_credor"]', 'Banco X');
  await page.waitForTimeout(300);
  const t2 = await page.textContent('#resultado'); ok(/R\$\s*[\d.]+,\d{2}/.test(t2) && !/NaN|undefined/.test(t2), 'compressor tem valor e sem NaN');
  console.log('Checklist de vistoria (compressor)');
  await page.click('#ck-id_placa .avl-ck-b.ok'); await page.click('#ck-est_vazamento .avl-ck-b.nc');
  await page.fill('#ck-est_vazamento .avl-ck-n', 'óleo no cabeçote'); await page.click('#ck-nr_emerg .avl-ck-b.nc');
  ok(/2 não conforme/.test(await page.textContent('#ck-topo')) && /3\/48/.test(await page.textContent('#sec-chk > summary')), 'resumo do checklist atualiza (2 NC)');
  await page.click('text=Marcar NR-12 como'); ok(await page.inputValue('[data-f="nr12"]') === 'nao_conforme', 'atalho aplica NR-12 não conforme na ficha');
  await page.click('text=Copiar não conformidades'); ok(/óleo no cabeçote/.test(await page.inputValue('[data-f="observacoes"]')), 'não conformidades copiadas para as observações');
  await page.click('#ck-id_placa .avl-ck-b.ok'); ok(!(await page.getAttribute('#ck-id_placa .avl-ck-b.ok', 'class')).includes('on'), 'tocar de novo desmarca');
  await page.click('#ck-id_placa .avl-ck-b.ok');
  await page.screenshot({ path: OUT + '/avl-bem.png', fullPage: true });
  await page.waitForTimeout(900);

  console.log('Terceiro bem: leasing (fora do total)');
  await Promise.all([page.waitForNavigation(), page.click('text=Duplicar')]); await page.waitForSelector('[data-f="descricao"]'); await abrirTudo(page);
  await page.selectOption('[data-f="propriedade"]', 'leasing'); await page.waitForTimeout(900);

  console.log('Resumo');
  await page.goto(B + 'avaliacao.html?id=' + (await page.evaluate(() => new URLSearchParams(location.search).get('av') || '')) + '#resumo').catch(() => {});
  const avId = Object.keys(tabelas.avl_avaliacoes)[0] || await page.evaluate(() => (new URLSearchParams(location.search)).get('id'));
  await page.goto(B + 'avaliacao.html?id=' + avId + '#resumo'); await page.waitForSelector('.avl-result');
  const resumo = await page.textContent('#painel');
  ok(/Bens não pertencentes|não pertencentes/.test(resumo), 'resumo mostra bem de leasing fora do total');
  ok(/20\.000,00/.test(resumo), 'resumo mostra saldo devedor informativo');
  await page.screenshot({ path: OUT + '/avl-resumo.png', fullPage: true });

  console.log('Sincronização');
  await page.waitForTimeout(5000); // sync automático
  ok(Object.keys(tabelas.avl_bens).length === 3, '3 bens no servidor (' + Object.keys(tabelas.avl_bens).length + ')');
  ok(Object.keys(tabelas.avl_cotacoes).length >= 4, 'cotações enviadas (' + Object.keys(tabelas.avl_cotacoes).length + ')');
  ok(Object.keys(tabelas.avl_avaliacoes).length === 1, '1 avaliação no servidor');
  const b1 = Object.values(tabelas.avl_bens).find(b => b.descricao === 'Torno CNC');
  ok(b1 && b1.fotos_nomes.length === 4 && b1.ano_fabricacao === 2016 && b1.owner_id === 'u1', 'campos do bem chegam corretos ao servidor (tipos e owner_id)');
  const b2 = Object.values(tabelas.avl_bens).find(b => /ompressor/.test(b.descricao));
  ok(b2 && b2.checklist.est_vazamento && b2.checklist.est_vazamento.s === 'nc' && b2.checklist.est_vazamento.n === 'óleo no cabeçote' && b2.checklist.id_placa.s === 'ok', 'checklist chega ao servidor como jsonb');
  ok(b1.checklist && Object.keys(b1.checklist).length === 0, 'bem sem checklist envia objeto vazio');
  ok(!Object.keys(b1).some(k => k.startsWith('_')), 'campos locais não vazam para o servidor');

  console.log('Offline');
  await page.click('[data-tab="bens"]'); await page.waitForSelector('.avl-item');
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForTimeout(1500);
  await page.reload(); await page.waitForSelector('.avl-item'); // já sob controle do SW
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await Promise.all([page.waitForNavigation(), page.click('.avl-item >> nth=0')]);
  await page.waitForSelector('[data-f="descricao"]'); await abrirTudo(page);
  ok(true, 'ficha do bem abre sem internet (service worker)');
  await page.fill('[data-f="observacoes"]', 'editado offline'); await page.waitForTimeout(900);
  ok(/Offline|pendente/.test(await page.textContent('#avl-syncbar')), 'barra mostra offline/pendente');
  await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(5500);
  ok(Object.values(tabelas.avl_bens).some(b => b.observacoes === 'editado offline'), 'edição feita offline sincronizou ao voltar a rede');

  console.log('Laudo');
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.goto(B + 'laudo.html?id=' + avId); await page.waitForSelector('.sheet h1');
  const laudo = await page.textContent('#sheet');
  ok(/LAUDO DE AVALIAÇÃO/.test(laudo) && /Alfa Usinagem Ltda/.test(laudo), 'laudo traz título e empresa');
  ok(/reais/.test(laudo), 'laudo traz valor por extenso');
  ok(/CREA-SC 182876-8/.test(laudo), 'laudo traz o responsável técnico');
  ok(/Checklist de vistoria/.test(laudo) && /óleo no cabeçote/.test(laudo), 'laudo traz o checklist com as não conformidades');
  ok(/Anexo A/.test(laudo) && /Torno CNC/.test(laudo), 'anexo com memória de cálculo');
  ok(!/NaN|undefined|\[object/.test(laudo), 'laudo sem NaN/undefined');
  await page.screenshot({ path: OUT + '/avl-laudo-tela.png', fullPage: true });
  await page.pdf({ path: OUT + '/avl-laudo.pdf', format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });

  ok(erros.length === 0, 'sem erros de JavaScript no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
  await browser.close(); srv.close();
  console.log(falhas.length ? '\n' + falhas.length + ' falha(s)' : '\nTudo certo'); process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
