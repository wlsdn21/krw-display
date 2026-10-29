/* Shared defaults and validation for the worker, page scripts and popup. */
'use strict';

const KrwCommon = (() => {
  const DEFAULT_SITES = Object.freeze([
    'hyperliquid.xyz', 'lighter.xyz', 'binance.com', 'okx.com',
    'bitget.com', 'kucoin.com', 'bingx.com'
  ]);
  const REFRESH_INTERVAL_MS = 60_000;

  function isValidRate(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  function normalizeSite(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text || /\s/.test(text)) return null;
    try {
      const url = new URL(text.includes('://') ? text : `https://${text}`);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
      const hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
      if (hostname === 'localhost' || /^\[[0-9a-f:]+\]$/.test(hostname)) return hostname;
      if (hostname.length > 253 || !hostname.includes('.')) return null;
      return hostname.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
        ? hostname : null;
    } catch {
      return null;
    }
  }

  function matchesSite(hostname, site) {
    const domain = normalizeSite(site);
    const host = String(hostname).toLowerCase().replace(/\.$/, '');
    return Boolean(domain && (host === domain || host.endsWith(`.${domain}`)));
  }

  return Object.freeze({ DEFAULT_SITES, REFRESH_INTERVAL_MS, isValidRate, normalizeSite, matchesSite });
})();

if (typeof module !== 'undefined' && module.exports) module.exports = KrwCommon;
