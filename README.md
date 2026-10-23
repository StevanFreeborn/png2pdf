# @stevanfreeborn/png2pdf

Convert PNG images to PDF files from the command line.

## Requirements

- Node.js 20 or newer
- npm

## Install

Run without installing:

```powershell
npx @stevanfreeborn/png2pdf .\image.png
```

Install globally:

```powershell
npm install --global @stevanfreeborn/png2pdf
png2pdf --help
```

## Local development

```powershell
cd C:\Users\sfree\Repositories\png2pdf
npm install
npm run build
```

Run the local development build directly:

```powershell
npm run dev -- .\image.png
```

Or link the built CLI so `png2pdf` is available on your PATH:

```powershell
npm link
png2pdf --help
```

## Usage

```text
png2pdf <input...> [options]
```

Inputs can be PNG files, directories, or glob patterns. PNG extensions are
matched case-insensitively. Directory inputs are non-recursive unless
`--recursive` is supplied.

### Examples

Create a PDF beside each PNG:

```powershell
png2pdf .\screenshots\login.png
png2pdf .\screenshots
```

Write batch output to a directory:

```powershell
png2pdf ".\screenshots\**\*.png" --recursive --out-dir .\pdfs
```

Combine images into one multi-page PDF:

```powershell
png2pdf ".\screenshots\*.png" --merge --output .\album.pdf
```

Fit images onto A4 pages with a margin:

```powershell
png2pdf .\diagram.png --page-size a4 --margin 18
```

## Options

| Option                | Description                                      |
| --------------------- | ------------------------------------------------ |
| `-d, --out-dir <dir>` | Write batch PDFs to this directory.              |
| `-m, --merge`         | Combine all PNGs into one multi-page PDF.        |
| `-o, --output <file>` | Output path for merged mode. Requires `--merge`. |
| `-r, --recursive`     | Recurse into directory inputs.                   |
| `--page-size <size>`  | `fit`, `a4`, or `letter`. Defaults to `fit`.     |
| `--margin <points>`   | Page margin in PDF points. Defaults to `0`.      |
| `--dpi <number>`      | DPI used to size `fit` pages. Defaults to `96`.  |
| `-f, --force`         | Overwrite existing output files.                 |
| `-q, --quiet`         | Suppress success and progress output.            |
| `-V, --version`       | Print the version.                               |
| `-h, --help`          | Print help.                                      |

## Behavior

- By default, every PNG becomes its own PDF beside the source file.
- With `--merge`, all PNGs become pages in one PDF, in sorted path order.
- `fit` pages use the image's physical dimensions at the selected DPI plus
  margins.
- `a4` and `letter` pages fit and center the image while preserving its aspect
  ratio. Page orientation follows the image orientation.
- Transparent PNGs keep their alpha channel.
- Existing files are not overwritten unless `--force` is used.
- In batch mode, failures are reported without stopping other conversions. The
  command exits with code `1` if any conversion fails.
- Batch output collisions, such as two inputs with the same basename and one
  output directory, are rejected before conversion starts.

## Development

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
```
