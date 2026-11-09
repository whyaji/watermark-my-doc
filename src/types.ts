/** Measurement with an optional unit. `%` is relative to the shorter side of the target surface. */
export type Unit = 'px' | '%'

export interface Measure {
  value: number
  unit: Unit
}

export type Anchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type FillMode = 'solid' | 'gradient'
export type LayoutMode = 'single' | 'tile'
export type OutputFormat = 'pdf' | 'image'
export type ImageFormat = 'png' | 'jpeg' | 'webp'
export type PdfMode = 'vector' | 'raster'

export interface ShadowConfig {
  enabled: boolean
  color: string
  blur: Measure
  offsetX: Measure
  offsetY: Measure
}

export interface WatermarkConfig {
  /** Watermark text. Supports tokens: {name} {filename} {date} {time} {page} {pages} */
  text: string
  fontFamily: string
  fontSize: Measure
  bold: boolean
  italic: boolean
  letterSpacing: Measure
  /** Multiplier, e.g. 1.25 */
  lineHeight: number
  fillMode: FillMode
  /** Solid fill color (hex). Also used as fallback for vector PDF output. */
  color: string
  /** 2–4 gradient stops (hex). */
  gradientColors: string[]
  gradientAngle: number
  /** 0–100 */
  opacity: number
  /** Canvas composite operation, e.g. `multiply`. */
  blendMode: string
  /** Degrees, -180…180 (clockwise). */
  rotation: number
  strokeColor: string
  strokeWidth: Measure
  shadow: ShadowConfig
  layout: LayoutMode
  /** Anchor for the `single` layout. */
  anchor: Anchor
  offsetX: Measure
  offsetY: Measure
  /** Inset from the anchored edge (single layout). */
  margin: Measure
  tileSpacingX: Measure
  tileSpacingY: Measure
  tileOffsetX: Measure
  tileOffsetY: Measure
}

export interface OutputOptions {
  format: OutputFormat
  /** Merge every input into a single output file (PDF, or a ZIP of images). */
  combine: boolean
  imageFormat: ImageFormat
  /** 0.1–1, used by jpeg/webp. */
  quality: number
  /** 25–100 (%), resize applied to image inputs. */
  imageScale: number
  pdfMode: PdfMode
  /** Resolution used when a PDF page has to be rasterized. */
  dpi: number
  /** Appended to individual output file names, e.g. `_watermarked`. */
  suffix: string
  /** Base name for combined output. */
  archiveName: string
}

export type SourceKind = 'image' | 'pdf'

export interface SourceItem {
  id: string
  file: File
  name: string
  /** File name without extension. */
  base: string
  ext: string
  kind: SourceKind
  size: number
  /** Page count for PDFs (null until probed). */
  pages: number | null
  error: string | null
  /** Object URL for image thumbnails. */
  url: string | null
}

export interface OutputResult {
  id: string
  name: string
  blob: Blob
  url: string
  size: number
}

export interface TokenContext {
  name?: string
  filename?: string
  page?: number
  pages?: number
}
