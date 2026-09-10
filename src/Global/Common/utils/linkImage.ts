/**
 * Best-effort favicon/site icon for a card that has a link but no custom image.
 * Returns null for a blank or unparseable link so callers can fall back further.
 */
export function faviconUrl(link?: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    return `https://www.google.com/s2/favicons?sz=64&domain=${url.hostname}`;
  } catch {
    return null;
  }
}
