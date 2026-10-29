(() => {
  "use strict";

  // State & Globals
  const currentHostname = window.location.hostname;
  let isExtensionRunning = false; // Track extension state
  let obs = null; // MutationObserver instance
  let rafScheduled = false;
  let pendingMutations = [];

  // Default sites
  const DEFAULT_SITES = [
    'hyperliquid.xyz',
    'lighter.xyz',
    'binance.com',
    'okx.com',
    'bitget.com',
    'kucoin.com',
    'bingx.com'
  ];

  // Settings State
  let isEnabled = true; // Logic enabled/disabled
  let showBillionUnit = true;
  let showTrillionUnit = true;
  let decimalPlaces = 2;

  // Constants
  const CONFIG = {
    DOM: {
      // Prevent processing overly long text nodes to avoid performance issues
      // Typical currency strings are < 100 chars. 500 is a safe upper bound.
      MAX_TEXT_LENGTH: 500,

      // Allow longer article/body text nodes when they contain currency hints.
      // This avoids missing cases like "70달러" embedded inside news paragraphs.
      MAX_CURRENCY_TEXT_LENGTH: 5000,

      // Limit DOM traversal depth to prevent infinite loops in deeply nested structures
      // 15 levels covers most realistic DOM structures while preventing stack overflow
      MAX_PARENT_DEPTH: 15
    },
    THRESHOLDS: {
      BILLION: 100_000_000,      // 1억
      TRILLION: 1_000_000_000_000 // 1조
    }
  };

  /**
   * Validate and sanitize settings from storage
   * @param {Object} settings - Raw settings object from chrome.storage
   * @returns {Object} Validated and sanitized settings
   */
  function validateSettings(settings) {
    const validated = { ...settings };

    // Validate decimal places: must be 0-4
    if (validated.decimalPlaces !== undefined) {
      const decPlaces = parseInt(validated.decimalPlaces);
      if (isNaN(decPlaces) || decPlaces < 0 || decPlaces > 4) {
        Logger.warn('content.js', `Invalid decimalPlaces: ${validated.decimalPlaces}, using default (2)`);
        validated.decimalPlaces = 2;
      } else {
        validated.decimalPlaces = decPlaces;
      }
    }

    // Validate exchange rates
    const validateRate = (rate, name, defaultVal, min = 0, max = 10000) => {
      if (rate !== undefined) {
        const numRate = parseFloat(rate);
        if (isNaN(numRate) || numRate < min || numRate > max) {
          Logger.warn('content.js', `Invalid ${name}: ${rate}, using default (${defaultVal})`);
          return defaultVal;
        }
        return numRate;
      }
      return undefined;
    };

    validated.usdkrw = validateRate(validated.usdkrw, 'usdkrw', 1300, 500, 2500);

    // Validate booleans
    const validateBool = (val, defaultVal) => {
      return val !== undefined ? Boolean(val) : defaultVal;
    };

    validated.isEnabled = validateBool(validated.isEnabled, true);
    validated.showBillionUnit = validateBool(validated.showBillionUnit, true);
    validated.showTrillionUnit = validateBool(validated.showTrillionUnit, true);

    return validated;
  }

  // Centralized currency configuration (DRY principle)
  // ⚠️ 패턴은 문자열로 저장 → transform()에서 매번 new RegExp()로 생성
  // 이유: global(/g) regex는 lastIndex를 인스턴스에 저장하므로 재사용 시 매칭 위치가 틀려짐
  const KOREAN_DOLLAR_POSTPOSITION_PATTERN = '(?:으로는|로는|에는|에도|으로|에서|에게|께서|까지|부터|처럼|조차|마저|밖에|이랑|이나|랑|은|는|이|가|을|를|와|과|의|에|도|만|로|나|엔)?';

  const CURRENCIES = {
    USD: {
      enabled: () => true, // USD is always enabled
      rate: () => CURRENCIES.USD._rate,
      _rate: 1300,
      patterns: [
        { source: '(-?)\\$\\s?([\\d,]+(?:\.\\d+)?)\\s?([kKmMbBtT만억조](?:n|N)?)?(?:\\s*\\(₩[^)]+\\))?', flags: 'g', type: 'symbol' },
        { source: '(-?)([\\d,]+(?:\.\\d+)?)\\s?([kKmMbBtT만억조](?:n|N)?)?\\s?(USD|USDT|USDC)(?![A-Za-z])(?:\\s*\\(₩[^)]+\\))?', flags: 'gi', type: 'suffix' },
        { source: `(-?)([\\d,]+(?:\.\\d+)?)\\s?([만억조])?\\s?(달러)(?=${KOREAN_DOLLAR_POSTPOSITION_PATTERN}(?:[^A-Za-z가-힣]|$))(?:\\s*\\(₩[^)]+\\))?`, flags: 'g', type: 'korean' }
      ]
    }
  };

  function hasCurrencyHint(text) {
    return text.includes('$') || text.includes('달러') || /(USD|USDT|USDC)/i.test(text);
  }




  /**
   * Load settings from Chrome storage and update currency configuration
   */
  function loadSettings() {
    chrome.storage.local.get([
      'usdkrw',
      'isEnabled', 'showBillionUnit', 'showTrillionUnit', 'decimalPlaces'
    ], (rawSettings) => {
      // Validate settings before applying
      const settings = validateSettings(rawSettings);

      // Update exchange rates (already validated)
      if (settings.usdkrw !== undefined) {
        CURRENCIES.USD._rate = settings.usdkrw;
      }

      // Update global settings (already validated)
      isEnabled = settings.isEnabled;
      showBillionUnit = settings.showBillionUnit;
      showTrillionUnit = settings.showTrillionUnit;
      decimalPlaces = settings.decimalPlaces;

      // If running, update DOM immediately with new settings
      if (isExtensionRunning) {
        forceUpdateDOM();
      }
    });
  }


  /**
   * Format number as KRW with Korean units (억, 조)
   * @param {number} v - Value to format
   * @returns {string} Formatted KRW string
   */
  function formatKRW(v) {
    const isNegative = v < 0;
    const abs = Math.abs(v);

    let result;
    if (showTrillionUnit && abs >= CONFIG.THRESHOLDS.TRILLION) {
      result = (abs / CONFIG.THRESHOLDS.TRILLION).toFixed(decimalPlaces) + "조";
    } else if (showBillionUnit && abs >= CONFIG.THRESHOLDS.BILLION) {
      result = (abs / CONFIG.THRESHOLDS.BILLION).toFixed(decimalPlaces) + "억";
    } else {
      result = Math.round(abs).toLocaleString('ko-KR');
    }

    return isNegative ? `-${result}` : result;
  }

  /**
   * Convert currency amount to KRW
   * @param {string} match - Original matched text
   * @param {string} sign - Negative sign if present
   * @param {string} numStr - Number string with possible commas
   * @param {string} unit - Unit multiplier (k, m, b, 만, 억, 조 etc.)
   * @returns {string} Converted text with KRW amount
   */
  function convertToKRW(match, sign, numStr, unit) {
    let num = parseFloat(numStr.replace(/,/g, ""));
    if (isNaN(num)) return match;

    // Apply unit multipliers
    const u = unit ? unit.toLowerCase().trim() : "";
    // English units
    if (u === "k") num *= 1e3;
    else if (u === "m" || u === "mn") num *= 1e6;
    else if (u === "b" || u === "bn") num *= 1e9;
    else if (u === "t" || u === "tn") num *= 1e12;
    // Korean units
    else if (u === "만") num *= 1e4;        // 10,000
    else if (u === "억") num *= 1e8;        // 100,000,000
    else if (u === "조") num *= 1e12;       // 1,000,000,000,000

    const amount = num * (sign.includes("-") ? -1 : 1);

    const krw = amount * CURRENCIES.USD.rate();
    const krwStr = formatKRW(krw);

    return `${match} (₩${krwStr})`;
  }

  /**
   * Transform text by converting all enabled currencies to KRW
   * Uses centralized CURRENCIES configuration (DRY principle)
   * @param {string} text - Text to transform
   * @returns {string} Transformed text with KRW conversions
   */
  function transform(text) {
    if (!text) return text;

    let result = text;

    // Process each enabled currency with its patterns
    for (const [currencyCode, config] of Object.entries(CURRENCIES)) {
      if (!config.enabled()) continue;

      for (const patternConfig of config.patterns) {
        // ✅ 매 호출마다 새 RegExp 인스턴스 생성 → lastIndex 재사용 버그 완전 방지
        const regex = new RegExp(patternConfig.source, patternConfig.flags);

        result = result.replace(regex, (match, sign, numStr, unit) => {
          if (!isEnabled) {
            // Remove existing KRW annotation when disabled
            return match.replace(/\s*\(₩[^)]+\)$/, '');
          }

          // Remove any existing KRW annotation before converting
          const cleanMatch = match.replace(/\s*\(₩[^)]+\)/, '');

          return convertToKRW(cleanMatch, sign, numStr, unit);
        });
      }
    }

    return result;
  }

  // Cache for editable elements to improve performance
  // ❓ 가이드: WeakSet 영구 캐시를 제거함
  // SPA에서는 contenteditable이 동적으로 추가/제거되므로
  // 한번 캐시된 노드가 에디터에서 사용 후 일반 DOM으로 변해도
  // 영구적으로 isEditable = true로 남아 변환에서 제외됨.
  // 해결: 매 호출마다 실시간 DOM 체크로 대체.

  // ✅ extension이 직접 수정한 텍스트 노드를 추적 → characterData 뮤테이션에서 자기 자신의 변경을 무시
  const extensionModifiedNodes = new WeakSet();

  /**
   * Check if a node is inside an editable element
   * @param {Node} node - DOM node to check
   * @returns {boolean} True if node is within an editable element
   */
  const isInEditableElement = (node) => {
    let parent = node.parentElement;
    let depth = 0;

    while (parent && depth < CONFIG.DOM.MAX_PARENT_DEPTH) {
      // ✅ 캐시 제거: 매 호출마다 실시간 코드로 체크
      const tagName = parent.tagName;

      // Check for input elements
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
        return true;
      }

      // Check for contenteditable
      if (parent.isContentEditable || parent.getAttribute('contenteditable') === 'true') {
        return true;
      }

      // Check for ARIA role (better compatibility with custom editors)
      const role = parent.getAttribute('role');
      if (role === 'textbox' || role === 'searchbox') {
        return true;
      }

      // Check for common rich text editor classes
      if (parent.classList && (
        parent.classList.contains('ql-editor') ||      // Quill
        parent.classList.contains('DraftEditor-root') || // Draft.js
        parent.classList.contains('tox-edit-area') ||   // TinyMCE
        parent.classList.contains('CodeMirror') ||      // CodeMirror
        parent.classList.contains('monaco-editor')      // Monaco
      )) {
        return true;
      }

      parent = parent.parentElement;
      depth++;
    }

    return false;
  };

  /**
   * Process a single text node for currency conversion
   * @param {Node} node - Text node to process
   */
  const processNode = (node) => {
    if (node.nodeType === 3) {
      const original = node.nodeValue;
      if (!original) return;

      if (original.length > CONFIG.DOM.MAX_TEXT_LENGTH) {
        if (!hasCurrencyHint(original) || original.length > CONFIG.DOM.MAX_CURRENCY_TEXT_LENGTH) {
          return;
        }
      }

      // Skip if inside editable elements
      if (isInEditableElement(node)) {
        return;
      }

      const transformed = transform(original);
      if (original !== transformed) {
        // ✅ 수정 전에 이 노드를 "extension이 수정함"으로 표시
        extensionModifiedNodes.add(node);
        node.nodeValue = transformed;
      }
    }
  };

  /**
   * Process all pending mutations in next animation frame
   */
  function processPendingMutations() {
    if (!isExtensionRunning) {
      pendingMutations = [];
      rafScheduled = false;
      return;
    }

    const processedNodes = new Set();

    for (const mutation of pendingMutations) {
      if (mutation.type === "characterData") {
        // ✅ extension이 직접 수정한 노드의 characterData 변경은 무시 (자기 자신의 이벤트)
        if (extensionModifiedNodes.has(mutation.target)) {
          extensionModifiedNodes.delete(mutation.target);
          continue;
        }
        processedNodes.add(mutation.target);
      } else if (mutation.type === "childList") {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 3) {
            processedNodes.add(node);
          } else if (node.nodeType === 1) {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            let n;
            while (n = walker.nextNode()) {
              processedNodes.add(n);
            }
          }
        });
      }
    }

    processedNodes.forEach(node => {
      try {
        processNode(node);
      } catch (error) {
        Logger.warn('content.js', 'Skipped a DOM node after a Binance rerender', {
          message: error?.message || String(error)
        });
      }
    });
    pendingMutations = [];
    rafScheduled = false;
  }

  /**
   * Force re-scan of the entire DOM
   */
  function forceUpdateDOM() {

    if (!document.body) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    const nodes = [];
    while (node = walker.nextNode()) {
      nodes.push(node);
    }
    nodes.forEach(node => {
      try {
        processNode(node);
      } catch (error) {
        Logger.warn('content.js', 'Skipped a DOM node during full refresh', {
          message: error?.message || String(error)
        });
      }
    });
  }



  function startExtension() {
    if (isExtensionRunning) return;

    isExtensionRunning = true;

    // Load settings first
    loadSettings();

    // Init Observer
    obs = new MutationObserver(mutations => {
      if (!isEnabled) return;
      pendingMutations.push(...mutations);
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(processPendingMutations);
      }
    });

    if (document.body) {
      obs.observe(document.body, { subtree: true, childList: true, characterData: true });
      forceUpdateDOM(); // Initial scan
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        obs.observe(document.body, { subtree: true, childList: true, characterData: true });
        forceUpdateDOM(); // Initial scan
      });
    }
  }

  function stopExtension() {
    if (!isExtensionRunning) return;

    isExtensionRunning = false;
    if (obs) {
      obs.disconnect();
      obs = null;
    }
    pendingMutations = [];
  }



  function checkAndRun() {
    chrome.storage.local.get(['applyToAllSites', 'enabledSites'], (result) => {
      const applyToAllSites = result.applyToAllSites || false;

      if (applyToAllSites) {
        startExtension();
      } else {
        const enabledSites = result.enabledSites || DEFAULT_SITES;
        const isWhitelisted = enabledSites.some(site => currentHostname.includes(site));

        if (isWhitelisted) {
          startExtension();
        } else {
          stopExtension();
        }
      }
    });
  }



  // Prime the default supported sites immediately. Chrome storage can answer
  // a little later than Binance's first render; waiting for that callback can
  // make the extension appear randomly missing after a refresh. The stored
  // site settings are still authoritative and can stop this immediately.
  if (DEFAULT_SITES.some(site => currentHostname.includes(site))) {
    startExtension();
  }

  // Check on load
  checkAndRun();

  // Check on settings change (Global listener)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      // Activation Logic Changes
      if (changes.applyToAllSites || changes.enabledSites) {
        // Re-evaluate if we should run
        checkAndRun();
      }

      // Settings Changes (only if running)
        if (isExtensionRunning) {
        if (changes.isEnabled || changes.showBillionUnit || changes.showTrillionUnit || changes.decimalPlaces ||
          changes.usdkrw) {
          loadSettings(); // Reloads and triggers forceUpdateDOM
        }
      }
    }
  });

  // Listen for messages from popup to reload settings
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'reloadSettings') {
      // Reload settings and update DOM without page reload
      loadSettings();
      sendResponse({ success: true });
      return true;
    }
  });

  // Clean up on page unload to prevent memory leaks
  window.addEventListener('beforeunload', () => {
    if (obs) {
      obs.disconnect();
      obs = null;
    }
    pendingMutations = [];
    isExtensionRunning = false;
  });

})();
