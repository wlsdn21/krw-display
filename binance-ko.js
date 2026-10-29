(() => {
  "use strict";

  const SETTING_KEY = "binanceKoreanEnabled";
  const MAX_TEXT_LENGTH = 220;
  const translatedNodes = new Set();
  const nodeState = new WeakMap();
  const translatedElements = new Set();
  const elementState = new WeakMap();
  const TRANSLATABLE_ATTRIBUTES = ["aria-label", "placeholder", "title"];
  const FINANCIAL_LABEL_RE = /^(?:Balance|Unrealized PNL|잔고|미실현 손익)$/i;
  const FINANCIAL_VALUE_RE = /^(-?)([\d,]+(?:\.\d+)?)\s*(USDT|USDC|USD)$/i;
  const financialNodes = new Set();
  const financialState = new WeakMap();
  let enabled = false;
  let currencyEnabled = false;
  let usdKrw = null;
  let observer = null;
  let frameRequested = false;
  let pendingRoots = new Set();
  let fallbackStartTimer = null;
  let scanRetryTimer = null;

  // Binance does not currently retain the /ko/ locale. Keep this dictionary
  // deliberately UI-focused: coin names, tickers, numbers and legal text stay intact.
  const TEXT = new Map(Object.entries({
    "Buy Crypto": "가상자산 구매",
    "Markets": "마켓",
    "Trade": "거래",
    "Futures": "선물",
    "Earn": "수익",
    "Square": "스퀘어",
    "More": "더보기",
    "Community": "커뮤니티",
    "Theme": "테마",
    "Overview": "개요",
    "Trading Data": "거래 데이터",
    "AI Select": "AI 추천",
    "Token Unlock": "토큰 언락",
    "Hot": "인기",
    "New": "신규",
    "Top Gainer": "상승률 상위",
    "Top Volume": "거래량 상위",
    "Favorites": "즐겨찾기",
    "Cryptos": "가상자산",
    "Spot": "현물",
    "TradFi": "전통 금융",
    "Alpha": "알파",
    "Zones": "테마",
    "All": "전체",
    "Payments": "결제",
    "Gaming": "게임",
    "Monitoring": "모니터링",
    "Fan Token": "팬 토큰",
    "Infrastructure": "인프라",
    "Storage": "스토리지",
    "Search Coin Name": "코인 이름 검색",
    "Price": "가격",
    "Last Price": "현재가",
    "24h Change": "24시간 변동",
    "24h Volume": "24시간 거래량",
    "Market Cap": "시가총액",
    "Volume": "거래량",
    "Action": "작업",
    "Chart": "차트",
    "Buy": "매수",
    "Sell": "매도",
    "Limit": "지정가",
    "Market": "시장가",
    "Stop Limit": "스탑 리밋",
    "Available": "사용 가능",
    "Amount": "수량",
    "Total": "총액",
    "Open Orders": "미체결 주문",
    "Order History": "주문 내역",
    "Trade History": "거래 내역",
    "About Us": "회사 소개",
    "About": "소개",
    "Careers": "채용",
    "Announcements": "공지사항",
    "News": "뉴스",
    "Press": "보도자료",
    "Legal": "법률",
    "Terms": "이용약관",
    "Privacy": "개인정보 보호",
    "Building Trust": "신뢰 구축",
    "Blog": "블로그",
    "Risk Warning": "위험 고지",
    "Notices": "알림",
    "Downloads": "다운로드",
    "Desktop Application": "데스크톱 앱",
    "Products": "제품",
    "Exchange": "거래소",
    "Crypto Payments": "가상자산 결제",
    "Gift Card": "기프트 카드",
    "Auto-Invest": "자동 투자",
    "Research": "리서치",
    "Charity": "자선",
    "Business": "비즈니스",
    "Learn": "학습",
    "Learn & Earn": "학습하고 보상받기",
    "Browse Crypto Prices": "가상자산 가격 보기",
    "Bitcoin Price": "비트코인 가격",
    "Ethereum Price": "이더리움 가격",
    "Buy Bitcoin": "비트코인 구매",
    "Buy BNB": "BNB 구매",
    "Buy XRP": "XRP 구매",
    "Buy Dogecoin": "도지코인 구매",
    "Buy Ethereum": "이더리움 구매",
    "Service": "서비스",
    "Affiliate": "제휴",
    "Referral": "추천인",
    "Historical Market Data": "과거 시장 데이터",
    "Trading Insight": "거래 인사이트",
    "Proof of Reserves": "준비금 증명",
    "Support": "고객지원",
    "24/7 Chat Support": "24시간 채팅 상담",
    "Support Center": "고객지원 센터",
    "Product Feedback & Suggestions": "제품 의견 및 제안",
    "Fees": "수수료",
    "Trading Parameters": "거래 조건",
    "Cookie Preferences": "쿠키 설정",

    "Options": "옵션",
    "Options Home": "옵션 홈",
    "Classic Options": "클래식 옵션",
    "Easy Options": "간편 옵션",
    "Options RFQ": "옵션 견적 요청",
    "Trading Bots": "트레이딩 봇",
    "Copy Trading": "카피 트레이딩",
    "Smart Money": "스마트 머니",
    "Campaigns": "이벤트",
    "Data": "데이터",

    "Avbl": "사용 가능",
    "Size": "수량",
    "Cross": "교차",
    "Conditional": "조건부",
    "Reduce-Only": "포지션 축소 전용",
    "TIF": "주문 유효 방식",
    "Buy/Long": "매수/롱",
    "Sell/Short": "매도/숏",
    "Liq Price": "청산 가격",
    "Cost": "비용",
    "Max": "최대",
    "Fee level": "수수료 등급",
    "Perp": "무기한",
    "Pre-Market Hours": "프리마켓 시간",
    "Mark": "마크 가격",
    "Index": "지수 가격",
    "Funding (8h) / Countdown": "펀딩비(8시간) / 남은 시간",
    "24h High": "24시간 최고가",
    "24h Low": "24시간 최저가",
    "Open Interest(USDT)": "미결제약정(USDT)",
    "Info": "정보",
    "Time": "시간",
    "Original": "기본 차트",
    "Trading View": "트레이딩뷰",
    "Depth": "깊이",
    "Order Book": "호가창",
    "Sum": "누적",
    "Trades": "체결 내역",
    "Top Movers": "급등락 종목",
    "Transaction History": "거래 기록",
    "Position History": "포지션 내역",
    "Bots": "봇",
    "Assets": "자산",
    "Hide Other Symbols": "다른 종목 숨기기",
    "PM Close All": "포트폴리오 마진 전체 종료",
    "Symbol": "종목",
    "Entry Price": "진입 가격",
    "Break Even Price": "손익분기 가격",
    "Mark Price": "마크 가격",
    "Liq.Price": "청산 가격",
    "Margin": "증거금",
    "Est. Funding Fee": "예상 펀딩비",
    "Close All Positions": "모든 포지션 종료",
    "Reverse": "포지션 반전",
    "Account": "계정",
    "Switch": "전환",
    "Portfolio Margin Info": "포트폴리오 마진 정보",
    "Total Debt": "총 부채",
    "Maintenance Margin": "유지 증거금",
    "Adjusted Equity": "조정 자산",
    "Balance": "잔고",
    "Unrealized PNL": "미실현 손익",
    "Futures PNL Analysis": "선물 손익 분석",
    "Transfer": "이체",
    "Stable connection": "연결 안정",
    "Disclaimer": "면책 조항",
    "Futures Chatroom": "선물 채팅방",
    "Trade Futures with USDT Flexible Assets": "USDT 유연 자산으로 선물 거래",
    "0 Maker Fee on USDC-M Contracts": "USDC-M 계약 지정가 수수료 0",

    "Top Crypto Options Exchange": "대표 가상자산 옵션 거래소",
    "Hello": "안녕하세요",
    "24hr Trading Volume (USDT)": "24시간 거래량(USDT)",
    "Open Interest (USDT)": "미결제약정(USDT)",
    "Underlying Assets": "기초자산",
    "No. of Contracts": "계약 수",
    "Market Highlights": "시장 주요 정보",
    "Trade Now": "지금 거래하기",
    "Top Gainers": "상승률 상위",
    "24hr%": "24시간 변동률",
    "Top 5 24hr Trade Volume": "24시간 거래량 상위 5개",
    "Volume (USDT)": "거래량(USDT)",
    "Top 5 Open Interest": "미결제약정 상위 5개",
    "Recent Trades": "최근 체결",
    "Calls": "콜 옵션",
    "Puts": "풋 옵션",
    "Binance Options Highlights": "바이낸스 옵션 주요 특징",
    "Options Data": "옵션 데이터",
    "Learn More": "자세히 보기",
    "Join us": "참여하기",
    "Why You Should Trade Binance Options": "바이낸스 옵션을 거래해야 하는 이유",
    "View More Articles": "더 많은 글 보기",
    "Why Trade with Binance Options": "바이낸스 옵션을 선택하는 이유",
    "Strengths": "장점",
    "Options vs Futures": "옵션과 선물 비교",
    "Stablecoin Options": "스테이블코인 옵션",
    "Low Capital Requirement": "낮은 필요 자본",
    "Competitive Fees": "경쟁력 있는 수수료",
    "Trade. Anywhere.": "어디서나 거래하세요.",
    "Start Trading Crypto Options": "가상자산 옵션 거래 시작하기",
    "Compatible with multiple devices, start trading with safety and convenience.": "다양한 기기에서 안전하고 편리하게 거래를 시작하세요.",
    "Trading Options can be simple and easy. Try Easy Options now!": "옵션 거래도 간단할 수 있습니다. 지금 간편 옵션을 이용해 보세요.",
    "Enhance your market intelligence with comprehensive and up-to-date market data on Options trading.": "종합적인 최신 옵션 시장 데이터로 시장 분석력을 높여보세요."
  }));

  const PHRASES = [
    [/^Cryptocurrency Market \| Coin Prices & Market Cap \| Binance$/, "가상자산 시장 | 코인 가격 및 시가총액 | Binance"],
    [/^Top Tokens by Market Capitalization$/, "시가총액 상위 토큰"],
    [/^Log In$/, "로그인"],
    [/^Sign Up$/, "가입하기"],
    [/^Deposit$/, "입금"],
    [/^Withdraw$/, "출금"],
    [/^Last login:\s*(.+)$/, "최근 로그인: $1"],
    [/^Positions\((\d+)\)$/, "포지션($1)"],
    [/^Open Orders\((\d+)\)$/, "미체결 주문($1)"],
    [/^24h Vol\(([^)]+)\)$/, "24시간 거래량($1)"],
    [/^Open Interest\(([^)]+)\)$/, "미결제약정($1)"],
    [/^Price \(([^)]+)\)$/, "가격($1)"],
    [/^Amount \(([^)]+)\)$/, "수량($1)"],
    [/^Volume \(([^)]+)\)$/, "거래량($1)"],
    [/^Copyright © (\d{4}) Binance Futures\. All rights reserved\.$/, "Copyright © $1 Binance Futures. 모든 권리 보유."]
  ];

  function translateValue(value) {
    const catalogTranslation = globalThis.KRW_BINANCE_KO?.translateValue(value);
    if (catalogTranslation) return catalogTranslation;

    // 이전 번역 파일만 단독으로 남은 개발 환경을 위한 최소 호환 경로다.
    if (!value || value.length > MAX_TEXT_LENGTH) return null;
    const leading = value.match(/^\s*/)?.[0] || "";
    const trailing = value.match(/\s*$/)?.[0] || "";
    const trimmed = value.trim();
    if (!trimmed) return null;

    let translated = TEXT.get(trimmed);
    if (!translated) {
      for (const [pattern, replacement] of PHRASES) {
        if (pattern.test(trimmed)) {
          translated = trimmed.replace(pattern, replacement);
          break;
        }
      }
    }

    return translated ? `${leading}${translated}${trailing}` : null;
  }

  function formatFinancialKrw(amount) {
    return Math.round(amount * usdKrw).toLocaleString("ko-KR");
  }

  function restoreFinancialAnnotations() {
    for (const element of financialNodes) {
      const state = financialState.get(element);
      if (!element.isConnected || !state) continue;
      if (element.textContent === state.translated) element.textContent = state.original;
    }
    financialNodes.clear();
  }

  function annotateFinancialValue(element) {
    const current = element.textContent?.trim() || "";
    const previous = financialState.get(element);
    const raw = previous && current === previous.translated
      ? previous.original
      : current.replace(/\s*\(₩[^)]*\)\s*$/u, "").trim();
    const match = raw.match(FINANCIAL_VALUE_RE);
    if (!match) return;

    if (!currencyEnabled) {
      if (previous && current === previous.translated) element.textContent = previous.original;
      return;
    }

    const amount = Number(match[2].replace(/,/g, "")) * (match[1] === "-" ? -1 : 1);
    if (!Number.isFinite(amount)) return;

    const translated = `${raw} (₩${formatFinancialKrw(amount)})`;
    if (current === translated) return;
    financialState.set(element, { original: raw, translated });
    financialNodes.add(element);
    element.textContent = translated;
  }

  function annotateFinancialMetrics(root) {
    if (!root || !root.isConnected) return;
    const rows = [];
    const ancestor = root.nodeType === Node.TEXT_NODE
      ? root.parentElement?.closest(".line-item")
      : root.closest?.(".line-item");
    if (ancestor) rows.push(ancestor);
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(".line-item")) rows.push(root);
    if (root.querySelectorAll) rows.push(...root.querySelectorAll(".line-item"));

    rows.forEach(row => {
      const label = Array.from(row.querySelectorAll(".text-TertiaryText, [class*='text-TertiaryText']"))
        .map(element => element.textContent?.trim() || "")
        .find(text => FINANCIAL_LABEL_RE.test(text));
      if (!label) return;

      const valueElements = Array.from(row.querySelectorAll("*"))
        .filter(element => element.children.length === 0);
      valueElements.forEach(annotateFinancialValue);
    });
  }

  function shouldSkip(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest("script, style, noscript, textarea, input, [contenteditable='true']")) return true;
    return false;
  }

  function processTextNode(node) {
    if (!enabled || node.nodeType !== Node.TEXT_NODE || shouldSkip(node)) return;
    const current = node.nodeValue;
    const previous = nodeState.get(node);

    // Binance may reuse a node after a live update. Its new English value becomes
    // the new source instead of being overwritten with a stale stored value.
    if (previous && current === previous.translated) return;

    const translated = translateValue(current);
    if (!translated || translated === current) return;

    nodeState.set(node, { original: current, translated });
    translatedNodes.add(node);
    node.nodeValue = translated;
  }

  function processElement(element) {
    if (!enabled || element.nodeType !== Node.ELEMENT_NODE) return;
    let states = elementState.get(element);

    for (const attribute of TRANSLATABLE_ATTRIBUTES) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute);
      const previous = states?.get(attribute);
      if (previous && current === previous.translated) continue;

      const translated = translateValue(current);
      if (!translated || translated === current) continue;

      if (!states) {
        states = new Map();
        elementState.set(element, states);
      }
      states.set(attribute, { original: current, translated });
      translatedElements.add(element);
      element.setAttribute(attribute, translated);
    }
  }

  function scan(root) {
    if (!root || !root.isConnected) return;
    annotateFinancialMetrics(root);
    if (!enabled) return;
    if (root.nodeType === Node.TEXT_NODE) {
      annotateFinancialMetrics(root.parentElement?.closest(".line-item"));
      processTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    if (root.nodeType === Node.ELEMENT_NODE) processElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) processTextNode(node);
      else processElement(node);
    }
  }

  function safeScan(root) {
    try {
      scan(root);
    } catch (error) {
      // Binance can replace large parts of the page while it is mounting.
      // Keep the observer alive so the next render can recover the feature.
      console.warn("[KRW Master] Binance Korean scan skipped", error);
      if (!scanRetryTimer) {
        scanRetryTimer = window.setTimeout(() => {
          scanRetryTimer = null;
          safeScan(document.body || document.documentElement);
        }, 500);
      }
    }
  }

  function flush() {
    // Binance frequently replaces panels; detached translations must not retain them.
    for (const nodes of [translatedNodes, translatedElements, financialNodes]) {
      for (const node of nodes) if (!node.isConnected) nodes.delete(node);
    }
    frameRequested = false;
    const roots = pendingRoots;
    pendingRoots = new Set();
    roots.forEach(safeScan);
  }

  function schedule(root) {
    pendingRoots.add(root);
    if (!frameRequested) {
      frameRequested = true;
      const requestFrame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
      requestFrame(flush);
    }
  }

  function restoreEnglish() {
    for (const node of translatedNodes) {
      const state = nodeState.get(node);
      if (node.isConnected && state && node.nodeValue === state.translated) {
        node.nodeValue = state.original;
      }
    }
    translatedNodes.clear();

    for (const element of translatedElements) {
      const states = elementState.get(element);
      if (!element.isConnected || !states) continue;
      for (const [attribute, state] of states) {
        if (element.getAttribute(attribute) === state.translated) {
          element.setAttribute(attribute, state.original);
        }
      }
    }
    translatedElements.clear();
  }

  function start() {
    if (observer) return;
    try {
      // Install the observer before the initial scan. If Binance is midway
      // through a React render, a failed scan can then recover on the next DOM
      // commit instead of leaving the extension permanently inactive.
      observer = new MutationObserver((mutations) => {
        if (!enabled && !currencyEnabled) return;
        for (const mutation of mutations) {
          if (mutation.type === "characterData") schedule(mutation.target);
          if (mutation.type === "attributes") schedule(mutation.target);
          mutation.addedNodes.forEach(schedule);
        }
      });
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: TRANSLATABLE_ATTRIBUTES
      });
      safeScan(document.body || document.documentElement);
    } catch (error) {
      observer?.disconnect();
      observer = null;
      console.warn("[KRW Master] Binance Korean startup delayed", error);
      if (!fallbackStartTimer) {
        fallbackStartTimer = window.setTimeout(() => {
          fallbackStartTimer = null;
          start();
        }, 800);
      }
    }
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    if (fallbackStartTimer) {
      window.clearTimeout(fallbackStartTimer);
      fallbackStartTimer = null;
    }
    if (scanRetryTimer) {
      window.clearTimeout(scanRetryTimer);
      scanRetryTimer = null;
    }
    pendingRoots.clear();
    restoreEnglish();
    restoreFinancialAnnotations();
  }

  function applySetting(value) {
    enabled = value !== false;
    if (!enabled) restoreEnglish();
    if (enabled || currencyEnabled) start();
    else stop();
  }

  function refreshFinancialSettings() {
    chrome.storage.local.get(["isEnabled", "krwOrderHelperEnabled", "usdkrw", SETTING_KEY], (result) => {
      // Keep the Binance account metrics useful when the general page-text
      // converter is off but the Binance KRW helper is still enabled.
      usdKrw = KrwCommon.isValidRate(result.usdkrw) ? result.usdkrw : null;
      currencyEnabled = usdKrw !== null && (result.isEnabled !== false || result.krwOrderHelperEnabled !== false);
      if (!currencyEnabled) restoreFinancialAnnotations();
      applySetting(result[SETTING_KEY]);

      if (enabled || currencyEnabled) {
        start();
        schedule(document.body || document.documentElement);
      } else {
        stop();
        restoreFinancialAnnotations();
      }
    });
  }

  // Read saved preferences before translating or annotating the page.
  refreshFinancialSettings();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[SETTING_KEY]) {
      applySetting(changes[SETTING_KEY].newValue);
    }
    if (changes.isEnabled || changes.krwOrderHelperEnabled || changes.usdkrw) {
      refreshFinancialSettings();
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "reloadSettings") {
      chrome.storage.local.get([SETTING_KEY], (result) => {
        applySetting(result[SETTING_KEY]);
        refreshFinancialSettings();
        sendResponse({ success: true });
      });
      return true;
    }
  });
})();
