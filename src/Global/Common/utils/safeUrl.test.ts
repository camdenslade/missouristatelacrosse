import { describe, expect, it } from "vitest";

import { safeHttpUrl, safeImageSrc } from "./safeUrl";

describe("safeHttpUrl", () => {
  it("allows normal web links", () => {
    expect(safeHttpUrl("https://www.instagram.com/p/abc/")).toBe("https://www.instagram.com/p/abc/");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com");
  });

  it("refuses script and other non-web addresses", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("JaVaScRiPt:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeHttpUrl("vbscript:x")).toBeUndefined();
    expect(safeHttpUrl("not a url")).toBeUndefined();
    expect(safeHttpUrl("")).toBeUndefined();
    expect(safeHttpUrl(null)).toBeUndefined();
  });
});

describe("safeImageSrc", () => {
  it("allows previews the browser makes from a chosen file", () => {
    expect(safeImageSrc("blob:https://missouristatelacrosse.com/1234-abcd")).toContain("blob:");
  });

  it("allows embedded images, web addresses and site paths", () => {
    expect(safeImageSrc("data:image/png;base64,AAAA")).toContain("data:image/png");
    expect(safeImageSrc("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    expect(safeImageSrc("/assets/msu.png")).toBe("/assets/msu.png");
  });

  it("refuses anything that could run code or is not an image", () => {
    expect(safeImageSrc("javascript:alert(1)")).toBe("");
    expect(safeImageSrc("data:text/html;base64,AAAA")).toBe("");
    expect(safeImageSrc("//evil.example/a.png")).toBe("");
    expect(safeImageSrc(null)).toBe("");
    expect(safeImageSrc(undefined)).toBe("");
  });
});
