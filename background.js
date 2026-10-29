// Background Script

"use strict";

importScripts('logger.js');


const FX_APIS = [
    "https://open.er-api.com/v6/latest/USD",
    "https://api.exchangerate-api.com/v4/latest/USD",
    "https://api.exchangerate.host/latest?base=USD"
];

const UPBIT_API = "https://api.upbit.com/v1/ticker?markets=KRW-USDT,KRW-USDC";

const RATE_SOURCE = {
    USD_KRW: 'usd_krw',
    UPBIT_USDT: 'upbit_usdt',
    UPBIT_USDC: 'upbit_usdc',
    CUSTOM: 'custom'
};

const DEFAULT_RATE = 1300;
const UPDATE_CHECK_INTERVAL_MINUTES = 360; // 6 hours
const UPDATE_SOURCE = {
    owner: 'wlsdn21',
    repo: 'krw-display',
    branch: 'main'
};

// Different refresh intervals for different rate sources
const REFRESH_INTERVALS = {
    USD_KRW: 30 * 1000,           // 30 seconds
    UPBIT_USDT: 30 * 1000,         // 30 seconds
    UPBIT_USDC: 30 * 1000,          // 30 seconds
    CUSTOM: 0                      // No auto refresh for custom
};


const ALARM_NAME = "fetchExchangeRate";
const UPDATE_CHECK_ALARM_NAME = "checkExtensionUpdate";





chrome.runtime.onInstalled.addListener(() => {


    // Set default preferences
    // Check and set default preferences only if they don't exist
    chrome.storage.local.get([
        'isEnabled', 'binanceKoreanEnabled', 'krwOrderHelperEnabled', 'showBillionUnit', 'decimalPlaces', 'rateSource', 'usdkrw', 'lastFetchTime'
    ], (result) => {
        const updates = {};
        let needsUpdate = false;

        if (result.isEnabled === undefined) {
            updates.isEnabled = true;
            needsUpdate = true;
        }
        if (result.binanceKoreanEnabled === undefined) {
            updates.binanceKoreanEnabled = true;
            needsUpdate = true;
        }
        if (result.krwOrderHelperEnabled === undefined) {
            updates.krwOrderHelperEnabled = true;
            needsUpdate = true;
        }
        if (result.showBillionUnit === undefined) {
            updates.showBillionUnit = true;
            needsUpdate = true;
        }
        if (result.decimalPlaces === undefined) {
            updates.decimalPlaces = 2;
            needsUpdate = true;
        }

        // Initialize optional values if needed

        if (result.lastFetchTime === undefined) {
            // Optional: reset if missing, but better to leave it alone or set 0 to force fetch just once
            // updates.lastFetchTime = 0; 
            // needsUpdate = true;
        }

        if (needsUpdate) {

            chrome.storage.local.set(updates);
        } else {

        }
    });

    // Fetch rate immediately
    fetchExchangeRate();
    checkForExtensionUpdate();

    // Set up periodic alarm (1 minute interval, actual rate limiting is in fetchExchangeRate)
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1.0 });
    chrome.alarms.create(UPDATE_CHECK_ALARM_NAME, { periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES });
});


chrome.runtime.onStartup.addListener(() => {

    // Fetch rate immediately
    fetchExchangeRate();
    checkForExtensionUpdate();

    // Ensure alarm is set (1 minute interval)
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1.0 });
    chrome.alarms.create(UPDATE_CHECK_ALARM_NAME, { periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES });
});

/**
 * Handle alarm for periodic rate updates
 */
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        fetchExchangeRate();
    } else if (alarm.name === UPDATE_CHECK_ALARM_NAME) {
        checkForExtensionUpdate();
    }
});

