import { Png2PdfError } from "./errors.js";

export const PAGE_SIZES = ["fit", "a4", "letter"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export type PageLayoutOptions = {
  pixelWidth: number;
  pixelHeight: number;
  dpi?: number;
  pageSize?: PageSize;
  margin?: number;
};

export type PageLayout = {
  pageWidth: number;
  pageHeight: number;
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
};

const POINTS_PER_INCH = 72;
const DEFAULT_DPI = 96;
const PAPER_DIMENSIONS = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
} as const satisfies Record<
  Exclude<PageSize, "fit">,
  { width: number; height: number }
>;

export function isPageSize(value: string): value is PageSize {
  return (PAGE_SIZES as readonly string[]).includes(value);
}

export function calculatePageLayout(options: PageLayoutOptions): PageLayout {
  const {
    pixelWidth,
    pixelHeight,
    dpi = DEFAULT_DPI,
    pageSize = "fit",
    margin = 0,
  } = options;

  assertPositiveFinite(pixelWidth, "Image width");
  assertPositiveFinite(pixelHeight, "Image height");
  assertPositiveFinite(dpi, "DPI");
  assertNonNegativeFinite(margin, "Margin");

  const imageWidth = pixelsToPoints(pixelWidth, dpi);
  const imageHeight = pixelsToPoints(pixelHeight, dpi);

  if (pageSize === "fit") {
    return {
      pageWidth: imageWidth + margin * 2,
      pageHeight: imageHeight + margin * 2,
      imageX: margin,
      imageY: margin,
      imageWidth,
      imageHeight,
    };
  }

  const paper = PAPER_DIMENSIONS[pageSize];
  const landscape = imageWidth > imageHeight;
  const pageWidth = landscape ? paper.height : paper.width;
  const pageHeight = landscape ? paper.width : paper.height;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;

  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Png2PdfError(
      `Margin ${margin} pt is too large for ${pageSize.toUpperCase()} paper.`,
    );
  }

  const scale = Math.min(
    availableWidth / imageWidth,
    availableHeight / imageHeight,
  );
  const drawnWidth = imageWidth * scale;
  const drawnHeight = imageHeight * scale;

  return {
    pageWidth,
    pageHeight,
    imageX: (pageWidth - drawnWidth) / 2,
    imageY: (pageHeight - drawnHeight) / 2,
    imageWidth: drawnWidth,
    imageHeight: drawnHeight,
  };
}

function pixelsToPoints(pixels: number, dpi: number): number {
  return (pixels / dpi) * POINTS_PER_INCH;
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Png2PdfError(`${label} must be a positive number.`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Png2PdfError(`${label} must be zero or greater.`);
  }
}
