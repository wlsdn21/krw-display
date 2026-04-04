/**
 * KRW Master Popup Core Logic
 * Separated from UI for better maintainability and testing
 */

"use strict";

const PopupCore = {
    /**
     * Format exchange rate with symbol and source label
     */
    formatRate(rate, rateSource = 'usd_krw') {
        const formatted = `₩${rate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // Add source label
        let suffix = '';
        if (rateSource === 'upbit_usdt') {
            suffix = ' / USDT';
        } else if (rateSource === 'upbit_usdc') {
            suffix = ' / USDC';
        } else if (rateSource === 'custom') {
            suffix = ' (사용자 지정)';
        } else {
            suffix = ' / USD';
        }

        return formatted + suffix;
    },

    /**
     * Format relative time string (e.g., "5 minutes ago")
     */
    formatRelativeTime(timestamp) {
        if (!timestamp) return '미확인';

        const now = Date.now();
        const diff = now - timestamp;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (seconds < 60) {
            return '방금 전 갱신';
        } else if (minutes < 60) {
            return `${minutes}분 전 갱신`;
        } else if (hours < 24) {
            return `${hours}시간 전 갱신`;
        } else {
            return new Date(timestamp).toLocaleDateString();
        }
    },

    /**
     * Calculate refresh timer text
     */
    getRefreshTimerText(rateSource, lastFetchTime) {
        if (rateSource === 'custom') {
            return '수동 설정 모드';
        }

        const REFRESH_INTERVALS = {
            usd_krw: 30 * 1000,
            upbit_usdt: 30 * 1000,
            upbit_usdc: 30 * 1000
        };

        const refreshInterval = REFRESH_INTERVALS[rateSource] || REFRESH_INTERVALS.usd_krw;
        const timeSinceLastFetch = Date.now() - (lastFetchTime || 0);
        const timeUntilNext = Math.max(0, refreshInterval - timeSinceLastFetch);

        if (timeUntilNext === 0) {
            return '갱신 중...';
        }

        const minutes = Math.floor(timeUntilNext / 60000);
        const seconds = Math.floor((timeUntilNext % 60000) / 1000);

        if (minutes > 0) {
            return `${minutes}분 ${seconds}초 후 자동 갱신`;
        } else {
            return `${seconds}초 후 자동 갱신`;
        }
    },

    /**
     * Calculate premium percentage
     */
    calculatePremium(tradePrice, standardRate) {
        if (!standardRate || standardRate <= 0) return null;
        return ((tradePrice - standardRate) / standardRate) * 100;
    },

    /**
     * Clean and validate site URL
     */
    validateSite(site) {
        if (!site) return null;

        // Clean input
        site = site.trim();

        // Try to parse as URL using URL API
        try {
            // Add protocol if missing
            let url = site;
            if (!url.match(/^https?:\/\//)) {
                url = 'https://' + url;
            }

            // Parse URL to extract hostname
            const urlObj = new URL(url);
            site = urlObj.hostname;

            // Remove www. prefix
            site = site.replace(/^www\./, '');

        } catch (e) {
            // If URL parsing fails, fall back to regex cleaning
            site = site.toLowerCase();
            site = site.replace(/^https?:\/\//, '');
            site = site.replace(/^www\./, '');
            site = site.replace(/\/.*$/, '');
            site = site.replace(/\?.*$/, '');
            site = site.replace(/#.*$/, '');
        }

        // Final cleanup
        return site.toLowerCase().trim();
    }
};