/**
 * Handle manual refresh requests from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getAkp153KrwUsdtRate") {
        fetchUpbitRate('KRW-USDT').then(rate => {
            if (!Number.isFinite(rate) || rate < 500 || rate > 2500) {
                throw new Error('Invalid KRW-USDT rate');
            }
            sendResponse({
                success: true,
                quote: {
                    schema: 1,
                    pair: 'KRW-USDT',
                    krwPerUsdt: rate,
                    fetchedAt: Date.now(),
                    source: 'upbit_usdt_ticker'
                }
            });
        }).catch(() => {
            sendResponse({ success: false });
        });
        return true;
    }

    if (request.action === "refreshRate") {
        fetchExchangeRate().then(rate => {
            sendResponse({ success: true, rate });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep channel open for async response
    }

    if (request.action === "getStatus") {
        chrome.storage.local.get([
            'usdkrw', 'lastFetchTime', 'lastFetchStatus', 'standardRate'
        ], (result) => {
            sendResponse({
                rate: result.usdkrw || DEFAULT_RATE,
                lastUpdate: result.lastFetchTime,
                status: result.lastFetchStatus || 'unknown',
                // ✅ popup의 김치 프리미엄 계산에 필요한 standardRate 포함
                standardRate: result.standardRate || null
            });
        });
        return true;
    }

    if (request.action === "checkForUpdates") {
        checkForExtensionUpdate(Boolean(request.force)).then((result) => {
            sendResponse({ success: true, ...result });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

});



const MANANA_API = "https://api.manana.kr/exchange/rate.json?base=USD&code=KRW";

function getUpdateUrls() {
    const { owner, repo, branch } = UPDATE_SOURCE;
    return {
        manifestUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/manifest.json`,
        repoUrl: `https://github.com/${owner}/${repo}`,
        downloadUrl: `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`
    };
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

function getStoredUpdateState(storage, currentVersion) {
    const storedLatestVersion = storage.updateLatestVersion
        ? normalizeVersion(storage.updateLatestVersion)
        : null;
    const hasStoredUpdate = storedLatestVersion
        ? compareVersions(storedLatestVersion, currentVersion) > 0
        : false;

    return {
        hasStoredUpdate,
        storedLatestVersion: hasStoredUpdate ? storedLatestVersion : null
    };
}

async function checkForExtensionUpdate(force = false) {
    const storage = await chrome.storage.local.get([
        'updateLastCheckedAt',
        'updateLatestVersion',
        'updateAvailable',
        'updateDownloadUrl',
        'updateRepoUrl'
    ]);

    const now = Date.now();
    const lastCheckedAt = storage.updateLastCheckedAt || 0;
    const minimumInterval = UPDATE_CHECK_INTERVAL_MINUTES * 60 * 1000;
    const currentVersion = chrome.runtime.getManifest().version;
    const { hasStoredUpdate, storedLatestVersion } = getStoredUpdateState(storage, currentVersion);

    if (!force && lastCheckedAt > 0 && now - lastCheckedAt < minimumInterval) {
        if (!hasStoredUpdate && (storage.updateAvailable || storage.updateLatestVersion || storage.updateDownloadUrl || storage.updateRepoUrl)) {
            await chrome.storage.local.set({
                updateAvailable: false,
                updateLatestVersion: null,
                updateDownloadUrl: null,
                updateRepoUrl: null
            });
        }

        return {
            hasUpdate: hasStoredUpdate,
            latestVersion: storedLatestVersion
        };
    }

    const { manifestUrl, repoUrl, downloadUrl } = getUpdateUrls();

    try {
        const response = await fetch(manifestUrl, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const remoteManifest = await response.json();
        const latestVersion = normalizeVersion(remoteManifest.version);
        const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

        await chrome.storage.local.set({
            updateAvailable: hasUpdate,
            updateLatestVersion: hasUpdate ? latestVersion : null,
            updateRepoUrl: hasUpdate ? repoUrl : null,
            updateDownloadUrl: hasUpdate ? downloadUrl : null,
            updateLastCheckedAt: now,
            updateCheckError: null
        });

        return {
            hasUpdate,
            latestVersion: hasUpdate ? latestVersion : null
        };
    } catch (error) {
        Logger.warn('checkForExtensionUpdate', 'Failed to check latest extension version', {
            error: error.message,
            manifestUrl
        });

        const updates = {
            updateLastCheckedAt: now,
            updateCheckError: error.message
        };

        if (!hasStoredUpdate) {
            updates.updateAvailable = false;
            updates.updateLatestVersion = null;
            updates.updateDownloadUrl = null;
            updates.updateRepoUrl = null;
        }

        await chrome.storage.local.set(updates);

        return {
            hasUpdate: hasStoredUpdate,
            latestVersion: storedLatestVersion
        };
    }
}


async function fetchMananaRate() {

    const response = await fetch(MANANA_API);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    // Data format: [{"date":"...","name":"KRWUSD=X","rate":0.000678...,"timestamp":"..."}]
    if (Array.isArray(data) && data.length > 0 && data[0].rate) {
        // The API returns KRW/USD rate (approx 0.00067), so we invert it to get USD/KRW
        const rate = 1 / data[0].rate;

        return rate;
    } else {
        throw new Error('Invalid Manana rate data');
    }
}


async function fetchUpbitRate(market) {
    const response = await fetch(UPBIT_API, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const ticker = data.find(t => t.market === market);

    if (ticker && ticker.trade_price && typeof ticker.trade_price === 'number' && ticker.trade_price > 0) {
        return ticker.trade_price;
    } else {
        throw new Error('Invalid Upbit rate data');
    }
}


async function fetchUsdKrwRate(startIndex = 0) {
    // Try all APIs starting from last successful one
    for (let i = 0; i < FX_APIS.length; i++) {
        const apiIndex = (startIndex + i) % FX_APIS.length;
        const apiUrl = FX_APIS[apiIndex];

        try {


            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const rate = data?.rates?.KRW;

            if (rate && typeof rate === 'number' && rate > 0) {


                await chrome.storage.local.set({
                    currentApiIndex: apiIndex
                });

                return rate;
            } else {
                throw new Error('Invalid rate data');
            }
        } catch (error) {
            Logger.error('fetchUsdKrwRate', `API ${apiIndex + 1} failed`, {
                apiUrl: FX_APIS[apiIndex],
                error: error.message
            });
            // Continue to next API
        }
    }

    throw new Error('All USD/KRW APIs failed');
}



async function fetchExchangeRate() {


    const storage = await chrome.storage.local.get([
        'rateSource',
        'currentApiIndex',
        'usdkrw',
        'lastFetchTime',
        'customRateValue',
        'standardRate',
        'lastStandardFetch'
    ]);
    const rateSource = storage.rateSource || RATE_SOURCE.USD_KRW;
    const startIndex = storage.currentApiIndex || 0;
    const lastFetchTime = storage.lastFetchTime || 0;

    // Check if enough time has passed based on rate source
    // Skip time check if this is the first fetch (lastFetchTime is 0 or undefined)
    const refreshInterval = REFRESH_INTERVALS[rateSource] || REFRESH_INTERVALS.USD_KRW;
    const timeSinceLastFetch = Date.now() - lastFetchTime;

    if (lastFetchTime > 0 && timeSinceLastFetch < refreshInterval) {
        const remainingTime = Math.ceil((refreshInterval - timeSinceLastFetch) / 1000 / 60);

        return storage.usdkrw || DEFAULT_RATE;
    }

    try {
        let rate;
        let sourceLabel;
        let standardRate = storage.standardRate; // Existing standard rate

        // Helper to fetch standard rate if needed
        const updateStandardRate = async () => {
            try {
                const sRate = await fetchMananaRate();
                standardRate = sRate;
                await chrome.storage.local.set({ standardRate: sRate, lastStandardFetch: Date.now() });

            } catch (e) {
                Logger.warn('updateStandardRate', 'Failed to update standard rate', {
                    error: e.message
                });
            }
        };

        // If standard rate is missing or old (>1 hour), force update it (asynchronously)
        if (!standardRate || (Date.now() - (storage.lastStandardFetch || 0) > 60 * 60 * 1000)) {
            updateStandardRate();
        }

        switch (rateSource) {
            case RATE_SOURCE.CUSTOM:

                rate = storage.customRateValue || DEFAULT_RATE;
                sourceLabel = 'Custom Value';
                // Custom rate doesn't need API fetch
                break;

            case RATE_SOURCE.UPBIT_USDT:

                rate = await fetchUpbitRate('KRW-USDT');
                sourceLabel = 'Upbit USDT';
                // Also update standard rate if we can, to show accurate premium
                if (!standardRate) await updateStandardRate();
                // ✅ 실시간 업비트 시세를 storage에 캐시 → popup이 fetch 없이 읽음
                await chrome.storage.local.set({ upbitUsdt: rate });
                break;

            case RATE_SOURCE.UPBIT_USDC:

                rate = await fetchUpbitRate('KRW-USDC');
                sourceLabel = 'Upbit USDC';
                if (!standardRate) await updateStandardRate();
                // ✅ 실시간 업비트 시세를 storage에 캐시 → popup이 fetch 없이 읽음
                await chrome.storage.local.set({ upbitUsdc: rate });
                break;

            case RATE_SOURCE.USD_KRW:
            default:


                // Try Manana (Real-time) first
                try {
                    rate = await fetchMananaRate();
                    sourceLabel = 'USD/KRW (Real-time)';
                    // This IS the standard rate
                    standardRate = rate;
                    await chrome.storage.local.set({ standardRate: rate, lastStandardFetch: Date.now() });
                } catch (e) {
                    Logger.warn('fetchExchangeRate', 'Manana API failed, falling back to standard APIs', {
                        error: e.message,
                        fallbackApis: FX_APIS
                    });
                    // Fallback to standard APIs
                    rate = await fetchUsdKrwRate(startIndex);
                    sourceLabel = 'USD/KRW (Standard)';
                    standardRate = rate;
                    await chrome.storage.local.set({ standardRate: rate, lastStandardFetch: Date.now() });
                }
                break;
        }

        await chrome.storage.local.set({
            usdkrw: rate,
            lastFetchTime: Date.now(),
            lastFetchStatus: 'success'
        });

        return rate;


    } catch (error) {
        Logger.error('fetchExchangeRate', `Failed to fetch rate for ${rateSource}`, {
            rateSource,
            error: error.message,
            lastFetchTime: storage.lastFetchTime
        });

        // Fallback strategy
        if (rateSource !== RATE_SOURCE.USD_KRW) {
            Logger.warn('fetchExchangeRate', 'Upbit API failed, trying USD/KRW fallback', {
                originalRateSource: rateSource
            });

            try {
                const rate = await fetchUsdKrwRate(startIndex);


                await chrome.storage.local.set({
                    usdkrw: rate,
                    lastFetchTime: Date.now(),
                    lastFetchStatus: 'success',
                    lastFetchError: null  // Clear error on success
                });

                return rate;
            } catch (fallbackError) {
                Logger.error('fetchExchangeRate', 'Fallback to USD/KRW also failed', {
                    originalRateSource: rateSource,
                    fallbackError: fallbackError.message
                });
            }
        }

        // Ultimate fallback - use cached or default rate
        const fallbackRate = storage.usdkrw || DEFAULT_RATE;
        Logger.error('fetchExchangeRate', 'All APIs failed, using fallback rate', {
            fallbackType: storage.usdkrw ? 'cached' : 'default',
            fallbackRate,
            originalError: error.message
        });

        await chrome.storage.local.set({
            lastFetchTime: Date.now(),
            lastFetchStatus: 'failed',
            lastFetchError: error.message  // Save error message
        });

        return fallbackRate;
    }
}
