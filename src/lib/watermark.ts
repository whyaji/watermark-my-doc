import type { Anchor, Measure, TokenContext, WatermarkConfig } from '../types'
import { hexToRgba } from './colors'

/**
 * Core watermark engine.
 *
 * Everything is laid out in the coordinate space of the target surface
 * (preview canvas, output canvas or PDF page) using two inputs:
 *  - `width` / `height`: the surface size in its own units (px, or PDF points)
 *  - `scale`: converts configured `px` values into surface units.
 *    `%` values are resolved against `min(width, height)` and need no scaling.
 *
 * The same layout drives the canvas renderer and the vector PDF renderer, so
 * previews and outputs stay aligned.
 */

export type TextMeasurer = (line: string) => number

export interface WmInstance {
  lines: string[]
  widths: number[]
  /** Center of the text block, top-left origin, y grows downward. */
  cx: number
  cy: number
  blockW: number
  blockH: number
  /** Distance from the visual middle of a line down to its baseline. */
  baselineOffset: number
}

export interface DrawOptions {
  /** Converts configured `px` values into surface units. Defaults to 1. */
  scale?: number
  tokens?: TokenContext
}

let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 4
  measureCtx = canvas.getContext('2d')
  return measureCtx
}

export function clampNum(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function resolveMeasure(measure: Measure, minDim: number, scale = 1): number {
  if (!measure || !Number.isFinite(measure.value)) return 0
  return measure.unit === '%' ? (measure.value / 100) * minDim : measure.value * scale
}

export function fontCss(config: WatermarkConfig, sizePx: number): string {
  const style = config.italic ? 'italic ' : ''
  const weight = config.bold ? '700 ' : ''
  return `${style}${weight}${Math.max(sizePx, 0.1)}px "${config.fontFamily}", sans-serif`
}

export function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  const target = ctx as unknown as { letterSpacing: string }
  try {
    target.letterSpacing = `${px}px`
  } catch {
    /* browser without letterSpacing support — silently ignored */
  }
}

const TOKEN_PATTERN = /\{(name|filename|date|time|page|pages)\}/gi

export function applyTokens(text: string, tokens: TokenContext): string {
  return text.replace(TOKEN_PATTERN, (raw, key: string) => {
    switch (key.toLowerCase()) {
      case 'name':
        return tokens.name ?? ''
      case 'filename':
        return tokens.filename ?? tokens.name ?? ''
      case 'date':
        return new Date().toLocaleDateString()
      case 'time':
        return new Date().toLocaleTimeString()
      case 'page':
        return tokens.page != null ? String(tokens.page) : ''
      case 'pages':
        return tokens.pages != null ? String(tokens.pages) : ''
      default:
        return raw
    }
  })
}

type HAlign = 'left' | 'center' | 'right'
type VAlign = 'top' | 'center' | 'bottom'

function splitAnchor(anchor: Anchor): [HAlign, VAlign] {
  switch (anchor) {
    case 'top-left':
      return ['left', 'top']
    case 'top-center':
      return ['center', 'top']
    case 'top-right':
      return ['right', 'top']
    case 'middle-left':
      return ['left', 'center']
    case 'middle-right':
      return ['right', 'center']
    case 'bottom-left':
      return ['left', 'bottom']
    case 'bottom-center':
      return ['center', 'bottom']
    case 'bottom-right':
      return ['right', 'bottom']
    case 'center':
    default:
      return ['center', 'center']
  }
}

/**
 * Distance from the visual middle of a line down to its baseline, matching the
 * browser's `textBaseline = 'middle'` so canvas output and vector PDFs agree.
 */
function baselineOffsetFor(config: WatermarkConfig, size: number): number {
  const ctx = getMeasureCtx()
  if (!ctx) return size * 0.35
  ctx.font = fontCss(config, size)
  setLetterSpacing(ctx, 0)
  const metrics = ctx.measureText('Hxg') as TextMetrics & {
    fontBoundingBoxAscent?: number
    fontBoundingBoxDescent?: number
  }
  const ascent = metrics.fontBoundingBoxAscent
  const descent = metrics.fontBoundingBoxDescent
  if (typeof ascent === 'number' && typeof descent === 'number' && ascent + descent > 0) {
    return (ascent - descent) / 2
  }
  return size * 0.35
}

