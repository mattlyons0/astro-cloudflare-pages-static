// @ts-check
/**
 * HTML escape lookup table for XSS prevention.
 * Shared between worker template and dev server.
 */
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
  '/': '&#x2F;',
  '\\': '&#x5C;',
};

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * @param {string} unsafe - The unsafe string to escape
 * @returns {string} The escaped string
 */
export function escapeHtml(unsafe) {
  return unsafe.replace(/[&<>"'\\/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}
