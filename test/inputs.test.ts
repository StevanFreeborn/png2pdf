import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { expandInputs } from "../src/lib/inputs.js";
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

describe("expandInputs", () => {
  it("accepts direct PNG files regardless of extension case", async () => {
    const directory = await makeTempDirectory();
    const upper = path.join(directory, "UPPER.PNG");
    const lower = path.join(directory, "lower.png");
    await writeTinyPng(upper);
    await writeTinyPng(lower);

    const result = await expandInputs([upper, lower]);

    expect(result).toEqual([lower, upper]);
  });

  it("scans directories non-recursively by default", async () => {
    const directory = await makeTempDirectory();
    const nested = path.join(directory, "nested");
    await mkdir(nested);
    const rootPng = path.join(directory, "root.png");
    await writeTinyPng(rootPng);
    await writeTinyPng(path.join(nested, "nested.png"));

    const result = await expandInputs([directory]);

    expect(result).toEqual([rootPng]);
  });

  it("scans directories recursively when requested", async () => {
    const directory = await makeTempDirectory();
    const nested = path.join(directory, "nested");
    await mkdir(nested);
    const rootPng = path.join(directory, "root.png");
    const nestedPng = path.join(nested, "nested.PNG");
    await writeTinyPng(rootPng);
    await writeTinyPng(nestedPng);

    const result = await expandInputs([directory], { recursive: true });

    expect(result).toEqual([nestedPng, rootPng]);
  });

  it("supports glob patterns and filenames containing spaces", async () => {
    const directory = await makeTempDirectory();
    const spaced = path.join(directory, "a spaced name.png");
    await writeTinyPng(spaced);
    await writeFile(path.join(directory, "not-an-image.txt"), "ignore me");

    const pattern = path.join(directory, "*.png").replaceAll("\\", "/");
    const result = await expandInputs([pattern]);

    expect(result).toEqual([spaced]);
  });

  it("deduplicates overlapping inputs", async () => {
    const directory = await makeTempDirectory();
    const file = path.join(directory, "one.png");
    await writeTinyPng(file);
    const pattern = path.join(directory, "*.png").replaceAll("\\", "/");

    const result = await expandInputs([file, directory, pattern, file]);

    expect(result).toEqual([file]);
  });

  it("rejects explicit non-PNG files", async () => {
    const directory = await makeTempDirectory();
    const textFile = path.join(directory, "notes.txt");
    await writeFile(textFile, "not a png");

    await expect(expandInputs([textFile])).rejects.toThrow(/not a PNG file/i);
  });

  it("rejects inputs without matching PNGs", async () => {
    const directory = await makeTempDirectory();
    const pattern = path.join(directory, "*.png").replaceAll("\\", "/");

    await expect(expandInputs([pattern])).rejects.toThrow(
      /No PNG files found/i,
    );
  });
});
