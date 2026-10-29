const test = require('node:test');
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const tick = () => new Promise(resolve => setImmediate(resolve));
const json = data => ({ ok: true, json: async () => data });

function worker(initial, fetchImpl, timer = setTimeout) {
  const state = { ...initial };
  const handlers = [];
  const messages = [];
  const calls = [];
  const local = {
    async get(keys, callback) {
      const data = Object.fromEntries(keys.filter(key => key in state).map(key => [key, state[key]]));
      if (callback) queueMicrotask(() => callback(data));
      return data;
    },
    async set(updates) {
      const changes = {};
      for (const [key, value] of Object.entries(updates)) {
        if (!isDeepStrictEqual(state[key], value)) changes[key] = { oldValue: state[key], newValue: value };
        state[key] = value;
      }
      if (Object.keys(changes).length) queueMicrotask(() => handlers.forEach(listener => listener(changes, 'local')));
    }
  };
  const chrome = {
    storage: { local, onChanged: { addListener: listener => handlers.push(listener) } },
    runtime: {
      getManifest: () => ({ version: '1.6.1' }),
      onInstalled: { addListener() {} }, onStartup: { addListener() {} },
      onMessage: { addListener: listener => messages.push(listener) }
    },
    alarms: { create() {}, onAlarm: { addListener() {} } }
  };
  const context = vm.createContext({
    chrome, console: { ...console, warn() {}, error() {} }, URL, AbortController, setTimeout: timer, clearTimeout,
    fetch: async (...args) => { calls.push(args[0]); return fetchImpl(...args); }
  });
  context.importScripts = (...names) => names.forEach(name => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), context));
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8'), context);
  return {
    state, calls, set: local.set,
    refresh: force => vm.runInContext(`fetchExchangeRate(${Boolean(force)})`, context),
    checkUpdates: () => vm.runInContext('checkForExtensionUpdate()', context),
    message: request => new Promise(resolve => messages[0](request, {}, resolve))
  };
}

const cached = () => ({
  rateSource: 'usd_krw', usdkrw: 1400, lastFetchSource: 'usd_krw',
  lastFetchTime: Date.now() - 120_000, lastFetchStatus: 'success'
});

test('successful fetch records its source and clears a previous error', async () => {
  const w = worker({ ...cached(), lastFetchError: 'old failure' }, () => json([{ rate: 1 / 1450 }]));
  await w.refresh(true);
  assert.equal(w.state.usdkrw, 1450);
  assert.equal(w.state.lastFetchSource, 'usd_krw');
  assert.equal(w.state.lastFetchStatus, 'success');
  assert.equal(w.state.lastFetchError, null);
});

test('USD fallback starts with the last working API and tries the others in order', async () => {
  const w = worker({ ...cached(), currentApiIndex: 1 }, url => {
    if (url.includes('open.er-api.com')) return json({ rates: { KRW: 1440 } });
    throw new Error('offline');
  });
  await w.refresh(true);
  assert.equal(w.state.usdkrw, 1440);
  assert.match(w.calls[0], /manana/);
  assert.match(w.calls[1], /api.exchangerate-api.com/);
  assert.match(w.calls[2], /api.exchangerate.host/);
  assert.match(w.calls[3], /open.er-api.com/);
});

test('all APIs failing preserves the actual quote and successful timestamp', async () => {
  const initial = cached();
  const w = worker(initial, () => { throw new Error('offline'); });
  await w.refresh(true);
  assert.equal(w.state.usdkrw, 1400);
  assert.equal(w.state.lastFetchTime, initial.lastFetchTime);
  assert.equal(w.state.lastFetchStatus, 'failed');
  assert.equal(w.state.lastFetchError, 'All USD/KRW APIs failed');
});

test('Upbit failure cannot silently substitute a USD quote or claim success', async () => {
  const w = worker({ ...cached(), rateSource: 'upbit_usdt' }, () => { throw new Error('offline'); });
  const result = await w.message({ action: 'refreshRate', force: true });
  assert.equal(w.calls.length, 1);
  assert.match(w.calls[0], /api.upbit.com/);
  assert.equal(w.state.lastFetchStatus, 'failed');
  assert.equal(w.state.lastFetchSource, 'usd_krw');
  assert.equal(result.success, false);
});

