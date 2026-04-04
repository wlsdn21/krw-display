/**
 * Centralized logging utility for KRW Master extension
 * Provides consistent logging with context and metadata
 */

"use strict";

class Logger {
    /**
     * Get extension version from manifest
     * @returns {string} Extension version
     */
    static getVersion() {
        try {
            return chrome.runtime.getManifest().version;
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * Create log entry with metadata
     * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
     * @param {string} context - Context/component name
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     * @returns {Object} Log entry
     */
    static createLogEntry(level, context, message, data = {}) {
        return {
            timestamp: new Date().toISOString(),
            level,
            context,
            message,
            data,
            version: this.getVersion()
        };
    }

    /**
     * Log error message
     * @param {string} context - Context/component name (e.g., 'fetchExchangeRate', 'content.js')
     * @param {string} message - Error message
     * @param {Object} data - Additional error data
     */
    static error(context, message, data = {}) {
        const logEntry = this.createLogEntry('ERROR', context, message, data);
        console.error(`[KRW Master]`, logEntry);
    }

    /**
     * Log warning message
     * @param {string} context - Context/component name
     * @param {string} message - Warning message
     * @param {Object} data - Additional data
     */
    static warn(context, message, data = {}) {
        const logEntry = this.createLogEntry('WARN', context, message, data);
        console.warn(`[KRW Master]`, logEntry);
    }

    /**
     * Log info message
     * @param {string} context - Context/component name
     * @param {string} message - Info message
     * @param {Object} data - Additional data
     */
    static info(context, message, data = {}) {
        const logEntry = this.createLogEntry('INFO', context, message, data);
        console.log(`[KRW Master]`, logEntry);
    }

    /**
     * Log debug message (only in development)
     * @param {string} context - Context/component name
     * @param {string} message - Debug message
     * @param {Object} data - Additional data
     */
    static debug(context, message, data = {}) {
        // Only log debug in development (can be controlled via settings later)
        if (typeof DEBUG !== 'undefined' && DEBUG) {
            const logEntry = this.createLogEntry('DEBUG', context, message, data);
            console.log(`[KRW Master]`, logEntry);
        }
    }
}
