/**
 * utils.js
 * Shared utility functions for formatting and parsing data.
 */

/**
 * Parses a string or number, removing commas, and returns a valid Number.
 * Returns 0 if the resulting value is not a valid number.
 * @param {string|number} val - The value to parse.
 * @returns {number} The parsed numeric value or 0.
 */
export function parseFormattedNumber(val) {
    if (val === undefined || val === null) return 0;
    const parsed = Number(String(val).replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats a number to a localized string representation with commas.
 * @param {number|string} val - The numeric value to format.
 * @returns {string} The comma-formatted string.
 */
export function formatNumber(val) {
    const num = parseFormattedNumber(val);
    return num.toLocaleString('en-US');
}
