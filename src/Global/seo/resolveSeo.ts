import routeMeta from "./routeMeta.json";

export type SeoInfo = {
  title: string;
  description: string;
  canonical: string;
  noindex: boolean;
};

const SEASON = /^\d{2}-\d{2}$/;

function isNoindex(path: string): boolean {
  const lower = path.toLowerCase();
  const byPrefix = routeMeta.noindexPrefixes.some(
    (prefix) => lower === prefix || lower.startsWith(prefix + "/")
  );
  const bySuffix = routeMeta.noindexSuffixes.some((suffix) => lower.endsWith(suffix));
  return byPrefix || bySuffix;
}

function withSiteName(title: string): string {
  return title.includes(routeMeta.siteName) ? title : `${title} | ${routeMeta.siteName}`;
}

/**
 * Works out the title, description, canonical link and indexing rule for a URL path. Kept free of
 * React so it can be tested on its own. Anything not recognised is treated as a generic page and
 * left indexable only if it matches a known public page or detail page.
 */
export function resolveSeo(pathname: string): SeoInfo {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const canonical = routeMeta.site + (clean === "/" ? "/" : clean);

  if (isNoindex(clean)) {
    return {
      title: withSiteName("Missouri State Lacrosse"),
      description: routeMeta.defaultDescription,
      canonical,
      noindex: true,
    };
  }

  const segments = clean.split("/").filter(Boolean);
  const base = "/" + (segments[0] ?? "");
  const page = routeMeta.pages.find((p) => p.path === base);

  // A season page such as /roster/25-26 keeps the section's wording and adds the season.
  if (page && segments.length === 2 && SEASON.test(segments[1])) {
    return {
      title: withSiteName(`${page.title} ${segments[1]}`),
      description: page.description,
      canonical,
      noindex: false,
    };
  }

  const exact = routeMeta.pages.find((p) => p.path === clean);
  if (exact) {
    return { title: withSiteName(exact.title), description: exact.description, canonical, noindex: false };
  }

  const detail = routeMeta.detailPages.find((d) => (clean + "/").startsWith(d.prefix));
  if (detail) {
    return {
      title: withSiteName(detail.title),
      description: routeMeta.defaultDescription,
      canonical,
      noindex: false,
    };
  }

  // Unknown URL (the not-found page sets its own robots rule): do not let it be indexed.
  return {
    title: withSiteName("Page not found"),
    description: routeMeta.defaultDescription,
    canonical,
    noindex: true,
  };
}
