# Watermark My Doc

Add text watermarks to images and PDFs **entirely in your browser** — no uploads, no server processing. Files never leave your device.

Built with Vue 3 + Vite + Tailwind CSS v4, `pdf.js` (rendering), `pdf-lib` (vector output) and `JSZip`.

## Features

- **Multiple inputs** — drag & drop or pick any mix of images (PNG, JPEG, WebP…) and PDFs at once.
- **Rich watermark config**
  - multi-line text with tokens: `{name}` `{date}` `{time}` `{page}` `{pages}` `{filename}`
  - font family, size (`%` of the shorter side or `px`), bold/italic, letter spacing, line height
  - angle/rotation, anchored position (9 anchors) + X/Y offsets
  - **tiled/looped** watermark (spacing + offsets) or a single stamp
  - solid **or gradient** fill (multi-stop, angle), opacity, canvas blend modes
  - outline stroke and drop shadow
- **Live preview** — the exact same layout engine drives the preview, the raster renderer and the vector PDF writer, so what you see is what you get.
- **Output options**
  - **PDF** — per file or **combined into a single merged PDF**
    - *Vector text* mode: real selectable text, tiny files (solid color only)
    - *Raster image* mode: full styling (gradient, stroke, shadow) at a chosen DPI
  - **Images** — PNG/JPEG per file, or **combined into one ZIP**
- **Presets** — Diagonal tile, Corner stamp, Centered, Gradient, Subtle rows.

## Getting started

```sh
bun install
bun run dev      # http://localhost:5173
```

Other scripts:

```sh
bun run build    # typecheck (vue-tsc) + production build into dist/
bun run preview  # serve the production build
bun run typecheck
```

## Deploying

`bun run build` emits a fully static site in `dist/`. Host it anywhere (GitHub Pages, Netlify, S3, nginx…). There is no backend — all processing happens in the visitor's browser with Web Workers and `<canvas>`.

## Testing

An end-to-end test drives the real app in headless Edge via `puppeteer-core`:

```sh
bun run dev                # terminal 1
bun scripts/e2e.mjs        # terminal 2 (port 5174 → set WM_BASE_URL to override)
```

It uploads `test-sample.png` / `test-sample.pdf`, exercises the preview, presets and all three output modes, re-reads the generated PDFs back through pdf-lib/pdf.js (including a rotation-sign check), and writes screenshots to `shots/`.

Regenerate the PDF fixture with:

```sh
bun scripts/make-test-pdf.ts
```

## Privacy

Everything runs client-side: files are read with the File API, rendered to canvas in the page, and packed into blobs for download. Nothing is ever sent to a server.
