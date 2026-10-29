(() => {
  "use strict";

  const OPTION_ATTR = "data-krw-unit-option";
  const PROXY_ATTR = "data-krw-unit-input";
  const HIDDEN_ATTR = "data-krw-unit-hidden";
  const STYLE_ID = "krw-unit-style";
  const DEFAULT_RATE = 1300;
  const RATE_BRIDGE_VERSION = "1";
  const RATE_REQUEST_EVENT = "akp153-request-krw-rate";
  const RATE_UPDATED_EVENT = "akp153-krw-rate-updated";

  let featureEnabled = true;
  let krwMode = false;
  let usdkrw = DEFAULT_RATE;
  let observer = null;
  let syncTimer = null;
  let currentTarget = null;
  let currentProxy = null;
  let krwInputValue = "";
  let settingOriginalValue = false;
  let lastRoute = window.location.pathname;
  let akp153RateQuote = null;

  function publishRateBridge() {
    const root = document.documentElement;
    if (!root) return;
    const rateIsUsable = akp153RateQuote
      && akp153RateQuote.schema === 1
      && akp153RateQuote.pair === "KRW-USDT"
      && akp153RateQuote.source === "upbit_usdt_ticker"
      && Number.isFinite(akp153RateQuote.krwPerUsdt)
      && akp153RateQuote.krwPerUsdt >= 500
      && akp153RateQuote.krwPerUsdt <= 2500
      && Number.isInteger(akp153RateQuote.fetchedAt)
      && akp153RateQuote.fetchedAt > 0;
    root.dataset.krwDisplayBridgeVersion = RATE_BRIDGE_VERSION;
    root.dataset.krwDisplayStatus = rateIsUsable ? "success" : "unavailable";
    if (rateIsUsable) {
      root.dataset.krwDisplayRate = String(akp153RateQuote.krwPerUsdt);
      root.dataset.krwDisplayUpdatedAt = String(akp153RateQuote.fetchedAt);
      root.dataset.krwDisplaySource = akp153RateQuote.source;
      root.dataset.krwDisplayQuoteAsset = "USDT";
    } else {
      delete root.dataset.krwDisplayRate;
      delete root.dataset.krwDisplayUpdatedAt;
      delete root.dataset.krwDisplaySource;
      delete root.dataset.krwDisplayQuoteAsset;
    }
    document.dispatchEvent(new Event(RATE_UPDATED_EVENT));
  }

  function requestAkp153Rate() {
    chrome.runtime.sendMessage({ action: "getAkp153KrwUsdtRate" }, response => {
      void chrome.runtime.lastError;
      akp153RateQuote = response?.success === true ? response.quote : null;
      publishRateBridge();
    });
  }

  function parsePositiveNumber(value) {
    const number = Number(String(value || "").replace(/,/g, "").trim());
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function stepDecimals(step) {
    const text = String(step || "1").toLowerCase();
    if (text.includes("e-")) return Number(text.split("e-")[1]) || 0;
    return (text.split(".")[1] || "").length;
  }

  function floorToStep(value, step) {
    const validStep = parsePositiveNumber(step) || 0.01;
    const decimals = stepDecimals(validStep);
    const floored = Math.floor((value + Number.EPSILON) / validStep) * validStep;
    return floored.toFixed(decimals);
  }

  function findAmountInput() {
    return document.querySelector(`input[id^="unitAmount-"]:not([${PROXY_ATTR}="true"])`);
  }

  function getAmountField(target) {
    return target?.closest(".bn-textField") || null;
  }

  function getSuffix(target) {
    return getAmountField(target)?.querySelector(".bn-textField-suffix") || null;
  }

  function inferQuoteUnitFromUrl() {
    const symbol = window.location.pathname.split("/").filter(Boolean).at(-1) || "";
    return symbol.match(/(USDT|USDC)$/i)?.[1]?.toUpperCase() || "";
  }

  function readUnderlyingUnit(target) {
    const suffix = getSuffix(target)?.textContent?.trim() || "";
    if (krwMode && /KRW/i.test(suffix)) {
      // Prefer the current symbol on Binance's single-page app so a stale
      // field from another contract cannot keep the wrong quote unit alive.
      return inferQuoteUnitFromUrl() || target?.dataset.krwUnderlyingUnit || "";
    }
    return suffix.match(/\b(USDT|USDC)\b/i)?.[1]?.toUpperCase() || suffix;
  }

  function findUnitTextNode(suffix) {
    if (!suffix) return null;
    const walker = document.createTreeWalker(suffix, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (/^(USDT|USDC|KRW)$/i.test(node.nodeValue.trim())) return node;
    }
    return null;
  }

  function setReactInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) return;
    settingOriginalValue = true;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    settingOriginalValue = false;
  }

  function formatKrwInput(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return digits ? Number(digits).toLocaleString("ko-KR") : "";
  }

  function convertKrwToQuote(target) {
    const krw = parsePositiveNumber(krwInputValue);
    const quote = krw ? floorToStep(krw / usdkrw, target.step) : "";
    if (String(target.value || "").replace(/,/g, "") !== quote) {
      setReactInputValue(target, quote);
    }
    if (currentProxy) {
      currentProxy.title = quote
        ? `내부 입력값: ${quote} ${target.dataset.krwUnderlyingUnit || "USDT"} · 기준환율 ₩${Math.round(usdkrw).toLocaleString("ko-KR")}`
        : `기준환율: 1달러 ≈ ₩${Math.round(usdkrw).toLocaleString("ko-KR")}`;
    }
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [${HIDDEN_ATTR}="true"] { display: none !important; }
      input[${PROXY_ATTR}="true"] {
        min-width: 0;
        width: 100%;
        font-family: BinanceNova, Arial, sans-serif;
        font-size: 12px;
        line-height: 18px;
        font-weight: 400;
      }
      [${OPTION_ATTR}="true"] {
        border: 1px solid rgba(240,185,11,.42);
        font-family: BinanceNova, Arial, sans-serif;
      }
      [${OPTION_ATTR}="true"].checked { background: rgba(240,185,11,.10); }
      [${OPTION_ATTR}="true"] .krw-unit-rate {
        color: #848e9c;
        margin-left: 6px;
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        font-weight: 400;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function restoreSuffix(target) {
    const suffix = getSuffix(target);
    const node = findUnitTextNode(suffix);
    const underlying = target?.dataset.krwUnderlyingUnit || inferQuoteUnitFromUrl();
    if (node && node.nodeValue.trim() === "KRW" && underlying) node.nodeValue = underlying;
    if (target) delete target.dataset.krwUnderlyingUnit;
  }

  function removeProxy({ preserveKrwValue = false } = {}) {
    if (currentTarget) {
      restoreSuffix(currentTarget);
      currentTarget.removeAttribute(HIDDEN_ATTR);
    }
    currentProxy?.remove();
    currentTarget = null;
    currentProxy = null;
    if (!preserveKrwValue) krwInputValue = "";
  }

  function createProxy(target) {
    const underlying = readUnderlyingUnit(target);
    if (underlying !== "USDT" && underlying !== "USDC") return false;

    const existingQuote = parsePositiveNumber(target.value);
    if (!krwInputValue && existingQuote) {
      krwInputValue = Math.ceil(existingQuote * usdkrw).toLocaleString("ko-KR");
    }

    ensureStyles();
    removeProxy({ preserveKrwValue: true });
    target.dataset.krwUnderlyingUnit = underlying;

    const proxy = document.createElement("input");
    proxy.type = "text";
    proxy.inputMode = "numeric";
    proxy.autocomplete = "off";
    proxy.className = target.className;
    proxy.setAttribute(PROXY_ATTR, "true");
    proxy.setAttribute("aria-label", "원화 주문 금액");
    proxy.placeholder = "원화 금액";
    proxy.value = krwInputValue;

    proxy.addEventListener("input", () => {
      krwInputValue = formatKrwInput(proxy.value);
      proxy.value = krwInputValue;
      convertKrwToQuote(target);
    });

    target.setAttribute(HIDDEN_ATTR, "true");
    target.insertAdjacentElement("afterend", proxy);

    const suffixNode = findUnitTextNode(getSuffix(target));
    if (suffixNode) suffixNode.nodeValue = suffixNode.nodeValue.replace(underlying, "KRW");

    currentTarget = target;
    currentProxy = proxy;
    convertKrwToQuote(target);
    return true;
  }

  function setKrwMode(nextValue) {
    krwMode = Boolean(nextValue && featureEnabled);
    chrome.storage.local.set({ binanceKrwUnitMode: krwMode });
    if (!krwMode) removeProxy();
    scheduleSync();
  }

  function findUnitMenu() {
    return Array.from(document.querySelectorAll('[role="tooltip"],[role="listbox"],[role="dialog"]')).find(menu => {
      const options = menu.querySelectorAll('[role="checkbox"],[role="option"]');
      return options.length >= 2 && Array.from(options).some(option => /\bUSDT\b|\bUSDC\b/i.test(option.textContent));
    }) || null;
  }

  function optionTitle(option) {
    const title = option?.querySelector(".t-subtitle2, .t-subtitle, [class*='subtitle']")?.textContent?.trim() || "";
    return title.match(/^(USDT|USDC)\b/i)?.[1]?.toUpperCase() || title;
  }

  function markOption(option, checked) {
    option.setAttribute("aria-checked", checked ? "true" : "false");
    option.classList.toggle("checked", checked);
  }

  function closeUnitMenu(target) {
    window.setTimeout(() => {
      const liveTarget = findAmountInput() || target;
      if (findUnitMenu()) getSuffix(liveTarget)?.click();
    }, 0);
  }

  function injectKrwOption(menu) {
    if (!featureEnabled) return;
    const options = Array.from(menu.querySelectorAll('[role="checkbox"],[role="option"]'));
    const quoteOption = options.find(option => /^(USDT|USDC)$/.test(optionTitle(option)));
    if (!quoteOption) return;

    const existing = menu.querySelector(`[${OPTION_ATTR}]`);
    if (existing) {
      const title = existing.querySelector(".t-subtitle2");
      if (title) title.innerHTML = `KRW <span class="krw-unit-rate">₩${Math.round(usdkrw).toLocaleString("ko-KR")}/USD</span>`;
      markOption(existing, krwMode);
      if (krwMode) {
        markOption(quoteOption, false);
      } else {
        const anotherChecked = options.some(option => option !== existing && option.getAttribute("aria-checked") === "true");
        if (!anotherChecked) markOption(quoteOption, true);
      }
      return;
    }

    const krwOption = quoteOption.cloneNode(true);
    krwOption.setAttribute(OPTION_ATTR, "true");
    krwOption.querySelectorAll('[role="radio"]').forEach(radio => radio.remove());
    const title = krwOption.querySelector(".t-subtitle2");
    const description = krwOption.querySelector("p");
    if (title) title.innerHTML = `KRW <span class="krw-unit-rate">₩${Math.round(usdkrw).toLocaleString("ko-KR")}/USD</span>`;
    if (description) description.textContent = "원화로 주문 규모 또는 초기 증거금을 입력합니다. 내부적으로 USDT/USDC로 환산됩니다.";
    markOption(krwOption, krwMode);
    if (krwMode) markOption(quoteOption, false);

    krwOption.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const target = findAmountInput();
      const underlying = readUnderlyingUnit(target);

      const activate = () => {
        krwMode = true;
        chrome.storage.local.set({ binanceKrwUnitMode: true });
        markOption(krwOption, true);
        markOption(quoteOption, false);
        scheduleSync();
        closeUnitMenu(target);
      };

      if (underlying !== "USDT" && underlying !== "USDC") {
        quoteOption.click();
        window.setTimeout(activate, 100);
      } else {
        activate();
      }
    });

    quoteOption.insertAdjacentElement("afterend", krwOption);
  }

  function sync() {
    syncTimer = null;
    if (!featureEnabled) {
      document.querySelectorAll(`[${OPTION_ATTR}]`).forEach(option => option.remove());
      removeProxy();
      return;
    }

    const menu = findUnitMenu();
    if (menu) injectKrwOption(menu);

    if (!krwMode) {
      removeProxy();
      return;
    }

    const target = findAmountInput();
    if (!target) {
      if (currentTarget && !currentTarget.isConnected) removeProxy({ preserveKrwValue: true });
      return;
    }

    const underlying = readUnderlyingUnit(target);
    if (underlying !== "USDT" && underlying !== "USDC") {
      // Keep KRW mode enabled while Binance mounts a different panel or
      // while the user is on a non-USDT/USDC contract. It will resume on the
      // next supported panel instead of being disabled permanently.
      removeProxy({ preserveKrwValue: true });
      return;
    }

    if (currentTarget === target && currentProxy?.isConnected) {
      const inferredUnit = inferQuoteUnitFromUrl();
      if (inferredUnit) target.dataset.krwUnderlyingUnit = inferredUnit;
      const suffixNode = findUnitTextNode(getSuffix(target));
      if (suffixNode && suffixNode.nodeValue.trim() !== "KRW") suffixNode.nodeValue = "KRW";
      convertKrwToQuote(target);
      return;
    }
    createProxy(target);
  }

  function scheduleSync() {
    if (syncTimer !== null) return;
    syncTimer = window.setTimeout(() => {
      try {
        sync();
      } catch (error) {
        // A React commit can detach the active input between two frames.
        // Leave the observer running and retry on the next DOM change.
        syncTimer = null;
        console.warn("[KRW Master] KRW order sync skipped", error);
      }
    }, 80);
  }

  function scheduleSyncBurst() {
    scheduleSync();
    [140, 360, 720].forEach(delay => window.setTimeout(scheduleSync, delay));
  }

  document.addEventListener("click", event => {
    const option = event.target.closest?.('[role="checkbox"],[role="option"]');
    const menu = option?.closest?.('[role="tooltip"],[role="listbox"],[role="dialog"]');
    if (!option || !menu || menu !== findUnitMenu() || option.hasAttribute(OPTION_ATTR)) return;
    setKrwMode(false);
  }, true);

  // The unit menu is mounted in a portal and its options arrive over several
  // React commits. Re-check shortly after the selector opens to avoid losing
  // the KRW option to that render timing.
  document.addEventListener("click", event => {
    if (event.target.closest?.(".bn-textField-suffix")) scheduleSyncBurst();
  }, true);

  document.addEventListener("input", event => {
    if (!krwMode || settingOriginalValue || event.target !== currentTarget) return;
    const quote = parsePositiveNumber(currentTarget.value);
    krwInputValue = quote ? Math.ceil(quote * usdkrw).toLocaleString("ko-KR") : "";
    if (currentProxy) currentProxy.value = krwInputValue;
  }, true);

  function applySettings(settings = {}) {
    featureEnabled = settings.krwOrderHelperEnabled !== false;
    krwMode = featureEnabled && settings.binanceKrwUnitMode === true;
    const rate = Number(settings.usdkrw);
    if (Number.isFinite(rate) && rate >= 500 && rate <= 2500) usdkrw = rate;

    if (!featureEnabled) removeProxy();
    if (!observer) {
      observer = new MutationObserver(scheduleSync);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    scheduleSync();
  }

  // Binance switches symbols and order panels through client-side navigation.
  // Detect that route change so a previous input reference cannot disable KRW
  // while the new panel is still mounting.
  window.setInterval(() => {
    const route = window.location.pathname;
    if (route === lastRoute) return;
    lastRoute = route;
    removeProxy({ preserveKrwValue: true });
    scheduleSyncBurst();
  }, 500);

  // Apply safe defaults immediately. Storage can respond after Binance has
  // already mounted the order form, which otherwise makes the KRW helper look
  // randomly absent until another render occurs.
  applySettings({});
  const sharedSettings = ["krwOrderHelperEnabled", "binanceKrwUnitMode", "usdkrw"];
  chrome.storage.local.get(sharedSettings, applySettings);
  requestAkp153Rate();

  document.addEventListener(RATE_REQUEST_EVENT, () => {
    requestAkp153Rate();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!sharedSettings.some(key => changes[key])) return;
    chrome.storage.local.get(sharedSettings, applySettings);
  });
})();
