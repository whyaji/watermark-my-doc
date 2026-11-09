import {
  BlendMode,
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFImage,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type { PdfMode, SourceItem, TokenContext, WatermarkConfig } from '../types'
import { hexToRgb01 } from './colors'
import { stripExt, yieldToUi } from './files'
import { encodeCanvas, rasterizeImage, watermarkImage } from './image'
import { closePdf, openPdf, renderPdfPage } from './pdf'
import {
  applyTokens,
  drawWatermark,
  layoutWatermark,
  resolveMeasure,
  type TextMeasurer,
} from './watermark'

/**
 * Configured `px` values are defined against 96 dpi CSS pixels.
 * 1 CSS px = 72/96 PDF points, so everything is scaled by 0.75 in PDF space.
 * Raster output uses dpi/72 for rendering and dpi/96 for the watermark scale.
 */
const VECTOR_SCALE = 0.75

const BLEND_MAP: Record<string, BlendMode> = {
  'source-over': BlendMode.Normal,
  multiply: BlendMode.Multiply,
  screen: BlendMode.Screen,
  overlay: BlendMode.Overlay,
  darken: BlendMode.Darken,
  lighten: BlendMode.Lighten,
  'color-dodge': BlendMode.ColorDodge,
  'color-burn': BlendMode.ColorBurn,
  'hard-light': BlendMode.HardLight,
  'soft-light': BlendMode.SoftLight,
  difference: BlendMode.Difference,
  exclusion: BlendMode.Exclusion,
}

export function isBlendSupported(value: string): boolean {
  return value in BLEND_MAP
}

/** Human-readable notes about what vector PDF mode cannot reproduce. */
export function vectorLimitations(config: WatermarkConfig): string[] {
  const notes: string[] = []
  if (config.fillMode === 'gradient') {
    notes.push('Gradient fill is not possible with vector text — a solid color is used instead.')
  }
  if (config.shadow.enabled) {
    notes.push('Shadow is skipped in vector mode.')
  }
  if (config.strokeWidth.value > 0) {
    notes.push('Text outline (stroke) is not supported by vector text.')
  }
  if (!isBlendSupported(config.blendMode)) {
    notes.push('This blend mode falls back to Normal in vector mode.')
  }
  return notes
}

function pickStandardFont(config: WatermarkConfig): StandardFonts {
  const family = config.fontFamily.toLowerCase()
  let base: 'helvetica' | 'times' | 'courier' = 'helvetica'
  if (
    family.includes('times') ||
    family.includes('georgia') ||
    (family.includes('serif') && !family.includes('sans'))
  ) {
    base = 'times'
  } else if (family.includes('courier') || family.includes('consol') || family.includes('mono')) {
    base = 'courier'
  }

  const { bold, italic } = config
  if (base === 'times') {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic
    if (bold) return StandardFonts.TimesRomanBold
    if (italic) return StandardFonts.TimesRomanItalic
    return StandardFonts.TimesRoman
  }
  if (base === 'courier') {
    if (bold && italic) return StandardFonts.CourierBoldOblique
    if (bold) return StandardFonts.CourierBold
    if (italic) return StandardFonts.CourierOblique
    return StandardFonts.Courier
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique
  if (bold) return StandardFonts.HelveticaBold
  if (italic) return StandardFonts.HelveticaOblique
  return StandardFonts.Helvetica
}

function solidFill(config: WatermarkConfig) {
  const hex =
    config.fillMode === 'gradient' && config.gradientColors.length > 0
      ? config.gradientColors[0]
      : config.color
  const [r, g, b] = hexToRgb01(hex)
  return rgb(r, g, b)
}

export function tokensFor(item: SourceItem, page: number, pages: number): TokenContext {
  return { name: item.base, filename: item.name, page, pages }
}

function makePdfMeasurer(font: PDFFont, size: number, letterSpacing: number): TextMeasurer {
  return (line: string) => {
    if (!line) return 0
    if (Math.abs(letterSpacing) < 0.01) return font.widthOfTextAtSize(line, size)
    let width = 0
    for (const char of line) width += font.widthOfTextAtSize(char, size) + letterSpacing
    return width
  }
}

function drawLine(
  page: PDFPage,
  line: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  opacity: number,
  rotateDeg: number,
  blend: BlendMode,
  letterSpacing: number,
  dirX: number,
  dirY: number,
): void {
  const base = { size, font, color, opacity, rotate: degrees(rotateDeg), blendMode: blend }
  if (Math.abs(letterSpacing) < 0.01) {
    page.drawText(line, { ...base, x, y })
    return
  }
  // pdf-lib has no letter spacing — advance per character manually.
  let cursor = 0
  for (const char of line) {
    if (char !== ' ') {
      page.drawText(char, { ...base, x: x + dirX * cursor, y: y + dirY * cursor })
    }
    cursor += font.widthOfTextAtSize(char, size) + letterSpacing
  }
}

/**
 * Draw the watermark as real vector text on every page.
 * `pageNames` supplies the source file name for {name}/{filename} tokens.
 */
export async function applyVectorWatermark(
  doc: PDFDocument,
  config: WatermarkConfig,
  pageNames: string[],
  onPage?: (done: number, total: number) => void,
): Promise<void> {
  const font = await doc.embedFont(pickStandardFont(config))
  const color = solidFill(config)
  const opacity = Math.min(1, Math.max(0, config.opacity / 100))
  const blend = BLEND_MAP[config.blendMode] ?? BlendMode.Normal
  const pages = doc.getPages()
  const total = pages.length

  // Canvas rotates clockwise for positive angles; PDF rotates counter-clockwise.
  const rotate = -config.rotation
  const rad = (config.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  for (let index = 0; index < total; index++) {
    const page = pages[index]
    const { width, height } = page.getSize()
    const minDim = Math.min(width, height)
    const size = resolveMeasure(config.fontSize, minDim, VECTOR_SCALE)
    const letterSpacing = resolveMeasure(config.letterSpacing, minDim, VECTOR_SCALE)
    const tokens: TokenContext = {
      name: stripExt(pageNames[index] ?? ''),
      filename: pageNames[index] ?? '',
      page: index + 1,
      pages: total,
    }
    const text = applyTokens(config.text, tokens)

    if (text.trim() && size > 0 && opacity > 0) {
      const instances = layoutWatermark(
        config,
        width,
        height,
        VECTOR_SCALE,
        text,
        makePdfMeasurer(font, size, letterSpacing),
      )
      const lineHeightPx = size * config.lineHeight
      for (const instance of instances) {
        const middle = (instance.lines.length - 1) / 2
        for (let lineIndex = 0; lineIndex < instance.lines.length; lineIndex++) {
          const line = instance.lines[lineIndex]
          if (!line) continue
          // Local point of the baseline start (canvas y-down), rotated into PDF space.
          const localX = -instance.widths[lineIndex]
          const localY = (lineIndex - middle) * lineHeightPx + instance.baselineOffset
          const x = instance.cx + (localX * cos - localY * sin)
          const y = height - instance.cy + (-localX * sin - localY * cos)
          drawLine(
            page,
            line,
            x,
            y,
            size,
            font,
            color,
            opacity,
            rotate,
            blend,
            letterSpacing,
            cos,
            -sin,
          )
        }
      }
    }

    onPage?.(index + 1, total)
    await yieldToUi()
  }
}

async function embedImage(doc: PDFDocument, file: File): Promise<PDFImage> {
  const type = (file.type || '').toLowerCase()
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (type === 'image/png' || ext === 'png') return doc.embedPng(await file.arrayBuffer())
  if (type === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') {
    return doc.embedJpg(await file.arrayBuffer())
  }
  // webp / gif / bmp / avif / svg → re-encode as PNG first.
  const canvas = await rasterizeImage(file, 1)
  const blob = await encodeCanvas(canvas, 'png', 1)
  return doc.embedPng(await blob.arrayBuffer())
}

export interface PdfBuildOptions {
  mode: PdfMode
  dpi: number
  quality: number
  config: WatermarkConfig
}

export type PdfProgress = (done: number, total: number, label: string) => void

/**
 * Build one PDF from any mix of images and PDFs.
 * - `vector`: keeps the original page content untouched and draws the watermark
 *   as selectable text on top (best quality, limited styling).
 * - `raster`: renders every page to an image first, so any styling works.
 */
export async function buildPdfFromFiles(
  items: SourceItem[],
  options: PdfBuildOptions,
  onProgress: PdfProgress,
  isCancelled: () => boolean,
): Promise<Uint8Array> {
  const totalPages = items.reduce(
    (sum, item) => sum + (item.kind === 'pdf' ? (item.pages ?? 1) : 1),
    0,
  )
  const totalSteps = options.mode === 'vector' ? items.length + totalPages : totalPages
  let done = 0

  const check = () => {
    if (isCancelled()) throw new DOMException('Cancelled', 'AbortError')
  }
  const report = (label: string) => onProgress(Math.min(done, totalSteps), totalSteps, label)

  const out = await PDFDocument.create()
  const pageNames: string[] = []

  if (options.mode === 'vector') {
    for (const item of items) {
      check()
      if (item.kind === 'pdf') {
        const source = await PDFDocument.load(await item.file.arrayBuffer(), {
          ignoreEncryption: true,
        })
        const copied = await out.copyPages(source, source.getPageIndices())
        for (const page of copied) {
          out.addPage(page)
          pageNames.push(item.name)
        }
        done += item.pages ?? copied.length
      } else {
        const image = await embedImage(out, item.file)
        const width = image.width * VECTOR_SCALE
        const height = image.height * VECTOR_SCALE
        const page = out.addPage([width, height])
        page.drawImage(image, { x: 0, y: 0, width, height })
        pageNames.push(item.name)
        done += 1
      }
      report(`Preparing ${item.name}`)
      await yieldToUi()
    }

    await applyVectorWatermark(out, options.config, pageNames, (pageDone, pageTotal) => {
      onProgress(items.length + pageDone, items.length + pageTotal, `Watermarking page ${pageDone}/${pageTotal}`)
    })
  } else {
    for (const item of items) {
      check()
      if (item.kind === 'pdf') {
        const doc = await openPdf(item.file)
        try {
          const pages = doc.numPages
          for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
            check()
            const { canvas, width, height } = await renderPdfPage(
              doc,
              pageNumber,
              options.dpi / 72,
            )
            const ctx = canvas.getContext('2d')!
            drawWatermark(ctx, canvas.width, canvas.height, options.config, {
              scale: options.dpi / 96,
              tokens: tokensFor(item, pageNumber, pages),
            })
            const blob = await encodeCanvas(canvas, 'jpeg', options.quality)
            const image = await out.embedJpg(await blob.arrayBuffer())
            const page = out.addPage([width, height])
            page.drawImage(image, { x: 0, y: 0, width, height })
            done += 1
            report(`${item.name} — page ${pageNumber}/${pages}`)
            await yieldToUi()
          }
        } finally {
          await closePdf(doc)
        }
      } else {
        const canvas = await watermarkImage(item.file, options.config, {
          scale: 1,
          tokens: tokensFor(item, 1, 1),
        })
        const blob = await encodeCanvas(canvas, 'jpeg', options.quality)
        const image = await out.embedJpg(await blob.arrayBuffer())
        const width = image.width * VECTOR_SCALE
        const height = image.height * VECTOR_SCALE
        const page = out.addPage([width, height])
        page.drawImage(image, { x: 0, y: 0, width, height })
        done += 1
        report(`Watermarking ${item.name}`)
        await yieldToUi()
      }
    }
  }

  check()
  onProgress(totalSteps, totalSteps, 'Saving PDF…')
  return out.save({ useObjectStreams: true })
}
