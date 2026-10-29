const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.KRW_TEST_BUNDLED_BROWSER ? {} : { channel: 'chrome' }) });
});
after(async () => { await browser?.close(); });

async function fixture(t, { host = 'www.binance.com', html = '<p id="price">$100</p>', storage = {}, delay = 0, popup = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' });
  t.after(() => context.close());
  await context.addInitScript(({ initial, delay }) => {
    const listeners = new Set();
    const state = { ...initial };
    const messages = [];
    const set = async updates => {
      const changes = {};
      for (const [key, value] of Object.entries(updates)) {
        if (JSON.stringify(state[key]) !== JSON.stringify(value)) changes[key] = { oldValue: state[key], newValue: value };
        state[key] = value;
      }
      if (Object.keys(changes).length) listeners.forEach(fn => fn(changes, 'local'));
    };
    window.__settings = { state, set, messages };
    window.chrome = {
      storage: {
        local: {
          get: (keys, callback) => {
            const result = Object.fromEntries(keys.filter(key => key in state).map(key => [key, state[key]]));
            return new Promise(resolve => setTimeout(() => { callback?.(result); resolve(result); }, delay));
          }, set
        },
        onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) }
      },
      runtime: {
        getManifest: () => ({ version: '1.6.1' }), getURL: file => `https://krw-display.test/${file}`,
        onMessage: { addListener() {} },
        sendMessage: async request => {
          messages.push(request);
          if (request.action === 'refreshRate' && request.force) {
            const rate = state.rateSource === 'custom' ? state.customRateValue : 1460;
            await set({ usdkrw: rate, lastFetchSource: state.rateSource || 'usd_krw', lastFetchStatus: 'success', lastFetchTime: Date.now(), lastFetchError: null });
          }
          return { success: true };
        }
      },
      windows: { create: async () => {} }, tabs: { create: async () => {} }
    };
  }, { initial: storage, delay });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'krw-display.test' && popup) {
      const file = path.join(root, url.pathname.slice(1));
      if (!file.startsWith(root + path.sep)) return route.abort();
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' };
      try { return route.fulfill({ body: await fs.readFile(file), contentType: types[path.extname(file)] || 'text/plain' }); }
      catch { return route.fulfill({ status: 404, body: '' }); }
    }
    if (url.hostname === host) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><head></head><body>${html}</body></html>` });
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'browser must not produce uncaught errors'));
  await page.goto(popup ? 'https://krw-display.test/popup.html' : `https://${host}/en/futures/BTCUSDT`);
  if (!popup) for (const name of ['shared.js', 'logger.js', 'content.js']) await page.addScriptTag({ path: path.join(root, name) });
  return page;
}
const prefs = { usdkrw: 1400, rateSource: 'usd_krw', lastFetchSource: 'usd_krw', lastFetchStatus: 'success', lastFetchTime: Date.now() };

async function text(page, id = '#price') { return page.locator(id).textContent(); }
async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }

test('currency conversion covers decimals, negative signs, English and Korean units', async t => {
  const cases = [
    ['$100', '$100 (₩140,000)'], ['$1,234.56', '$1,234.56 (₩1,728,384)'],
    ['-$100', '-$100 (₩-140,000)'], ['$-50', '$-50 (₩-70,000)'],
    ['100 USD', '100 USD (₩140,000)'], ['50 USDT', '50 USDT (₩70,000)'], ['200 USDC', '200 USDC (₩280,000)'],
    ['$1.5m', '$1.5m (₩21.00억)'], ['$1kn', '$1kn (₩1,400,000)'],
    ['$1k', '$1k (₩1,400,000)'], ['$1mn', '$1mn (₩14.00억)'],
    ['$1b', '$1b (₩1.40조)'], ['$1bn', '$1bn (₩1.40조)'],
    ['$1t', '$1t (₩1400.00조)'], ['$1tn', '$1tn (₩1400.00조)'],
    ['$1만', '$1만 (₩14,000,000)'], ['$1억', '$1억 (₩1400.00억)'], ['$1조', '$1조 (₩1400.00조)'],
    ['50억 달러', '50억 달러 (₩7.00조)'], ['100만 달러', '100만 달러 (₩14.00억)'],
    ['70달러는', '70달러 (₩98,000)는'], ['100달러입니다', '100달러입니다'],
    ['BTCUSDT', 'BTCUSDT'], ['$100x50', '$100 (₩140,000)x50']
  ];
  const page = await fixture(t, { html: cases.map(([source], i) => `<p id="case${i}">${source}</p>`).join(''), storage: prefs });
  await page.waitForFunction(() => document.getElementById('case0').textContent.includes('₩'));
  for (let i = 0; i < cases.length; i++) assert.equal(await text(page, `#case${i}`), cases[i][1], cases[i][0]);
  await settle(page);
  assert.equal(await text(page, '#case0'), cases[0][1], 'observer must not double-annotate');
});

