#!/usr/bin/env node

import { createRequire } from "node:module";
import path from "node:path";
import { Command, InvalidArgumentError } from "commander";
import { convertPngsToPdf, convertPngsToPdfs } from "./lib/convert.js";
import { Png2PdfError, getErrorMessage } from "./lib/errors.js";
import { expandInputs } from "./lib/inputs.js";
import { isPageSize, type PageSize } from "./lib/layout.js";

type CliOptions = {
  outDir?: string;
  merge?: boolean;
  output?: string;
  recursive?: boolean;
  pageSize: PageSize;
  margin: number;
  dpi: number;
  force?: boolean;
  quiet?: boolean;
};

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("png2pdf")
    .description("Convert PNG images to PDF files.")
    .version(packageJson.version)
    .argument("<input...>", "PNG files, directories, or glob patterns")
    .option("-d, --out-dir <dir>", "write batch PDFs to this directory")
    .option("-m, --merge", "combine all PNGs into one multi-page PDF")
    .option("-o, --output <file>", "output path for merged mode")
    .option("-r, --recursive", "recurse into directory inputs")
    .option(
      "--page-size <size>",
      "page size: fit, a4, or letter",
      parsePageSize,
      "fit",
    )
    .option(
      "--margin <points>",
      "page margin in PDF points",
      parseNonNegativeNumber,
      0,
    )
    .option(
      "--dpi <number>",
      "DPI used to size fit pages",
      parsePositiveNumber,
      96,
    )
    .option("-f, --force", "overwrite existing output files")
    .option("-q, --quiet", "suppress success output")
    .showHelpAfterError()
    .action(async (inputs: string[], options: CliOptions) => {
      await runCommand(inputs, options);
    });

  return program;
}

async function runCommand(
  inputs: readonly string[],
  options: CliOptions,
): Promise<void> {
  validateModeOptions(options);

  const pngFiles = await expandInputs(inputs, {
    recursive: options.recursive ?? false,
  });

  if (options.merge) {
    const output = await convertPngsToPdf(pngFiles, options.output as string, {
      pageSize: options.pageSize,
      margin: options.margin,
      dpi: options.dpi,
      force: options.force ?? false,
    });

    if (!options.quiet) {
      console.log(
        `Created ${displayPath(output)} from ${countLabel(pngFiles.length)}.`,
      );
    }

    return;
  }

  const result = await convertPngsToPdfs(pngFiles, {
    outDir: options.outDir,
    pageSize: options.pageSize,
    margin: options.margin,
    dpi: options.dpi,
    force: options.force ?? false,
  });

  if (!options.quiet) {
    for (const conversion of result.converted) {
      console.log(
        `${displayPath(conversion.inputPath)} -> ${displayPath(
          conversion.outputPath,
        )}`,
      );
    }
  }

  for (const failure of result.failed) {
    console.error(
      `Failed ${displayPath(failure.inputPath)}: ${getErrorMessage(
        failure.error,
      )}`,
    );
  }

  if (!options.quiet) {
    console.log(
      `Converted ${result.converted.length} of ${countLabel(pngFiles.length)}.`,
    );
  }

  if (result.failed.length > 0) {
    process.exitCode = 1;
  }
}

function validateModeOptions(options: CliOptions): void {
  if (options.merge && !options.output) {
    throw new Png2PdfError("--merge requires --output <file>.");
  }

  if (options.merge && options.outDir) {
    throw new Png2PdfError("--out-dir cannot be used with --merge.");
  }

  if (!options.merge && options.output) {
    throw new Png2PdfError("--output can only be used with --merge.");
  }
}

function parsePageSize(value: string): PageSize {
  if (isPageSize(value)) {
    return value;
  }

  throw new InvalidArgumentError(
    `Invalid page size "${value}". Expected fit, a4, or letter.`,
  );
}

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new InvalidArgumentError(`Expected a number zero or greater.`);
  }

  return parsed;
}

function parsePositiveNumber(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`Expected a number greater than zero.`);
  }

  return parsed;
}

function displayPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);

  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    return filePath;
  }

  return relative;
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "PNG" : "PNGs"}`;
}

async function main(): Promise<void> {
  try {
    await buildProgram().parseAsync(process.argv);
  } catch (error) {
    console.error(`Error: ${getErrorMessage(error)}`);
    process.exitCode = 1;
  }
}

void main();
