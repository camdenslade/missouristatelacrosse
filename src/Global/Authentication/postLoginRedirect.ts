// Remembers the protected page a signed-out visitor tried to open (a shared order form link,
// for example) so signing in can take them straight back to it.
const KEY = "postLoginRedirect";

export function rememberPostLoginRedirect(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Storage unavailable (private mode); they just land on the home page instead.
  }
}

export function takePostLoginRedirect(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && path.startsWith("/") ? path : null;
  } catch {
    return null;
  }
}