test('similar domains stay untouched and valid subdomains work', async t => {
  const blocked = await fixture(t, { host: 'binance.com.example.net', storage: prefs });
  await settle(blocked);
  assert.equal(await text(blocked), '$100');
  const allowed = await fixture(t, { host: 'futures.binance.com', storage: prefs });
  await allowed.waitForFunction(() => document.getElementById('price').textContent.includes('₩'));
  assert.equal(await text(allowed), '$100 (₩140,000)');
});

test('disabling conversion and removing a site restores its exact original text', async t => {
  const original = '$100 (₩original page note)';
  const page = await fixture(t, { storage: prefs, html: `<p id="price">${original}</p>` });
  await page.waitForFunction(() => document.getElementById('price').textContent.includes('140,000'));
  await page.evaluate(() => __settings.set({ isEnabled: false }));
  await page.waitForFunction(expected => document.getElementById('price').textContent === expected, original);
  await page.evaluate(() => __settings.set({ isEnabled: true }));
  await page.waitForFunction(() => document.getElementById('price').textContent.includes('140,000'));
  await page.evaluate(() => __settings.set({ enabledSites: [] }));
  await page.waitForFunction(expected => document.getElementById('price').textContent === expected, original);
  assert.equal(await text(page), original);
});

test('scripts, code examples, editing fields and excluded text remain untouched', async t => {
  const page = await fixture(t, { storage: prefs, html: `
    <p id="price">$100</p><script type="application/json" id="data">{"price":"$100"}</script>
    <style id="style">.price::after { content: "$100"; }</style>
    <code id="code">$100</code><pre id="pre">$100</pre>
    <div contenteditable="true" id="editor">$100</div><textarea id="area">$100</textarea>
    <p translate="no" id="excluded">$100</p><select><option id="option">$100</option></select>` });
  await page.waitForFunction(() => document.getElementById('price').textContent.includes('₩'));
  for (const id of ['data','style','code','pre','editor','area','excluded','option']) {
    assert.equal((await text(page, `#${id}`)).includes('₩'), false, id);
  }
});

test('live price changes win over queued changes from the extension', async t => {
  const page = await fixture(t, { storage: prefs });
  await page.waitForFunction(() => document.getElementById('price').textContent.includes('₩'));
  await page.evaluate(() => {
    const node = document.getElementById('price').firstChild;
    node.nodeValue = '$101';
    node.nodeValue = '$102';
  });
  await page.waitForFunction(() => document.getElementById('price').textContent === '$102 (₩142,800)');
  await page.evaluate(() => __settings.set({ usdkrw: 1500 }));
  await page.waitForFunction(() => document.getElementById('price').textContent === '$102 (₩153,000)');
  await page.evaluate(() => __settings.set({ isEnabled: false }));
  await page.waitForFunction(() => document.getElementById('price').textContent === '$102');
});

test('saved disabled preferences never flash conversions while storage is delayed', async t => {
  const page = await fixture(t, { delay: 120, storage: { ...prefs, isEnabled: false } });
  await settle(page);
  assert.equal(await text(page), '$100');
  await page.waitForTimeout(180);
  assert.equal(await text(page), '$100');
});

