const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:"]);
const SAFE_IMAGE_DATA = /^data:image\/(png|jpe?g|gif|webp|avif);/i;

/**
 * Returns the address only if it is a normal web link. Anything else (for example a
 * "javascript:" address that ended up in stored data) becomes undefined, so it can never be put in
 * an href and run when clicked.
 */
export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the address only if it is something an image tag should show: a preview the browser made
 * from a chosen file (blob:), an embedded image, a web address, or a path on this site. Anything
 * else becomes an empty string, which shows no image.
 */
export function safeImageSrc(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("blob:") || SAFE_IMAGE_DATA.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return safeHttpUrl(value) ?? "";
}
