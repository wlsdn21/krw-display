const test = require('node:test');
const assert = require('node:assert/strict');
const common = require('../shared.js');
const core = require('../popup-core.js');

test('site inputs normalize URLs, IDNs and local addresses', () => {
  for (const [input, expected] of [
    [' HTTPS://WWW.Binance.com/en/futures?x=1 ', 'binance.com'],
    ['example.com:8080/path', 'example.com'], ['example.com.', 'example.com'],
    ['localhost:3000', 'localhost'], ['127.0.0.1:8080', '127.0.0.1'],
    ['https://한글.kr', 'xn--bj0bj06e.kr'], ['https://[::1]:3000', '[::1]']
  ]) assert.equal(common.normalizeSite(input), expected, input);
});

test('invalid or non-web site inputs cannot be stored', () => {
  for (const input of ['', 'not a url', 'example', 'https://', 'ftp://example.com',
    'javascript:alert(1)', 'https://user:password@example.com', '-bad.com', 'bad_.com', '.com', null]) {
    assert.equal(core.validateSite(input), null, String(input));
  }
});

test('site matching uses domain boundaries including subdomains', () => {
  assert.equal(common.matchesSite('www.binance.com', 'binance.com'), true);
  assert.equal(common.matchesSite('futures.binance.com', 'https://www.binance.com/path'), true);
  for (const host of ['notbinance.com', 'binance.com.example.net', 'example.net', 'binance-com.example.net']) {
    assert.equal(common.matchesSite(host, 'binance.com'), false, host);
  }
});

test('custom rates reject partial numbers, zero and non-finite values', () => {
  for (const value of ['', ' ', '0', '-1', 'Infinity', '1e999', '1300oops', 'NaN']) {
    assert.equal(core.parseCustomRate(value), null, value);
  }
  assert.equal(core.parseCustomRate('2750.25'), 2750.25);
  assert.equal(core.parseCustomRate('0.5'), 0.5);
  assert.equal(core.formatRate(undefined), '환율 미확인');
  assert.equal(core.formatRate(1450.25), '₩1,450.25');
});

test('refresh messages match the one minute alarm and distinguish waiting from fetching', () => {
  assert.equal(common.REFRESH_INTERVAL_MS, 60_000);
  assert.match(core.getRefreshTimerText('usd_krw', Date.now(), 'success'), /60초/);
  assert.equal(core.getRefreshTimerText('usd_krw', Date.now() - 61_000, 'success'), '자동 갱신 대기 중');
  assert.equal(core.getRefreshTimerText('usd_krw', Date.now(), 'loading'), '환율을 불러오는 중…');
  assert.match(core.getRefreshTimerText('usd_krw', Date.now(), 'failed'), /다시 시도/);
  assert.equal(core.formatRelativeTime(undefined), '성공한 갱신 기록 없음');
  assert.equal(core.calculatePremium(undefined, 1400), null);
  assert.equal(core.calculatePremium(1500, 0), null);
});

test('version ordering handles patch and multi-digit releases', () => {
  assert.equal(core.compareVersions('v1.6.1', '1.6.0'), 1);
  assert.equal(core.compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(core.compareVersions('1.6.1', '1.6.1'), 0);
});
