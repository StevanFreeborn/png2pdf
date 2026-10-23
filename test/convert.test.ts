import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it } from "vitest";
import { convertPngsToPdf, convertPngsToPdfs } from "../src/lib/convert.js";
import {
  createTempDirectory,
  removeTempDirectory,
  writeTinyPng,
} from "./helpers.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => removeTempDirectory(directory)),
  );
});

async function makeTempDirectory(): Promise<string> {
  const directory = await createTempDirectory();
  tempDirectories.push(directory);
  return directory;
}

describe("convertPngsToPdfs", () => {
  it("converts each PNG to its own PDF beside the source", async () => {
    const directory = await makeTempDirectory();
    const first = path.join(directory, "first.png");
    const second = path.join(directory, "second.PNG");
    await writeTinyPng(first);
    await writeTinyPng(second);

    const result = await convertPngsToPdfs([first, second]);

    expect(result.failed).toEqual([]);
    expect(result.converted).toHaveLength(2);

    for (const conversion of result.converted) {
      expect(conversion.outputPath).toBe(
        path.join(
          directory,
          `${path.basename(conversion.inputPath, path.extname(conversion.inputPath))}.pdf`,
        ),
      );

      const pdf = await PDFDocument.load(await readFile(conversion.outputPath));
      expect(pdf.getPageCount()).toBe(1);
      expect(pdf.getPage(0).getWidth()).toBeCloseTo(0.75);
      expect(pdf.getPage(0).getHeight()).toBeCloseTo(0.75);
    }
  });

  it("writes batch output to the selected directory", async () => {
    const directory = await makeTempDirectory();
    const inputDirectory = path.join(directory, "input");
    const outputDirectory = path.join(directory, "output");
    await mkdir(inputDirectory);
    const input = path.join(inputDirectory, "image.png");
    await writeTinyPng(input);

    const result = await convertPngsToPdfs([input], {
      outDir: outputDirectory,
    });

    expect(result.converted[0]?.outputPath).toBe(
      path.join(outputDirectory, "image.pdf"),
    );
    expect(
      (await readFile(path.join(outputDirectory, "image.pdf"))).length,
    ).toBeGreaterThan(0);
  });

  it("refuses existing outputs unless force is enabled", async () => {
    const directory = await makeTempDirectory();
    const input = path.join(directory, "image.png");
    await writeTinyPng(input);

    const initial = await convertPngsToPdfs([input]);
    expect(initial.failed).toEqual([]);

    const refused = await convertPngsToPdfs([input]);
    expect(refused.converted).toEqual([]);
    expect(refused.failed).toHaveLength(1);
    expect(refused.failed[0]?.error.message).toMatch(/already exists/i);

    const forced = await convertPngsToPdfs([input], { force: true });
    expect(forced.failed).toEqual([]);
    expect(forced.converted).toHaveLength(1);
  });

  it("detects output basename collisions before writing", async () => {
    const directory = await makeTempDirectory();
    const firstDirectory = path.join(directory, "one");
    const secondDirectory = path.join(directory, "two");
    const outputDirectory = path.join(directory, "output");
    await mkdir(firstDirectory);
    await mkdir(secondDirectory);
    const first = path.join(firstDirectory, "image.png");
    const second = path.join(secondDirectory, "image.png");
    await writeTinyPng(first);
    await writeTinyPng(second);

    await expect(
      convertPngsToPdfs([first, second], { outDir: outputDirectory }),
    ).rejects.toThrow(/Output collision/i);
  });
});

describe("convertPngsToPdf", () => {
  it("merges multiple PNGs into one multi-page PDF", async () => {
    const directory = await makeTempDirectory();
    const first = path.join(directory, "first.png");
    const second = path.join(directory, "second.png");
    await writeTinyPng(first);
    await writeTinyPng(second);
    const output = path.join(directory, "album.pdf");

    const actualOutput = await convertPngsToPdf([first, second], output);

    expect(actualOutput).toBe(output);
    const pdf = await PDFDocument.load(await readFile(output));
    expect(pdf.getPageCount()).toBe(2);
  });

  it("appends a PDF extension when merged output has none", async () => {
    const directory = await makeTempDirectory();
    const input = path.join(directory, "image.png");
    await writeTinyPng(input);

    const output = await convertPngsToPdf(
      [input],
      path.join(directory, "album"),
    );

    expect(output).toBe(path.join(directory, "album.pdf"));
    expect((await readFile(output)).length).toBeGreaterThan(0);
  });

  it("refuses to overwrite merged outputs without force", async () => {
    const directory = await makeTempDirectory();
    const input = path.join(directory, "image.png");
    const output = path.join(directory, "album.pdf");
    await writeTinyPng(input);
    await convertPngsToPdf([input], output);

    await expect(convertPngsToPdf([input], output)).rejects.toThrow(
      /already exists/i,
    );

    await expect(
      convertPngsToPdf([input], output, { force: true }),
    ).resolves.toBe(output);
  });
});