test('first offline run does not invent a fresh default quote', async () => {
  const w = worker({}, () => { throw new Error('offline'); });
  assert.equal(await w.refresh(true), null);
  assert.equal(w.state.usdkrw, undefined);
  assert.equal(w.state.lastFetchTime, undefined);
  assert.equal(w.state.lastFetchStatus, 'failed');
});

test('manual refresh bypasses the interval; automatic refresh uses the cache', async () => {
  const w = worker({ ...cached(), lastFetchTime: Date.now() }, () => json([{ rate: 1 / 1500 }]));
  assert.equal(await w.refresh(false), 1400);
  assert.equal(w.calls.length, 0);
  await w.refresh(true);
  assert.equal(w.calls.length, 1);
  assert.equal(w.state.usdkrw, 1500);
});

test('simultaneous refresh messages share one request', async () => {
  let finish;
  const response = new Promise(resolve => { finish = resolve; });
  const w = worker(cached(), () => response);
  const first = w.refresh(true);
  const second = w.refresh(true);
  await tick();
  assert.equal(w.calls.length, 1);
  finish(json([{ rate: 1 / 1500 }]));
  await Promise.all([first, second]);
  assert.equal(w.state.usdkrw, 1500);
});

test('a delayed response cannot overwrite a newly selected custom rate', async () => {
  let finish;
  const w = worker({ ...cached(), rateSource: 'upbit_usdt' }, () => new Promise(resolve => { finish = resolve; }));
  const oldRequest = w.refresh(true);
  await tick();
  await w.set({ rateSource: 'custom', customRateValue: 2750.25 });
  await tick();
  assert.equal(w.state.usdkrw, 2750.25);
  finish(json([{ market: 'KRW-USDT', trade_price: 1500 }]));
  await oldRequest;
  assert.equal(w.state.usdkrw, 2750.25);
  assert.equal(w.state.lastFetchSource, 'custom');
  assert.equal(w.state.lastFetchStatus, 'success');
});

test('custom rates require no network and do not use the old 2500 ceiling', async () => {
  const w = worker({ rateSource: 'custom', customRateValue: 3000 }, () => { throw new Error('must not fetch'); });
  await w.refresh(true);
  assert.equal(w.state.usdkrw, 3000);
  assert.equal(w.calls.length, 0);
});

test('the periodic alarm does not change the save time of a custom rate', async () => {
  const timestamp = Date.now() - 120_000;
  const w = worker({ rateSource: 'custom', customRateValue: 3000, usdkrw: 3000,
    lastFetchSource: 'custom', lastFetchTime: timestamp, lastFetchStatus: 'success' }, () => {
    throw new Error('must not fetch');
  });
  await w.refresh(false);
  assert.equal(w.state.lastFetchTime, timestamp);
  assert.equal(w.calls.length, 0);
});

test('hung fetches are aborted so a failed request can finish', async () => {
  let aborted = false;
  const w = worker({ ...cached(), rateSource: 'upbit_usdt' }, (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  }), (callback, ms) => setTimeout(callback, ms === 6000 ? 1 : ms));
  await w.refresh(true);
  assert.equal(aborted, true);
  assert.equal(w.state.lastFetchStatus, 'failed');
});

test('opening the popup can recover a worker stopped during a request', async () => {
  const w = worker({ ...cached(), lastFetchStatus: 'loading', lastFetchAttemptTime: Date.now() }, () => json([{ rate: 1 / 1450 }]));
  await w.refresh(false);
  assert.equal(w.calls.length, 1);
  assert.equal(w.state.lastFetchStatus, 'success');
});

test('routine update checks honor their cache', async () => {
  const w = worker({ updateLastCheckedAt: Date.now() }, () => { throw new Error('must not fetch'); });
  await w.checkUpdates();
  assert.equal(w.calls.length, 0);
});