export function layoutWatermark(
  config: WatermarkConfig,
  width: number,
  height: number,
  scale: number,
  text: string,
  measure?: TextMeasurer,
): WmInstance[] {
  if (!(width > 0) || !(height > 0)) return []
  const minDim = Math.min(width, height)
  const size = resolveMeasure(config.fontSize, minDim, scale)
  if (!(size > 0)) return []

  const lines = (text ?? '').split('\n')
  const letterSpacing = resolveMeasure(config.letterSpacing, minDim, scale)

  let measurer = measure
  if (!measurer) {
    const ctx = getMeasureCtx()
    if (!ctx) return []
    const font = fontCss(config, size)
    measurer = (line: string) => {
      ctx.font = font
      setLetterSpacing(ctx, letterSpacing)
      return ctx.measureText(line).width
    }
  }

  const widths = lines.map((line) => Math.max(measurer(line), 0))
  const blockW = Math.max(...widths, 1)
  const lineHeightPx = size * config.lineHeight
  const blockH = (lines.length - 1) * lineHeightPx + size
  const baselineOffset = baselineOffsetFor(config, size)

  // Bounding box after rotation, so tiled copies never collide.
  const rad = (config.rotation * Math.PI) / 180
  const cosA = Math.abs(Math.cos(rad))
  const sinA = Math.abs(Math.sin(rad))
  const footW = blockW * cosA + blockH * sinA
  const footH = blockW * sinA + blockH * cosA

  if (config.layout === 'single') {
    const margin = resolveMeasure(config.margin, minDim, scale)
    const offX = resolveMeasure(config.offsetX, minDim, scale)
    const offY = resolveMeasure(config.offsetY, minDim, scale)
    const [horizontal, vertical] = splitAnchor(config.anchor)
    const cx =
      (horizontal === 'left'
        ? margin + blockW / 2
        : horizontal === 'right'
          ? width - margin - blockW / 2
          : width / 2) + offX
    const cy =
      (vertical === 'top'
        ? margin + blockH / 2
        : vertical === 'bottom'
          ? height - margin - blockH / 2
          : height / 2) + offY
    return [{ lines, widths, cx, cy, blockW, blockH, baselineOffset }]
  }

  const spacingX = resolveMeasure(config.tileSpacingX, minDim, scale)
  const spacingY = resolveMeasure(config.tileSpacingY, minDim, scale)
  const offX = resolveMeasure(config.tileOffsetX, minDim, scale)
  const offY = resolveMeasure(config.tileOffsetY, minDim, scale)
  const stepX = Math.max(footW + spacingX, 1)
  const stepY = Math.max(footH + spacingY, 1)
  const cols = Math.max(1, Math.ceil((width + spacingX) / stepX))
  const rows = Math.max(1, Math.ceil((height + spacingY) / stepY))
  const gridW = cols * stepX - spacingX
  const gridH = rows * stepY - spacingY
  const startX = (width - gridW) / 2 + offX
  const startY = (height - gridH) / 2 + offY

  const instances: WmInstance[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      instances.push({
        lines,
        widths,
        blockW,
        blockH,
        baselineOffset,
        cx: startX + col * stepX + footW / 2,
        cy: startY + row * stepY + footH / 2,
      })
    }
  }
  return instances
}

function createGradient(
  ctx: CanvasRenderingContext2D,
  blockW: number,
  blockH: number,
  config: WatermarkConfig,
): CanvasGradient {
  const angle = (config.gradientAngle * Math.PI) / 180
  const half = Math.max(
    (Math.abs(blockW * Math.cos(angle)) + Math.abs(blockH * Math.sin(angle))) / 2,
    1,
  )
  const gradient = ctx.createLinearGradient(
    -half * Math.cos(angle),
    -half * Math.sin(angle),
    half * Math.cos(angle),
    half * Math.sin(angle),
  )
  const colors = config.gradientColors
  const last = colors.length - 1
  colors.forEach((color, index) => gradient.addColorStop(last === 0 ? 0 : index / last, color))
  return gradient
}

/** Paint the watermark onto a 2D context. */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
  options: DrawOptions = {},
): void {
  const text = applyTokens(config.text, options.tokens ?? {})
  if (!text.trim()) return
  const opacity = clampNum(config.opacity, 0, 100) / 100
  if (opacity <= 0) return

  const scale = options.scale ?? 1
  const minDim = Math.min(width, height)
  const instances = layoutWatermark(config, width, height, scale, text)
  if (!instances.length) return

  const size = resolveMeasure(config.fontSize, minDim, scale)
  const strokeW = resolveMeasure(config.strokeWidth, minDim, scale)
  const letterSpacing = resolveMeasure(config.letterSpacing, minDim, scale)
  const useGradient = config.fillMode === 'gradient' && config.gradientColors.length >= 2

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.globalCompositeOperation = config.blendMode as GlobalCompositeOperation
  ctx.font = fontCss(config, size)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  setLetterSpacing(ctx, letterSpacing)

  if (config.shadow.enabled) {
    ctx.shadowColor = hexToRgba(config.shadow.color, 1)
    ctx.shadowBlur = resolveMeasure(config.shadow.blur, minDim, scale)
    ctx.shadowOffsetX = resolveMeasure(config.shadow.offsetX, minDim, scale)
    ctx.shadowOffsetY = resolveMeasure(config.shadow.offsetY, minDim, scale)
  }

  const lineHeightPx = size * config.lineHeight
  for (const instance of instances) {
    ctx.save()
    ctx.translate(instance.cx, instance.cy)
    if (config.rotation) ctx.rotate((config.rotation * Math.PI) / 180)
    ctx.fillStyle = useGradient
      ? createGradient(ctx, instance.blockW, instance.blockH, config)
      : config.color

    const lines = instance.lines
    const middle = (lines.length - 1) / 2
    for (let i = 0; i < lines.length; i++) {
      const x = -instance.widths[i] / 2
      const y = (i - middle) * lineHeightPx
      ctx.fillText(lines[i], x, y)
      if (strokeW > 0) {
        ctx.strokeStyle = config.strokeColor
        ctx.lineWidth = strokeW
        ctx.lineJoin = 'round'
        ctx.miterLimit = 2
        ctx.strokeText(lines[i], x, y)
      }
    }
    ctx.restore()
  }
  ctx.restore()
}
