"use strict";

const assert = require("node:assert/strict");
const { translateValue } = require("./binance-ko-translations.js");

const cases = [
  ["Market", "시장가"],
  ["Action", "거래"],
  ["Depth", "호가 깊이"],
  ["Available", "주문 가능"],
  ["Size", "주문 수량"],
  ["Reduce-Only", "리듀스 온리(포지션 축소 전용)"],
  ["Post Only", "포스트 온리(메이커 전용)"],
  ["TIF", "주문 유효 조건"],
  ["GTC", "GTC(취소 전까지 유효)"],
  ["IOC", "IOC(즉시 체결 후 잔량 취소)"],
  ["FOK", "FOK(전량 즉시 체결)"],
  ["Cross", "교차 마진"],
  ["Isolated", "격리 마진"],
  ["Mark", "마크 가격"],
  ["Index", "지수 가격"],
  ["Liq Price", "청산 가격"],
  ["Adjusted Equity", "조정 순자산"],
  ["Funding Rate", "펀딩 비율"],
  ["Open Interest", "미결제약정"],
  ["Order Book", "호가창"],
  ["Trades", "최근 체결"],
  ["Sum", "누적 수량"],
  ["Reverse", "반대 포지션으로 전환"],
  ["Strike Price", "행사가"],
  ["Implied Volatility", "내재변동성"],
  ["Campaigns", "프로모션"],
  ["Earn", "예치 상품"],
  ["Privacy", "개인정보처리방침"],
  ["  Positions (12)  ", "  포지션(12)  "],
  ["Price (USDT)", "가격(USDT)"],
  ["Available: 1,250.45 USDT", "주문 가능: 1,250.45 USDT"],
  ["Margin Ratio: 4.21%", "증거금률: 4.21%"],
  ["Max. Buy: 500 USDT", "최대 매수 가능: 500 USDT"],
  ["PNL (ROE %)", "손익(ROE %)"],
  ["Funding (8h)", "펀딩 비율(8h)"]
];

for (const [source, expected] of cases) {
  assert.equal(translateValue(source), expected, source);
}

// 거래값, 코인명, 티커와 임의 문장은 절대로 추측 번역하지 않는다.
for (const untouched of [
  "BTCUSDT",
  "0.001 BTC",
  "1,250.45 USDT",
  "Bitcoin",
  "This text is not in the reviewed catalog"
]) {
  assert.equal(translateValue(untouched), null, untouched);
}

console.log(`Binance Korean terminology: ${cases.length} cases passed`);
