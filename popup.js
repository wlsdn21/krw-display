// Popup Logic

"use strict";

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // DOM Elements
    const rateValue = document.getElementById('rateValue');
    const lastUpdate = document.getElementById('lastUpdate');
    const statusIndicator = document.getElementById('statusIndicator');
    const autoRefreshTimer = document.getElementById('autoRefreshTimer');
    const enableToggle = document.getElementById('enableToggle');
    const binanceKoreanToggle = document.getElementById('binanceKoreanToggle');
    const krwOrderHelperToggle = document.getElementById('krwOrderHelperToggle');
    const billionToggle = document.getElementById('billionToggle');
    const trillionToggle = document.getElementById('trillionToggle');
    const decimalSelect = document.getElementById('decimalSelect');
    const rateSourceToggle = document.getElementById('rateSourceToggle');
    const rateSourceOptions = document.getElementById('rateSourceOptions');
    const rateSourceOptionElements = document.querySelectorAll('.rate-source-option');
    const updateBanner = document.getElementById('updateBanner');
    const updateBannerTitle = document.getElementById('updateBannerTitle');
    const updateBannerDescription = document.getElementById('updateBannerDescription');
    const updateBannerBtn = document.getElementById('updateBannerBtn');
    const versionLabel = document.getElementById('versionLabel');

    if (updateBanner) {
        updateBanner.hidden = true;
        updateBanner.style.display = 'none';
    }

    // Custom Rate Elements
    const customRateInputContainer = document.getElementById('customRateInputContainer');
    const customRateInput = document.getElementById('customRateInput');
    const saveCustomRateBtn = document.getElementById('saveCustomRateBtn');

    // Pop-out Logic
    const popOutBtn = document.getElementById('popOutBtn');
    if (popOutBtn) {
        popOutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.windows.create({
                url: 'popup.html',
                type: 'popup',
                width: 380,
                height: 600
            });
            window.close(); // Close current popup
        });
    }

    // ... (rest of code 1) ...

    // Helper functions moved to PopupCore (popup-core.js)
    if (versionLabel) {
        versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;
    }

    // Update auto-refresh timer UI
    function updateRefreshTimer(rateSource, lastFetchTime) {
        const text = PopupCore.getRefreshTimerText(rateSource, lastFetchTime);
        autoRefreshTimer.textContent = text;
    }

    // Update status indicator
    function updateStatus(status) {
        // Reset classes
        statusIndicator.className = 'status-indicator';

        if (status === 'success') {
            statusIndicator.classList.add('status-success');
            statusIndicator.title = 'Refresh successful';
        } else if (status === 'failed') {
            statusIndicator.classList.add('status-error');
            statusIndicator.title = 'Refresh failed (retrying)';
        } else if (status === 'loading') {
            statusIndicator.classList.add('status-loading');
            statusIndicator.title = 'Refreshing';
        } else {
            statusIndicator.title = 'Idle';
        }
    }

    function renderUpdateBanner(result) {
        if (!updateBanner || !updateBannerTitle || !updateBannerDescription || !updateBannerBtn) {
            return;
        }

        const currentVersion = chrome.runtime.getManifest().version;
        const hasNewerVersion = result.updateLatestVersion
            ? compareVersions(result.updateLatestVersion, currentVersion) > 0
            : false;

        if (!result.updateAvailable || !hasNewerVersion || !result.updateLatestVersion || !result.updateDownloadUrl) {
            updateBanner.hidden = true;
            updateBanner.style.display = 'none';
            delete updateBannerBtn.dataset.url;
            return;
        }

        updateBannerTitle.textContent = `새 버전 v${result.updateLatestVersion} 사용 가능`;
        updateBannerDescription.textContent = '압축해제된 확장 프로그램은 자동 업데이트되지 않습니다. 최신 ZIP을 받아 다시 로드하세요.';
        updateBannerBtn.dataset.url = result.updateDownloadUrl;
        updateBanner.hidden = false;
        updateBanner.style.display = 'flex';
    }

    function normalizeVersion(version) {
        return String(version || '').trim().replace(/^v/i, '');
    }

    function compareVersions(a, b) {
        const aParts = normalizeVersion(a).split('.').map(part => parseInt(part, 10) || 0);
        const bParts = normalizeVersion(b).split('.').map(part => parseInt(part, 10) || 0);
        const maxLength = Math.max(aParts.length, bParts.length);

        for (let i = 0; i < maxLength; i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal > bVal) return 1;
            if (aVal < bVal) return -1;
        }

        return 0;
    }





    function loadData() {
        chrome.storage.local.get([
            'usdkrw',
            'customRateValue', // Load custom value
            'lastFetchTime',
            'lastFetchStatus',
            'lastFetchError',  // Add error message
            'isEnabled',
            'binanceKoreanEnabled',
            'krwOrderHelperEnabled',
            'showBillionUnit',
            'showTrillionUnit',
            'decimalPlaces',
            'rateSource',
            'updateAvailable',
            'updateLatestVersion',
            'updateDownloadUrl'
        ], (result) => {



            // Update rate display
            if (result.usdkrw && result.usdkrw > 0) {
                const rateSource = result.rateSource || 'usd_krw'; // Default source is fine visually
                rateValue.textContent = PopupCore.formatRate(result.usdkrw, rateSource);
            } else {
                // If no data found, don't show 1300. Show real status.
                rateValue.textContent = 'No rate data';
                // Trigger refresh
                chrome.runtime.sendMessage({ action: 'refreshRate' });
            }

            const rateSource = result.rateSource || 'usd_krw';

            // Update last update time
            lastUpdate.textContent = PopupCore.formatRelativeTime(result.lastFetchTime);

            // Update status indicator
            const status = result.lastFetchStatus || 'loading';
            updateStatus(status);

            // Show error message if API failed
            if (result.lastFetchError && status === 'failed') {
                // Add subtle error indicator
                const errorHint = ` (오류: ${result.lastFetchError.substring(0, 30)}...)`;
                if (!lastUpdate.textContent.includes('(오류:')) {
                    lastUpdate.textContent += errorHint;
                }
            }

            // Update settings UI
            enableToggle.checked = result.isEnabled !== undefined ? result.isEnabled : true;
            binanceKoreanToggle.checked = result.binanceKoreanEnabled !== undefined ? result.binanceKoreanEnabled : true;
            krwOrderHelperToggle.checked = result.krwOrderHelperEnabled !== undefined ? result.krwOrderHelperEnabled : true;
            billionToggle.checked = result.showBillionUnit !== undefined ? result.showBillionUnit : true;
            trillionToggle.checked = result.showTrillionUnit !== undefined ? result.showTrillionUnit : true;
            decimalSelect.value = result.decimalPlaces !== undefined ? result.decimalPlaces : 2;

            // Set input value
            if (result.customRateValue) {
                customRateInput.value = result.customRateValue;
            }

            // Update selected rate source option
            updateSelectedRateSource(rateSource);

            // Update refresh timer
            updateRefreshTimer(rateSource, result.lastFetchTime);
            renderUpdateBanner(result);

            // Force refresh if stuck on old default
            // But now we don't default to 1300 unless it's genuinely saved as 1300.
            if (result.usdkrw === 1300 && rateSource !== 'custom') {

                updateStatus('loading');
                chrome.runtime.sendMessage({ action: 'refreshRate' });
            }
        });
    }

    // Update selected rate source option
    function updateSelectedRateSource(rateSource) {
        rateSourceOptionElements.forEach(option => {
            const source = option.getAttribute('data-source');
            if (source === rateSource) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });

        // Show/Hide custom input
        if (rateSource === 'custom') {
            customRateInputContainer.style.display = 'flex';
        } else {
            customRateInputContainer.style.display = 'none';
        }
    }



    /**
     * Handle enable/disable toggle
     */
    enableToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.set({ isEnabled }, () => {
            reloadCurrentTab();
        });
    });

    /**
     * Translate Binance UI independently from the KRW conversion toggle.
     */
    binanceKoreanToggle.addEventListener('change', (e) => {
        const binanceKoreanEnabled = e.target.checked;
        chrome.storage.local.set({ binanceKoreanEnabled }, () => {
            reloadCurrentTab();
        });
    });

    krwOrderHelperToggle.addEventListener('change', (e) => {
        const krwOrderHelperEnabled = e.target.checked;
        chrome.storage.local.set({ krwOrderHelperEnabled }, () => {
            reloadCurrentTab();
        });
    });

    /**
     * Handle billion unit toggle
     */
    billionToggle.addEventListener('change', (e) => {
        const showBillionUnit = e.target.checked;
        chrome.storage.local.set({ showBillionUnit }, () => {
            reloadCurrentTab();
        });
    });

    /**
     * Handle trillion unit toggle
     */
    trillionToggle.addEventListener('change', (e) => {
        const showTrillionUnit = e.target.checked;
        chrome.storage.local.set({ showTrillionUnit }, () => {
            reloadCurrentTab();
        });
    });

    /**
     * Handle decimal places selection
     */
    decimalSelect.addEventListener('change', (e) => {
        const decimalPlaces = parseInt(e.target.value);
        chrome.storage.local.set({ decimalPlaces }, () => {
            reloadCurrentTab();
        });
    });

    /**
     * Handle rate source toggle button click
     */
    rateSourceToggle.addEventListener('click', () => {

        const isExpanded = rateSourceOptions.classList.contains('expanded');

        if (isExpanded) {

            rateSourceOptions.classList.remove('expanded');
            rateSourceToggle.classList.remove('active');
        } else {

            rateSourceOptions.classList.add('expanded');
            rateSourceToggle.classList.add('active');
        }
    });

    /**
     * Handle rate source option selection
     */
    rateSourceOptionElements.forEach(option => {
        option.addEventListener('click', () => {
            const rateSource = option.getAttribute('data-source');

            // Update UI immediately
            updateSelectedRateSource(rateSource);

            if (rateSource === 'custom') {
                // For custom, just show input, don't trigger refresh yet unless we have a value
                rateSourceOptions.classList.remove('expanded');
                rateSourceToggle.classList.remove('active');

                // If we already have a value, set it as active
                if (customRateInput.value) {
                    const val = parseFloat(customRateInput.value);
                    chrome.storage.local.set({
                        rateSource,
                        usdkrw: val,
                        lastFetchTime: Date.now(),
                        lastFetchStatus: 'success'
                    });
                } else {
                    // Just set user to custom mode
                    chrome.storage.local.set({ rateSource });
                }
            } else {
                // For APIs, save and refresh
                chrome.storage.local.set({ rateSource, lastFetchTime: 0 }, () => {

                    chrome.runtime.sendMessage({ action: 'refreshRate' });

                    setTimeout(() => {
                        rateSourceOptions.classList.remove('expanded');
                        rateSourceToggle.classList.remove('active');
                    }, 300);
                });
            }
        });
    });

    // Inline error helper to replace alert()
    function showInlineError(inputEl, message) {
        const existing = inputEl.parentElement.querySelector('.inline-error');
        if (existing) existing.remove();

        const err = document.createElement('span');
        err.className = 'inline-error';
        err.style.cssText = 'color:#f87171;font-size:11px;display:block;margin-top:4px;';
        err.textContent = message;
        inputEl.parentElement.appendChild(err);

        // Clear the inline hint after a short delay.
        setTimeout(() => err.remove(), 3000);
    }

    /**
     * Handle Custom Rate Save
     */
    saveCustomRateBtn.addEventListener('click', () => {
        const val = parseFloat(customRateInput.value);
        if (isNaN(val) || val <= 0) {
            showInlineError(customRateInput, '올바른 환율 값을 입력해 주세요.');
            return;
        }

        chrome.storage.local.set({
            rateSource: 'custom',
            customRateValue: val,
            usdkrw: val,
            lastFetchTime: Date.now(),
            lastFetchStatus: 'success'
        }, () => {

            // Feedback
            const originalText = saveCustomRateBtn.textContent;
            saveCustomRateBtn.textContent = '저장 완료';
            setTimeout(() => {
                saveCustomRateBtn.textContent = originalText;
            }, 1500);
        });
    });

    if (updateBannerBtn) {
        updateBannerBtn.addEventListener('click', () => {
            const url = updateBannerBtn.dataset.url;
            if (!url) return;

            chrome.tabs.create({ url });
        });
    }

    /**
     * Helper function to update DOM without full page reload
     */
    function reloadCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                // Send message to content script to reload settings and update DOM
                chrome.tabs.sendMessage(tabs[0].id, { action: 'reloadSettings' }, (response) => {
                    // Ignore errors if content script is not loaded
                    if (chrome.runtime.lastError) {
                        // Content script not loaded, ignore
                    }
                });
            }
        });
    }


    // Update relative time every 10 seconds
    setInterval(() => {
        chrome.storage.local.get(['lastFetchTime'], (result) => {
            lastUpdate.textContent = PopupCore.formatRelativeTime(result.lastFetchTime);
        });
    }, 10000);

    // Update refresh timer every second
    setInterval(() => {
        chrome.storage.local.get(['rateSource', 'lastFetchTime'], (result) => {
            const rateSource = result.rateSource || 'usd_krw';
            updateRefreshTimer(rateSource, result.lastFetchTime);
        });
    }, 1000);

    // Listen for storage changes (rate updates from background)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            // Get current rateSource to format rate correctly
            chrome.storage.local.get(['rateSource'], (result) => {
                const rateSource = result.rateSource || 'usd_krw';

                if (changes.usdkrw) {
                    rateValue.textContent = PopupCore.formatRate(changes.usdkrw.newValue, rateSource);
                }
                if (changes.rateSource) {
                    // Update rate display with new source label
                    chrome.storage.local.get(['usdkrw'], (result) => {
                        rateValue.textContent = PopupCore.formatRate(result.usdkrw || 1300, changes.rateSource.newValue);
                    });
                }
            });

            if (changes.lastFetchStatus) {
                updateStatus(changes.lastFetchStatus.newValue);
            }
            if (changes.lastFetchTime) {
                lastUpdate.textContent = PopupCore.formatRelativeTime(changes.lastFetchTime.newValue);
            }
        }
    });

    /**
     * Calculate and display Kimchi Premium
     * Background script caches standard and Upbit rates in storage.
     * The popup reads those cached values to avoid extra network requests.
     */
    async function updatePremiumInfo() {
        try {
            const storage = await chrome.storage.local.get([
                'standardRate', 'usdkrw', 'rateSource', 'upbitUsdt', 'upbitUsdc'
            ]);

            const standardRate = storage.standardRate;
            const usdkrw = storage.usdkrw;

            if (!standardRate || !usdkrw) return;

            // Prefer cached Upbit prices when available; fall back to usdkrw.
            const upbitUsdt = storage.upbitUsdt;
            const upbitUsdc = storage.upbitUsdc;
            const usdtPrice = upbitUsdt || usdkrw;
            const usdcPrice = upbitUsdc || usdkrw;

            const usdtDescEl = document.querySelector('.rate-source-option[data-source="upbit_usdt"] .option-desc');
            if (usdtDescEl) {
                const premium = PopupCore.calculatePremium(usdtPrice, standardRate);
                const sign = premium >= 0 ? '+' : '';
                usdtDescEl.textContent = `기준 환율 대비 ${sign}${premium.toFixed(2)}% (₩${usdtPrice.toLocaleString()})`;
            }

            const usdcDescEl = document.querySelector('.rate-source-option[data-source="upbit_usdc"] .option-desc');
            if (usdcDescEl) {
                const premium = PopupCore.calculatePremium(usdcPrice, standardRate);
                const sign = premium >= 0 ? '+' : '';
                usdcDescEl.textContent = `기준 환율 대비 ${sign}${premium.toFixed(2)}% (₩${usdcPrice.toLocaleString()})`;
            }

        } catch (e) {
            console.error('Failed to update premium info:', e);
        }
    }

    // ...

    // Initial Data Load
    loadData();
    updatePremiumInfo(); // Call this too
    chrome.runtime.sendMessage({ action: 'checkForUpdates', force: true }, () => {
        loadData();
    });

    // ==================== TABS & COPY LOGIC ====================

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add active to current
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const tabEl = document.getElementById(tabId);
            if (tabEl) {
                tabEl.classList.add('active');
            } else {
                console.error(`Tab content not found for id: ${tabId}`);
            }

            // Load sites list when Sites tab is opened
            if (tabId === 'tab-sites') {
                loadSites();
            }
        });
    });

    // Copy to Clipboard
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSel = btn.getAttribute('data-clipboard-target');
            const targetEl = document.querySelector(targetSel);

            if (targetEl) {
                const text = targetEl.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    // Success Feedback
                    const originalText = btn.textContent;
                    btn.textContent = '복사 완료';
                    btn.style.background = '#4CAF50';
                    btn.style.color = 'white';

                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '';
                        btn.style.color = '';
                    }, 1500);
                }).catch(err => {
                    console.error('Copy failed', err);
                });
            }
        });
    });

    // QR Code Toggle Logic
    document.querySelectorAll('.qr-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-qr-target');
            const targetEl = document.getElementById(targetId);

            if (targetEl) {
                // Toggle display
                if (targetEl.style.display === 'none') {
                    targetEl.style.display = 'flex'; // Use flex to center
                    btn.classList.add('active');
                } else {
                    targetEl.style.display = 'none';
                    btn.classList.remove('active');
                }
            }
        });
    });

    // ==================== SITES MANAGEMENT ====================

    const DEFAULT_SITES = [
        'hyperliquid.xyz',
        'lighter.xyz',
        'binance.com',
        'okx.com',
        'bitget.com',
        'kucoin.com',
        'bingx.com'
    ];

    const sitesList = document.getElementById('sitesList');
    const newSiteInput = document.getElementById('newSiteInput');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const sitesListContainer = document.getElementById('sitesListContainer');
    const modeWhitelist = document.getElementById('mode-whitelist');
    const modeAll = document.getElementById('mode-all');

    /**
     * Load and apply current site mode
     */
    function loadSiteMode() {
        chrome.storage.local.get(['applyToAllSites'], (result) => {
            const applyToAllSites = result.applyToAllSites || false;

            if (applyToAllSites) {
                modeAll.checked = true;
                sitesListContainer.classList.add('disabled');
            } else {
                modeWhitelist.checked = true;
                sitesListContainer.classList.remove('disabled');
            }
        });
    }

    /**
     * Handle site mode change
     */
    function handleModeChange(mode) {
        const applyToAllSites = mode === 'all';

        chrome.storage.local.set({ applyToAllSites }, () => {

            if (applyToAllSites) {
                sitesListContainer.classList.add('disabled');
            } else {
                sitesListContainer.classList.remove('disabled');
            }

            // Reload current tab to apply new site mode
            reloadCurrentTab();
        });
    }

    // Mode change event listeners
    if (modeWhitelist && modeAll) {
        modeWhitelist.addEventListener('change', (e) => {
            if (e.target.checked) {
                handleModeChange('whitelist');
            }
        });

        modeAll.addEventListener('change', (e) => {
            if (e.target.checked) {
                handleModeChange('all');
            }
        });
    }

    // Load current mode on startup
    loadSiteMode();

    /**
     * Render sites list
     */
    function renderSites(enabledSites) {
        if (!sitesList) return;

        // Clear existing content safely
        sitesList.innerHTML = '';

        if (enabledSites.length === 0) {
            sitesList.innerHTML = `
                <div class="empty-sites">
                    <div class="empty-sites-icon">🌐</div>
                    <div class="empty-sites-text">아직 추가된 사이트가 없습니다.</div>
                </div>
            `;
            return;
        }

        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();

        enabledSites.forEach(site => {
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';
            siteItem.dataset.site = site;

            const siteInfo = document.createElement('div');
            siteInfo.className = 'site-info';

            const siteIcon = document.createElement('span');
            siteIcon.className = 'site-icon';

            const siteIconFallback = document.createElement('span');
            siteIconFallback.className = 'site-icon-fallback';
            siteIconFallback.textContent = '🌐';

            const siteFavicon = document.createElement('img');
            siteFavicon.className = 'site-favicon';
            siteFavicon.alt = '';
            siteFavicon.loading = 'lazy';
            siteFavicon.referrerPolicy = 'no-referrer';
            siteFavicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=64`;
            siteFavicon.addEventListener('load', () => {
                siteIcon.classList.add('has-favicon');
            });
            siteFavicon.addEventListener('error', () => {
                siteFavicon.remove();
            });

            siteIcon.appendChild(siteFavicon);
            siteIcon.appendChild(siteIconFallback);

            const siteName = document.createElement('span');
            siteName.className = 'site-name';
            siteName.textContent = site; // Safe: textContent escapes HTML

            siteInfo.appendChild(siteIcon);
            siteInfo.appendChild(siteName);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-site-btn';
            removeBtn.dataset.site = site;
            removeBtn.textContent = 'Remove';

            // Add event listener directly here, no need to querySelectorAll later
            removeBtn.addEventListener('click', () => {
                removeSite(site);
            });

            siteItem.appendChild(siteInfo);
            siteItem.appendChild(removeBtn);

            fragment.appendChild(siteItem);
        });

        sitesList.appendChild(fragment);
    }

    /**
     * Load and display sites
     */
    function loadSites() {
        chrome.storage.local.get(['enabledSites'], (result) => {
            const enabledSites = result.enabledSites || DEFAULT_SITES;
            renderSites(enabledSites);
        });
    }

    /**
     * Add a new site
     */
    function addSite(site) {
        site = PopupCore.validateSite(site);

        if (!site || site.length < 3) {
            showInlineError(newSiteInput, '올바른 사이트 주소를 입력해 주세요.');
            return;
        }

        chrome.storage.local.get(['enabledSites'], (result) => {
            const enabledSites = result.enabledSites || DEFAULT_SITES;

            if (enabledSites.includes(site)) {
                showInlineError(newSiteInput, '이미 추가된 사이트입니다.');
                return;
            }

            enabledSites.push(site);
            chrome.storage.local.set({ enabledSites }, () => {

                renderSites(enabledSites);
                newSiteInput.value = '';
            });
        });
    }

    /**
     * Remove a site
     */
    function removeSite(site) {
        chrome.storage.local.get(['enabledSites'], (result) => {
            let enabledSites = result.enabledSites || DEFAULT_SITES;
            enabledSites = enabledSites.filter(s => s !== site);

            chrome.storage.local.set({ enabledSites }, () => {

                renderSites(enabledSites);
            });
        });
    }

    // Add site button click
    if (addSiteBtn) {
        addSiteBtn.addEventListener('click', () => {
            addSite(newSiteInput.value);
        });
    }

    // Add site on Enter key
    if (newSiteInput) {
        newSiteInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addSite(newSiteInput.value);
            }
        });
    }

    // Initial load if Sites tab is active
    loadSites();

    // ==================== DATA SYNC ====================
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;

        // Core Settings & Rate
        const coreKeys = ['usdkrw', 'customRateValue', 'isEnabled', 'binanceKoreanEnabled', 'krwOrderHelperEnabled', 'showBillionUnit', 'showTrillionUnit', 'decimalPlaces', 'rateSource', 'lastFetchTime', 'lastFetchStatus', 'lastFetchError', 'updateAvailable', 'updateLatestVersion', 'updateDownloadUrl'];
        if (coreKeys.some(key => changes[key])) {
            loadData();
        }

        const premiumKeys = ['usdkrw', 'standardRate', 'upbitUsdt', 'upbitUsdc', 'rateSource'];
        if (premiumKeys.some(key => changes[key])) {
            updatePremiumInfo();
        }
    });

}); // End of DOMContentLoaded
