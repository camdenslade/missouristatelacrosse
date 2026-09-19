import { lazy } from "react";
import type { ComponentType } from "react";

const RELOAD_KEY = "lazyPageReloadedAt";
const RELOAD_COOLDOWN_MS = 15000;

/**
 * Loads a page's code only when someone visits it, instead of shipping the whole site up front.
 *
 * If the download fails, the usual cause is a deploy that happened while the tab was open: the old
 * page asks for a file the new deploy replaced. Reloading once fetches the current version. The
 * cooldown stops a real outage from turning into a reload loop.
 */
export function lazyPage<P>(load: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(async () => {
    try {
      return await load();
    } catch (err) {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        // Never settles: the page is about to be replaced.
        return new Promise<never>(() => {});
      }
      throw err;
    }
  });
}
