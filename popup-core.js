/* Presentation helpers kept independent from Chrome and the DOM. */
'use strict';

const PopupCore = ((common) => ({
  formatRate(rate) {
    if (!common.isValidRate(rate)) return '환율 미확인';
    return `₩${rate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  getSourceLabel(source) {
    return {
      usd_krw: '1 USD · 국제 환율',
      upbit_usdt: '1 USDT · 업비트',
      upbit_usdc: '1 USDC · 업비트',
      custom: '1 USD / USDT / USDC · 사용자 지정'
    }[source] || '1 USD · 국제 환율';
  },

  formatRelativeTime(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '성공한 갱신 기록 없음';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return '방금 전 갱신';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전 갱신`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전 갱신`;
    return `${new Date(timestamp).toLocaleDateString('ko-KR')} 갱신`;
  },

  getRefreshTimerText(rateSource, lastAttempt, status) {
    if (rateSource === 'custom') return '직접 저장한 환율 사용';
    if (status === 'loading') return '환율을 불러오는 중…';
    if (!lastAttempt) return '자동 갱신 대기 중';
    const seconds = Math.max(0, Math.ceil((common.REFRESH_INTERVAL_MS - (Date.now() - lastAttempt)) / 1000));
    if (!seconds) return '자동 갱신 대기 중';
    return `약 ${seconds}초 후 ${status === 'failed' ? '다시 시도' : '자동 갱신'}`;
  },

  calculatePremium(tradePrice, standardRate) {
    if (!common.isValidRate(tradePrice) || !common.isValidRate(standardRate)) return null;
    return ((tradePrice - standardRate) / standardRate) * 100;
  },

  validateSite(site) {
    return common.normalizeSite(site);
  },

  parseCustomRate(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const number = Number(value);
    return common.isValidRate(number) ? number : null;
  },

  compareVersions(a, b) {
    const parts = version => String(version || '').trim().replace(/^v/i, '').split('.').map(part => Number(part) || 0);
    const left = parts(a);
    const right = parts(b);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) > (right[i] || 0) ? 1 : -1;
    }
    return 0;
  }
}))(typeof module !== 'undefined' && module.exports ? require('./shared.js') : KrwCommon);

if (typeof module !== 'undefined' && module.exports) module.exports = PopupCore;
