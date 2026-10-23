import { stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { Png2PdfError, getErrorMessage } from "./errors.js";

export type ExpandInputsOptions = {
  recursive?: boolean;
};

const GLOB_OPTIONS = {
  absolute: true,
  onlyFiles: true,
  unique: true,
  caseSensitiveMatch: false,
  dot: false,
  followSymbolicLinks: false,
} as const;

export async function expandInputs(
  inputs: readonly string[],
  options: ExpandInputsOptions = {},
): Promise<string[]> {
  if (inputs.length === 0) {
    throw new Png2PdfError(
      "Provide at least one PNG file, directory, or glob.",
    );
  }

  const matches: string[] = [];
  const patterns: string[] = [];
  const invalidFiles: string[] = [];

  for (const input of inputs) {
    if (input.trim() === "") {
      throw new Png2PdfError("Input paths cannot be empty.");
    }

    const resolvedInput = path.resolve(input);
    const stats = await getStats(resolvedInput);

    if (!stats) {
      patterns.push(toGlobPattern(input));
      continue;
    }

    if (stats.isDirectory()) {
      const directoryMatches = await fg(
        options.recursive ? "**/*.png" : "*.png",
        {
          ...GLOB_OPTIONS,
          cwd: resolvedInput,
        },
      );
      matches.push(...directoryMatches);
      continue;
    }

    if (!stats.isFile() || !hasPngExtension(resolvedInput)) {
      invalidFiles.push(input);
      continue;
    }

    matches.push(resolvedInput);
  }

  if (invalidFiles.length > 0) {
    throw new Png2PdfError(
      `Input is not a PNG file: ${invalidFiles.join(", ")}`,
    );
  }

  if (patterns.length > 0) {
    const patternMatches = await fg(patterns, GLOB_OPTIONS);
    matches.push(...patternMatches);
  }

  const pngMatches = matches.filter((filePath) => hasPngExtension(filePath));
  const deduped = deduplicatePaths(pngMatches);

  deduped.sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );

  if (deduped.length === 0) {
    throw new Png2PdfError("No PNG files found for the provided input.");
  }

  return deduped;
}

function hasPngExtension(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".png";
}

function toGlobPattern(input: string): string {
  return input.replaceAll("\\", "/");
}

async function getStats(
  filePath: string,
): Promise<Awaited<ReturnType<typeof stat>> | undefined> {
  try {
    return await stat(filePath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return undefined;
    }

    throw new Png2PdfError(
      `Could not inspect input "${filePath}": ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
}

function deduplicatePaths(filePaths: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const filePath of filePaths) {
    const resolved = path.resolve(filePath);
    const key =
      process.platform === "win32" ? resolved.toLowerCase() : resolved;

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(resolved);
    }
  }

  return deduped;
}

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