test('no confirmed rate means no invented conversion; valid custom rates are consistent', async t => {
  const page = await fixture(t, { storage: { rateSource: 'custom' } });
  await settle(page);
  assert.equal(await text(page), '$100');
  await page.evaluate(() => __settings.set({ usdkrw: 3000 }));
  await page.waitForFunction(() => document.getElementById('price').textContent === '$100 (₩300,000)');
});

test('Binance translation can be turned off independently and restores original labels', async t => {
  const page = await fixture(t, { storage: { ...prefs, isEnabled: false, krwOrderHelperEnabled: false }, html: '<p id="label">Market</p>' });
  for (const name of ['binance-ko-translations.js', 'binance-ko.js']) await page.addScriptTag({ path: path.join(root, name) });
  await page.waitForFunction(() => document.getElementById('label').textContent === '시장가');
  await page.evaluate(() => __settings.set({ binanceKoreanEnabled: false }));
  await page.waitForFunction(() => document.getElementById('label').textContent === 'Market');
});

test('Binance financial annotations accept the saved custom rate and restore on disable', async t => {
  const page = await fixture(t, { storage: { ...prefs, usdkrw: 3000, binanceKoreanEnabled: false }, html: '<div class="line-item"><span class="text-TertiaryText">Balance</span><span id="balance">10 USDT</span></div>' });
  for (const name of ['binance-ko-translations.js', 'binance-ko.js']) await page.addScriptTag({ path: path.join(root, name) });
  await page.waitForFunction(() => document.getElementById('balance').textContent.includes('30,000'));
  await page.evaluate(() => { document.getElementById('balance').textContent = '20 USDT'; });
  await page.waitForFunction(() => document.getElementById('balance').textContent === '20 USDT (₩60,000)');
  await page.evaluate(() => __settings.set({ isEnabled: false, krwOrderHelperEnabled: false }));
  await page.waitForFunction(() => document.getElementById('balance').textContent === '20 USDT');
});

test('KRW order input waits for a valid rate and restores the native input on disable', async t => {
  const page = await fixture(t, { storage: { binanceKrwUnitMode: true }, html: '<div class="bn-textField"><input id="unitAmount-test" step="0.01" value="10"><div class="bn-textField-suffix"><span>USDT</span></div></div>' });
  await page.addScriptTag({ path: path.join(root, 'binance-krw-order.js') });
  await page.waitForTimeout(120);
  assert.equal(await page.locator('[data-krw-unit-input]').count(), 0);
  await page.evaluate(() => __settings.set({ usdkrw: 3000 }));
  const proxy = page.locator('[data-krw-unit-input]');
  await proxy.waitFor();
  assert.equal(await proxy.inputValue(), '30,000');
  await proxy.fill('60,000');
  assert.equal(await page.locator('#unitAmount-test').inputValue(), '20.00');
  await page.evaluate(() => __settings.set({ krwOrderHelperEnabled: false }));
  await proxy.waitFor({ state: 'detached' });
  assert.equal(await page.locator('#unitAmount-test').isVisible(), true);
  assert.equal(await page.locator('.bn-textField-suffix').textContent(), 'USDT');
});

test('popup displays source separately, refreshes manually and preserves custom drafts', async t => {
  const page = await fixture(t, { popup: true, storage: prefs });
  await page.waitForFunction(() => document.getElementById('rateValue').textContent === '₩1,400.00');
  assert.equal(await text(page, '#rateSourceLabel'), '1 USD · 국제 환율');
  await page.getByRole('button', { name: '지금 갱신' }).click();
  await page.waitForFunction(() => document.getElementById('rateValue').textContent === '₩1,460.00');
  await page.getByRole('button', { name: '환율 기준 선택' }).click();
  await page.locator('[data-source="custom"]').click();
  await page.getByRole('spinbutton', { name: '사용자 지정 환율' }).fill('3000.25');
  await page.evaluate(() => __settings.set({ usdkrw: 1470 }));
  assert.equal(await page.locator('#customRateInput').inputValue(), '3000.25');
  await page.locator('#customRateInput').press('Enter');
  await page.waitForFunction(() => document.getElementById('rateValue').textContent === '₩3,000.25');
  assert.equal(await page.evaluate(() => __settings.state.customRateValue), 3000.25);
});

