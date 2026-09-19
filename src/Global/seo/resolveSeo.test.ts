import { describe, expect, it } from "vitest";

import { resolveSeo } from "./resolveSeo";

describe("resolveSeo", () => {
  it("gives the home page the full site title and indexes it", () => {
    const seo = resolveSeo("/");
    expect(seo.noindex).toBe(false);
    expect(seo.canonical).toBe("https://missouristatelacrosse.com/");
    expect(seo.title).toContain("Missouri State Lacrosse");
    expect(seo.description.length).toBeGreaterThan(50);
  });

  it("titles public sections and appends the site name once", () => {
    const seo = resolveSeo("/schedule");
    expect(seo.title).toBe("Schedule and Results | Missouri State Lacrosse");
    expect(seo.noindex).toBe(false);
  });

  it("adds the season to season pages and keeps them indexable", () => {
    const seo = resolveSeo("/roster/25-26");
    expect(seo.title).toBe("Roster 25-26 | Missouri State Lacrosse");
    expect(seo.canonical).toBe("https://missouristatelacrosse.com/roster/25-26");
    expect(seo.noindex).toBe(false);
  });

  it("ignores a trailing slash in the canonical link", () => {
    expect(resolveSeo("/donate/").canonical).toBe("https://missouristatelacrosse.com/donate");
  });

  it("titles detail pages generically", () => {
    expect(resolveSeo("/raffles/spring-raffle").title).toBe("Raffle | Missouri State Lacrosse");
    expect(resolveSeo("/event-signup/some-event").noindex).toBe(false);
  });

  it("never indexes the women's site, at any depth", () => {
    for (const path of ["/women", "/women/", "/women/roster/25-26", "/women/store"]) {
      expect(resolveSeo(path).noindex).toBe(true);
    }
  });

  it("never indexes private, account or payment pages", () => {
    for (const path of [
      "/manage",
      "/portal",
      "/payments",
      "/settings",
      "/admin",
      "/checkout",
      "/checkout-success",
      "/set-password",
      "/reset-password",
      "/alumni-budget",
      "/recruitment/submissions",
      "/donate/success",
      "/fundraiser/some-campaign/success",
    ]) {
      expect(resolveSeo(path).noindex, path).toBe(true);
    }
  });

  it("does not treat a similarly named public page as private", () => {
    expect(resolveSeo("/recruitment").noindex).toBe(false);
    expect(resolveSeo("/store").noindex).toBe(false);
  });

  it("does not index unknown URLs", () => {
    expect(resolveSeo("/definitely-not-a-page").noindex).toBe(true);
  });
});
