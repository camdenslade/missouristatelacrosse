// Writes public/sitemap.xml from the same page list the site uses for its titles
// (src/Global/seo/routeMeta.json), so the two cannot drift apart. Runs before every build.
// Private pages and the women's site are not in the list, so they are never in the sitemap.
import { readFileSync, writeFileSync } from "node:fs";

const meta = JSON.parse(readFileSync(new URL("../src/Global/seo/routeMeta.json", import.meta.url), "utf8"));

const entries = meta.pages
  .map((page) => {
    const loc = meta.site + (page.path === "/" ? "/" : page.path);
    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <changefreq>${page.changefreq}</changefreq>`,
      `    <priority>${page.priority}</priority>`,
      "  </url>",
    ].join("\n");
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
writeFileSync(new URL("../public/sitemap.xml", import.meta.url), xml);
process.stdout.write(`sitemap.xml written with ${meta.pages.length} pages`+String.fromCharCode(10));
