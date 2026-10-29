(() => {
  "use strict";

  const PANEL_SELECTOR = "#position-pc";
  const ROW_SELECTOR = ".list-item-container";
  const HEADER_ATTR = "data-krw-position-return-header";
  const CELL_ATTR = "data-krw-position-return-cell";
  const VALUE_CLASS = "krw-position-return-value";
  const STYLE_ID = "krw-position-return-style";
  const GENERATED_SELECTOR = `[${HEADER_ATTR}], [${CELL_ATTR}]`;

  if (window.__krwPositionReturnInstalled) return;
  window.__krwPositionReturnInstalled = true;

  let observer = null;
  let scanFrame = 0;
  let healthTimer = 0;

  function parseNumber(value) {
    const match = String(value || "")
      .replace(/,/g, "")
      .match(/-?\d+(?:\.\d+)?/);
    if (!match) return NaN;

    const number = Number(match[0]);
    return Number.isFinite(number) ? number : NaN;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [${HEADER_ATTR}], [${CELL_ATTR}] {
        box-sizing: border-box !important;
        flex: 1 0 120px !important;
        min-width: 120px !important;
        width: 120px !important;
        padding-left: 8px !important;
        padding-right: 8px !important;
        white-space: nowrap !important;
        font-family: BinanceNova, Arial, sans-serif !important;
        font-weight: 400 !important;
        letter-spacing: normal !important;
      }
      [${HEADER_ATTR}] {
        color: #eaecef !important;
        font-size: 16px !important;
        line-height: 24px !important;
      }
      [${CELL_ATTR}] {
        color: #eaecef !important;
        font-size: 12px !important;
        line-height: 18px !important;
        font-variant-numeric: tabular-nums;
      }
      [${CELL_ATTR}] .${VALUE_CLASS} {
        font-family: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        letter-spacing: inherit !important;
        font-variant-numeric: tabular-nums;
      }
      [${CELL_ATTR}][data-tone="positive"],
      [${CELL_ATTR}][data-tone="positive"] * { color: #2ebd85 !important; }
      [${CELL_ATTR}][data-tone="negative"],
      [${CELL_ATTR}][data-tone="negative"] * { color: #f6465d !important; }
      [${CELL_ATTR}][data-tone="neutral"],
      [${CELL_ATTR}][data-tone="neutral"] * { color: #eaecef !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function findPnlHeader(panel) {
    const candidates = Array.from(panel.querySelectorAll(".pnl"));
    return candidates.find((node) => {
      return !node.closest(ROW_SELECTOR) && /PNL\s*\(ROI/i.test(node.textContent || "");
    }) || candidates.find((node) => !node.closest(ROW_SELECTOR)) || null;
  }

  function getColumnLayout(panel) {
    const pnlHeader = findPnlHeader(panel);
    const headerRow = pnlHeader?.parentElement || null;
    const headerCells = headerRow ? Array.from(headerRow.children) : [];
    const indexOf = (className, fallback) => {
      const index = headerCells.findIndex((cell) => cell.classList.contains(className));
      return index >= 0 ? index : fallback;
    };

    return {
      pnlHeader,
      symbol: indexOf("symbol", 0),
      size: indexOf("size", 1),
      entry: indexOf("entryPrice", 2),
      mark: indexOf("markPrice", 4),
      pnl: indexOf("pnl", 7),
    };
  }

  function ensureHeader(panel, layout) {
    if (panel.querySelector(`[${HEADER_ATTR}]`)) return;
    if (!layout.pnlHeader?.parentElement) return;

    const header = layout.pnlHeader.cloneNode(false);
    header.setAttribute(HEADER_ATTR, "true");
    header.classList.remove("pnl", "cursor-pointer");
    header.textContent = "포지션 수익률";
    header.title = "레버리지를 제외한 진입가 대비 마크 가격 변동률";
    header.style.justifyContent = "flex-start";
    layout.pnlHeader.parentElement.insertBefore(header, layout.pnlHeader.nextElementSibling);
  }

  function getDirection(symbolCell, sizeCell) {
    const sideMarker = symbolCell?.querySelector('[class*="bg-Buy"], [class*="bg-Sell"]');
    const markerClass = String(sideMarker?.className || "");
    if (markerClass.includes("bg-Sell")) return -1;
    if (markerClass.includes("bg-Buy")) return 1;

    const size = parseNumber(sizeCell?.textContent);
    return Number.isFinite(size) && size < 0 ? -1 : 1;
  }

  function formatReturn(value) {
    const rounded = Math.abs(value) < 0.005 ? 0 : Number(value.toFixed(2));
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded.toFixed(2)}%`;
  }

  function ensureReturnCell(mainRow, pnlIndex) {
    const cells = Array.from(mainRow.children);
    let returnCell = cells.find((cell) => cell.hasAttribute(CELL_ATTR));
    const pnlCell = cells[pnlIndex] || cells[7];
    if (!pnlCell) return null;

    if (!returnCell) {
      returnCell = pnlCell.cloneNode(false);
      returnCell.setAttribute(CELL_ATTR, "true");
      returnCell.innerHTML = "";
      returnCell.style.justifyContent = "flex-start";
      mainRow.insertBefore(returnCell, pnlCell.nextElementSibling);
    } else if (returnCell.previousElementSibling !== pnlCell) {
      mainRow.insertBefore(returnCell, pnlCell.nextElementSibling);
    }

    let valueElement = returnCell.querySelector(`.${VALUE_CLASS}`);
    if (!valueElement) {
      valueElement = document.createElement("span");
      valueElement.className = VALUE_CLASS;
      returnCell.appendChild(valueElement);
    }

    return { returnCell, valueElement };
  }

  function updateRow(row, layout) {
    const mainRow = row.firstElementChild;
    if (!mainRow) return;

    const cells = Array.from(mainRow.children);
    if (cells.length <= Math.max(layout.entry, layout.mark, layout.pnl)) return;

    const cellParts = ensureReturnCell(mainRow, layout.pnl);
    if (!cellParts) return;

    const { returnCell, valueElement } = cellParts;
    const entryPrice = parseNumber(cells[layout.entry]?.textContent);
    const markPrice = parseNumber(cells[layout.mark]?.textContent);
    const direction = getDirection(cells[layout.symbol], cells[layout.size]);

    let display = "—";
    let tone = "neutral";
    if (Number.isFinite(entryPrice) && entryPrice !== 0 && Number.isFinite(markPrice)) {
      const positionReturn = direction * ((markPrice - entryPrice) / Math.abs(entryPrice)) * 100;
      if (Number.isFinite(positionReturn)) {
        display = formatReturn(positionReturn);
        tone = positionReturn > 0.005 ? "positive" : positionReturn < -0.005 ? "negative" : "neutral";
      }
    }

    if (returnCell.dataset.krwPositionReturnDisplay !== display) {
      valueElement.textContent = display;
      returnCell.dataset.krwPositionReturnDisplay = display;
    }
    if (returnCell.dataset.tone !== tone) returnCell.dataset.tone = tone;

    returnCell.title = "레버리지를 제외한 진입가 대비 마크 가격 변동률";
  }

  function scan() {
    scanFrame = 0;
    const panel = document.querySelector(PANEL_SELECTOR);
    if (!panel) return;

    ensureStyles();
    const layout = getColumnLayout(panel);
    ensureHeader(panel, layout);
    panel.querySelectorAll(ROW_SELECTOR).forEach((row) => updateRow(row, layout));
  }

  function safeScan() {
    try {
      scan();
    } catch (error) {
      // Binance can briefly expose an incomplete row while switching symbols.
      // Keep the watchdog alive and retry on the next render instead of
      // losing the position-return column for the rest of the tab session.
      console.warn("[KRW Master] Position return scan skipped", error);
    }
  }

  function scheduleScan() {
    if (scanFrame) return;
    const requestFrame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
    scanFrame = requestFrame(() => {
      scanFrame = 0;
      safeScan();
    });
  }

  function scheduleHealthCheck() {
    if (healthTimer) return;
    healthTimer = window.setTimeout(() => {
      healthTimer = 0;
      if (!observer) {
        start();
        return;
      }
      const panel = document.querySelector(PANEL_SELECTOR);
      if (panel && !panel.querySelector(`[${HEADER_ATTR}]`)) scheduleScan();
      scheduleHealthCheck();
    }, 1500);
  }

  function nodeTouchesPanel(node, panel) {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!element) return false;
    if (!panel) return element.matches(PANEL_SELECTOR) || Boolean(element.querySelector(PANEL_SELECTOR));
    return panel.contains(element) || element === panel || element.contains(panel);
  }

  function mutationNeedsScan(mutations, panel) {
    return mutations.some((mutation) => {
      const target = mutation.target;
      const targetElement = target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
      if (targetElement?.closest(GENERATED_SELECTOR)) return false;
      if (nodeTouchesPanel(target, panel)) return true;
      return Array.from(mutation.addedNodes || []).some((node) => nodeTouchesPanel(node, panel));
    });
  }

  function start() {
    ensureStyles();
    if (!observer) {
      try {
        observer = new MutationObserver((mutations) => {
          const panel = document.querySelector(PANEL_SELECTOR);
          if (mutationNeedsScan(mutations, panel)) scheduleScan();
        });
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["class"],
        });
      } catch (error) {
        observer = null;
        console.warn("[KRW Master] Position return observer delayed", error);
      }
    }
    safeScan();
    scheduleHealthCheck();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("pagehide", () => {
    observer?.disconnect();
    observer = null;
    if (healthTimer) window.clearTimeout(healthTimer);
    if (scanFrame) window.clearTimeout(scanFrame);
    if (scanFrame) window.cancelAnimationFrame?.(scanFrame);
    healthTimer = 0;
    scanFrame = 0;
  }, { once: true });
})();
