import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { Png2PdfError, getErrorMessage } from "./errors.js";
import { calculatePageLayout, type PageSize } from "./layout.js";

export type ConversionOptions = {
  pageSize?: PageSize;
  margin?: number;
  dpi?: number;
};

export type BatchConversionOptions = ConversionOptions & {
  outDir?: string;
  force?: boolean;
};

export type ConversionSuccess = {
  inputPath: string;
  outputPath: string;
};

export type ConversionFailure = {
  inputPath: string;
  error: Error;
};

export type BatchConversionResult = {
  converted: ConversionSuccess[];
  failed: ConversionFailure[];
};

type PlannedConversion = {
  inputPath: string;
  outputPath: string;
};

export async function createPdfFromPngs(
  inputPaths: readonly string[],
  options: ConversionOptions = {},
  title?: string,
): Promise<Uint8Array> {
  if (inputPaths.length === 0) {
    throw new Png2PdfError("At least one PNG is required to create a PDF.");
  }

  const document = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    const resolvedInput = path.resolve(inputPath);
    let pngBytes: Uint8Array;

    try {
      pngBytes = await readFile(resolvedInput);
    } catch (error) {
      throw new Png2PdfError(
        `Could not read PNG "${resolvedInput}": ${getErrorMessage(error)}`,
        { cause: error },
      );
    }

    let image;

    try {
      image = await document.embedPng(pngBytes);
    } catch (error) {
      throw new Png2PdfError(
        `Could not embed PNG "${resolvedInput}": ${getErrorMessage(error)}`,
        { cause: error },
      );
    }

    const layout = calculatePageLayout({
      pixelWidth: image.width,
      pixelHeight: image.height,
      dpi: options.dpi,
      pageSize: options.pageSize,
      margin: options.margin,
    });

    const page = document.addPage([layout.pageWidth, layout.pageHeight]);
    page.drawImage(image, {
      x: layout.imageX,
      y: layout.imageY,
      width: layout.imageWidth,
      height: layout.imageHeight,
    });
  }

  const defaultTitle =
    inputPaths.length === 1 && inputPaths[0]
      ? path.basename(inputPaths[0], path.extname(inputPaths[0]))
      : undefined;

  document.setTitle(title ?? defaultTitle ?? "png2pdf document");
  document.setCreator("png2pdf");
  document.setProducer("png2pdf");

  return document.save();
}

export async function convertPngsToPdfs(
  inputPaths: readonly string[],
  options: BatchConversionOptions = {},
): Promise<BatchConversionResult> {
  if (inputPaths.length === 0) {
    throw new Png2PdfError("At least one PNG is required.");
  }

  const planned = planBatchConversions(inputPaths, options.outDir);
  const directories = new Set(
    planned.map((conversion) => path.dirname(conversion.outputPath)),
  );

  await Promise.all(
    [...directories].map((directory) => mkdir(directory, { recursive: true })),
  );

  const result: BatchConversionResult = { converted: [], failed: [] };

  for (const conversion of planned) {
    try {
      if (!options.force && (await pathExists(conversion.outputPath))) {
        throw new Png2PdfError(
          `Output already exists: ${conversion.outputPath}. Use --force to overwrite.`,
        );
      }

      const pdfBytes = await createPdfFromPngs(
        [conversion.inputPath],
        options,
        path.basename(conversion.inputPath, path.extname(conversion.inputPath)),
      );

      await writePdf(conversion.outputPath, pdfBytes, options.force ?? false);
      result.converted.push(conversion);
    } catch (error) {
      result.failed.push({
        inputPath: conversion.inputPath,
        error: toError(error),
      });
    }
  }

  return result;
}

export async function convertPngsToPdf(
  inputPaths: readonly string[],
  outputPath: string,
  options: ConversionOptions & { force?: boolean } = {},
): Promise<string> {
  if (inputPaths.length === 0) {
    throw new Png2PdfError("At least one PNG is required.");
  }

  const resolvedOutput = withPdfExtension(path.resolve(outputPath));

  await mkdir(path.dirname(resolvedOutput), { recursive: true });

  if (!options.force && (await pathExists(resolvedOutput))) {
    throw new Png2PdfError(
      `Output already exists: ${resolvedOutput}. Use --force to overwrite.`,
    );
  }

  const pdfBytes = await createPdfFromPngs(
    inputPaths,
    options,
    path.basename(resolvedOutput, path.extname(resolvedOutput)),
  );

  await writePdf(resolvedOutput, pdfBytes, options.force ?? false);

  return resolvedOutput;
}

function planBatchConversions(
  inputPaths: readonly string[],
  outDir?: string,
): PlannedConversion[] {
  const resolvedOutDir = outDir ? path.resolve(outDir) : undefined;
  const planned: PlannedConversion[] = [];
  const outputs = new Map<string, string>();

  for (const inputPath of inputPaths) {
    const resolvedInput = path.resolve(inputPath);
    const directory = resolvedOutDir ?? path.dirname(resolvedInput);
    const filename = `${path.basename(
      resolvedInput,
      path.extname(resolvedInput),
    )}.pdf`;
    const outputPath = path.join(directory, filename);
    const key =
      process.platform === "win32" ? outputPath.toLowerCase() : outputPath;
    const existingInput = outputs.get(key);

    if (existingInput) {
      throw new Png2PdfError(
        `Output collision: "${existingInput}" and "${resolvedInput}" both map to "${outputPath}".`,
      );
    }

    outputs.set(key, resolvedInput);
    planned.push({ inputPath: resolvedInput, outputPath });
  }

  return planned;
}

async function writePdf(
  outputPath: string,
  pdfBytes: Uint8Array,
  force: boolean,
): Promise<void> {
  try {
    await writeFile(outputPath, pdfBytes, { flag: force ? "w" : "wx" });
  } catch (error) {
    if (isErrnoException(error) && error.code === "EEXIST") {
      throw new Png2PdfError(
        `Output already exists: ${outputPath}. Use --force to overwrite.`,
        { cause: error },
      );
    }

    throw new Png2PdfError(
      `Could not write PDF "${outputPath}": ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function withPdfExtension(outputPath: string): string {
  return path.extname(outputPath) === "" ? `${outputPath}.pdf` : outputPath;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
