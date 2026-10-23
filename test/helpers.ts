import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export async function createTempDirectory(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "png2pdf-"));
}

export async function removeTempDirectory(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
}

export async function writeTinyPng(filePath: string): Promise<void> {
  await writeFile(filePath, TINY_PNG);
}
