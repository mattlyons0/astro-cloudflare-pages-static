/**
 * HTML escape lookup table for XSS prevention.
 */
export const HTML_ESCAPE_MAP: Record<string, string>;

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * @param unsafe - The unsafe string to escape
 * @returns The escaped string
 */
export function escapeHtml(unsafe: string): string;