test('popup accepts keyboard navigation and validates site and custom inputs', async t => {
  const page = await fixture(t, { popup: true, storage: prefs });
  await page.waitForFunction(() => document.getElementById('rateValue').textContent === '₩1,400.00');
  await page.getByRole('tab', { name: '홈' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: '사이트' }).getAttribute('aria-selected'), 'true');
  await page.locator('#newSiteInput').fill('not a valid URL');
  await page.locator('#newSiteInput').press('Enter');
  assert.equal(await page.locator('#newSiteInput').getAttribute('aria-invalid'), 'true');
  await page.locator('#newSiteInput').fill('https://www.example.com/path');
  await page.locator('#newSiteInput').press('Enter');
  await page.getByRole('button', { name: 'example.com 삭제' }).waitFor();
  await page.getByRole('radio', { name: '모든 사이트' }).check();
  assert.equal(await page.locator('#newSiteInput').isDisabled(), true);
  await page.getByRole('tab', { name: '홈' }).click();
  await page.getByRole('button', { name: '환율 기준 선택' }).click();
  await page.locator('[data-source="custom"]').click();
  await page.locator('#customRateInput').fill('0');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  assert.equal(await page.locator('#customRateInput').getAttribute('aria-invalid'), 'true');
});

test('popup distinguishes old-source fallback and does not invent an Upbit premium', async t => {
  const page = await fixture(t, { popup: true, storage: { ...prefs, rateSource: 'upbit_usdt', lastFetchStatus: 'failed', lastFetchError: 'offline', standardRate: 1400 } });
  await page.waitForFunction(() => document.getElementById('rateValue').textContent === '₩1,400.00');
  assert.equal(await text(page, '#rateSourceLabel'), '1 USD · 국제 환율');
  assert.match(await text(page, '#rateFeedback'), /이전 기준/);
  assert.equal(await page.locator('[data-source="upbit_usdt"] .option-desc').textContent(), '업비트 시세 기준');
});

test('popup layouts fit the panel and provide a screenshot for visual review', async t => {
  const page = await fixture(t, { popup: true, storage: prefs });
  await page.waitForFunction(() => document.getElementById('rateValue').textContent === '₩1,400.00');
  const bounds = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, rate: document.getElementById('rateValue').getBoundingClientRect().right }));
  assert.ok(bounds.scroll <= bounds.width, 'popup must not overflow horizontally');
  assert.ok(bounds.rate < bounds.width, 'large rate text must fit');
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'test-results/popup-home.png'), fullPage: true });
  await page.getByRole('button', { name: '환율 기준 선택' }).click();
  await page.screenshot({ path: path.join(root, 'test-results/popup-sources.png'), fullPage: true });
});

test('large live pages settle without a mutation loop after repeated updates', async t => {
  const page = await fixture(t, { storage: prefs, html: '<main id="feed"></main>' });
  const result = await page.evaluate(async () => {
    const start = performance.now();
    const feed = document.getElementById('feed');
    feed.innerHTML = Array.from({ length: 2500 }, (_, i) => `<p>$${i + 1}</p>`).join('');
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 100; j++) feed.children[j].firstChild.nodeValue = '$123';
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    let mutations = 0;
    const observer = new MutationObserver(records => { mutations += records.length; });
    observer.observe(feed, { subtree: true, characterData: true });
    await new Promise(resolve => setTimeout(resolve, 150));
    observer.disconnect();
    return { elapsed: performance.now() - start, idleMutations: mutations, value: feed.children[0].textContent, count: feed.children.length };
  });
  assert.equal(result.value, '$123 (₩172,200)');
  assert.equal(result.count, 2500);
  assert.equal(result.idleMutations, 0, 'observer must stop producing work after prices settle');
  t.diagnostic(`2500 price rows / 1200 live updates: ${Math.round(result.elapsed)}ms including frame and idle waits`);
});
