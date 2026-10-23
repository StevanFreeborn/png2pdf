import { describe, expect, it } from "vitest";
import {
  PAGE_SIZES,
  calculatePageLayout,
  isPageSize,
} from "../src/lib/layout.js";

describe("calculatePageLayout", () => {
  it("creates a fit page from pixel dimensions at 96 DPI", () => {
    const layout = calculatePageLayout({
      pixelWidth: 960,
      pixelHeight: 720,
    });

    expect(layout.pageWidth).toBeCloseTo(720);
    expect(layout.pageHeight).toBeCloseTo(540);
    expect(layout.imageX).toBe(0);
    expect(layout.imageY).toBe(0);
    expect(layout.imageWidth).toBeCloseTo(720);
    expect(layout.imageHeight).toBeCloseTo(540);
  });

  it("converts DPI and applies margins to fit pages", () => {
    const layout = calculatePageLayout({
      pixelWidth: 960,
      pixelHeight: 720,
      dpi: 192,
      margin: 18,
    });

    expect(layout.pageWidth).toBeCloseTo(396);
    expect(layout.pageHeight).toBeCloseTo(306);
    expect(layout.imageX).toBe(18);
    expect(layout.imageY).toBe(18);
    expect(layout.imageWidth).toBeCloseTo(360);
    expect(layout.imageHeight).toBeCloseTo(270);
  });

  it("fits landscape images onto landscape A4 paper and centers them", () => {
    const layout = calculatePageLayout({
      pixelWidth: 1920,
      pixelHeight: 1080,
      pageSize: "a4",
      margin: 20,
    });

    expect(layout.pageWidth).toBeCloseTo(841.89);
    expect(layout.pageHeight).toBeCloseTo(595.28);
    expect(layout.imageWidth / layout.imageHeight).toBeCloseTo(16 / 9);
    expect(layout.imageX).toBeCloseTo(
      (layout.pageWidth - layout.imageWidth) / 2,
    );
    expect(layout.imageY).toBeCloseTo(
      (layout.pageHeight - layout.imageHeight) / 2,
    );
    expect(layout.imageX).toBeGreaterThanOrEqual(20);
    expect(layout.imageY).toBeGreaterThanOrEqual(20);
  });

  it("keeps square images on portrait Letter paper", () => {
    const layout = calculatePageLayout({
      pixelWidth: 500,
      pixelHeight: 500,
      pageSize: "letter",
    });

    expect(layout.pageWidth).toBeCloseTo(612);
    expect(layout.pageHeight).toBeCloseTo(792);
    expect(layout.imageWidth).toBeCloseTo(612);
    expect(layout.imageHeight).toBeCloseTo(612);
    expect(layout.imageX).toBeCloseTo(0);
    expect(layout.imageY).toBeCloseTo(90);
  });

  it("rejects margins that leave no room on fixed paper", () => {
    expect(() =>
      calculatePageLayout({
        pixelWidth: 100,
        pixelHeight: 100,
        pageSize: "a4",
        margin: 300,
      }),
    ).toThrow(/too large/i);
  });

  it("rejects invalid dimensions, DPI, and margins", () => {
    expect(() =>
      calculatePageLayout({ pixelWidth: 0, pixelHeight: 100 }),
    ).toThrow(/width/i);

    expect(() =>
      calculatePageLayout({ pixelWidth: 100, pixelHeight: 100, dpi: 0 }),
    ).toThrow(/dpi/i);

    expect(() =>
      calculatePageLayout({ pixelWidth: 100, pixelHeight: 100, margin: -1 }),
    ).toThrow(/margin/i);
  });
});

describe("page size helpers", () => {
  it("exposes the supported page sizes", () => {
    expect(PAGE_SIZES).toEqual(["fit", "a4", "letter"]);
    expect(isPageSize("fit")).toBe(true);
    expect(isPageSize("a4")).toBe(true);
    expect(isPageSize("letter")).toBe(true);
    expect(isPageSize("legal")).toBe(false);
  });
});
