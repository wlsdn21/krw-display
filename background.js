// Background Script

"use strict";

importScripts('shared.js', 'logger.js');


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

const UPDATE_CHECK_INTERVAL_MINUTES = 360; // 6 hours
const UPDATE_SOURCE = {
    owner: 'wlsdn21',
    repo: 'krw-display',
    branch: 'main'
};

const RATE_FETCH_TIMEOUT_MS = 6_000;
const rateRequests = new Map();
let rateSelectionRevision = 0;

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.rateSource || changes.customRateValue)) {
        rateSelectionRevision++;
        fetchExchangeRate(true);
    }
});

async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RATE_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

const ALARM_NAME = "fetchExchangeRate";
const UPDATE_CHECK_ALARM_NAME = "checkExtensionUpdate";





chrome.runtime.onInstalled.addListener(() => {


    // Set default preferences
    // Check and set default preferences only if they don't exist
    chrome.storage.local.get([
        'isEnabled', 'binanceKoreanEnabled', 'krwOrderHelperEnabled', 'showBillionUnit', 'showTrillionUnit', 'decimalPlaces'
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

        if (result.showTrillionUnit === undefined) {
            updates.showTrillionUnit = true;
            needsUpdate = true;
        }
        if (needsUpdate) chrome.storage.local.set(updates);
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
        fetchExchangeRate(Boolean(request.force)).then(async rate => {
            const state = await chrome.storage.local.get(['lastFetchStatus', 'lastFetchError']);
            sendResponse({ success: state.lastFetchStatus === 'success', rate, error: state.lastFetchError });
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
                rate: KrwCommon.isValidRate(result.usdkrw) ? result.usdkrw : null,
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
        const remoteManifest = await fetchJson(manifestUrl, { cache: 'no-store' });
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

    const data = await fetchJson(MANANA_API);
    // Data format: [{"date":"...","name":"KRWUSD=X","rate":0.000678...,"timestamp":"..."}]
    if (Array.isArray(data) && KrwCommon.isValidRate(data[0]?.rate)) {
        // The API returns KRW/USD rate (approx 0.00067), so we invert it to get USD/KRW
        const rate = 1 / data[0].rate;

        if (!KrwCommon.isValidRate(rate)) throw new Error('Invalid Manana rate data');
        return rate;
    } else {
        throw new Error('Invalid Manana rate data');
    }
}


async function fetchUpbitRate(market) {
    const data = await fetchJson(UPBIT_API, { cache: 'no-store' });
    if (!Array.isArray(data)) throw new Error('Invalid Upbit rate data');
    const ticker = data.find(t => t.market === market);

    if (KrwCommon.isValidRate(ticker?.trade_price)) {
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


            const data = await fetchJson(apiUrl);
            const rate = data?.rates?.KRW;

            if (KrwCommon.isValidRate(rate)) {


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



async function fetchExchangeRate(force = false) {
    const revision = rateSelectionRevision;
    const storage = await chrome.storage.local.get([
        'rateSource', 'currentApiIndex', 'usdkrw', 'lastFetchTime', 'lastFetchStatus',
        'lastFetchSource', 'lastFetchAttemptTime', 'customRateValue', 'standardRate', 'lastStandardFetch'
    ]);
    const rateSource = Object.values(RATE_SOURCE).includes(storage.rateSource)
        ? storage.rateSource : RATE_SOURCE.USD_KRW;
    const key = `${revision}:${rateSource}:${storage.customRateValue}`;
    if (rateRequests.has(key)) return rateRequests.get(key);

    const request = refreshSelectedRate(storage, rateSource, revision, force);
    rateRequests.set(key, request);
    try {
        return await request;
    } finally {
        rateRequests.delete(key);
    }
}

async function refreshSelectedRate(storage, rateSource, revision, force) {
    const lastSource = storage.lastFetchSource || rateSource;
    const cachedRate = KrwCommon.isValidRate(storage.usdkrw) ? storage.usdkrw : null;
    const lastAttempt = storage.lastFetchAttemptTime || storage.lastFetchTime || 0;
    if (!force && rateSource === RATE_SOURCE.CUSTOM && lastSource === rateSource &&
        cachedRate === storage.customRateValue && storage.lastFetchStatus === 'success') return cachedRate;
    // Alarms may arrive slightly before the previous request's stored start time.
    if (!force && storage.lastFetchStatus !== 'loading' && cachedRate && lastSource === rateSource && Date.now() - lastAttempt < KrwCommon.REFRESH_INTERVAL_MS - 1000) {
        return cachedRate;
    }

    // A response for a previously selected source must never replace a newer selection.
    const publish = async updates => {
        const current = await chrome.storage.local.get(['rateSource', 'customRateValue']);
        if (revision !== rateSelectionRevision || (current.rateSource || RATE_SOURCE.USD_KRW) !== rateSource) return false;
        if (rateSource === RATE_SOURCE.CUSTOM && current.customRateValue !== storage.customRateValue) return false;
        await chrome.storage.local.set(updates);
        return true;
    };

    if (!await publish({
        lastFetchStatus: 'loading',
        lastFetchAttemptTime: Date.now(),
        lastFetchSource: cachedRate ? lastSource : null,
        lastFetchError: null
    })) return cachedRate;

    try {
        let rate;
        const updates = {};
        switch (rateSource) {
            case RATE_SOURCE.CUSTOM:
                rate = storage.customRateValue;
                break;
            case RATE_SOURCE.UPBIT_USDT:
                rate = await fetchUpbitRate('KRW-USDT');
                updates.upbitUsdt = rate;
                break;
            case RATE_SOURCE.UPBIT_USDC:
                rate = await fetchUpbitRate('KRW-USDC');
                updates.upbitUsdc = rate;
                break;
            default:
                try {
                    rate = await fetchMananaRate();
                } catch (error) {
                    Logger.warn('fetchExchangeRate', 'Manana API failed, trying the configured fallback APIs', { error: error.message });
                    rate = await fetchUsdKrwRate(storage.currentApiIndex || 0);
                }
                updates.standardRate = rate;
                updates.lastStandardFetch = Date.now();
        }
        if (!KrwCommon.isValidRate(rate)) throw new Error('Invalid exchange rate');
        const published = await publish({
            ...updates,
            usdkrw: rate,
            lastFetchTime: Date.now(),
            lastFetchSource: rateSource,
            lastFetchStatus: 'success',
            lastFetchError: null
        });
        if (published && rateSource.startsWith('upbit_') &&
            (!storage.standardRate || Date.now() - (storage.lastStandardFetch || 0) > 3_600_000)) {
            // Premium data is optional and must not delay the selected exchange rate.
            fetchMananaRate().then(standardRate => chrome.storage.local.set({
                standardRate, lastStandardFetch: Date.now()
            })).catch(error => Logger.warn('standardRate', 'Could not update premium reference', { error: error.message }));
        }
        return published ? rate : cachedRate;
    } catch (error) {
        Logger.warn('fetchExchangeRate', 'Could not refresh the selected exchange rate', { rateSource, error: error.message });
        // Keep the last successful quote and its timestamp/source. An error is not a fresh quote.
        await publish({ lastFetchStatus: 'failed', lastFetchError: error.message });
        return cachedRate;
    }
}
