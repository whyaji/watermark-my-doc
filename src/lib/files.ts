import JSZip from 'jszip'
import type { ImageFormat, SourceKind } from '../types'

const IMAGE_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'avif',
  'svg',
  'ico',
  'tif',
  'tiff',
])

/** Decide whether a file can be processed, and as what. */
export function classifyFile(file: File): SourceKind | null {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (file.type === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (file.type.startsWith('image/') || IMAGE_EXTS.has(ext)) return 'image'
  return null
}

export function splitName(name: string): { base: string; ext: string } {
  const index = name.lastIndexOf('.')
  if (index <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, index), ext: name.slice(index + 1).toLowerCase() }
}

export function stripExt(name: string): string {
  return splitName(name).base
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

export function extFor(format: ImageFormat): string {
  return format === 'jpeg' ? 'jpg' : format
}

export function mimeFor(format: ImageFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
}

export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

export interface ZipEntry {
  name: string
  blob: Blob
}

export async function zipEntries(
  entries: ZipEntry[],
  zipName = 'files.zip',
): Promise<{ name: string; blob: Blob }> {
  const zip = new JSZip()
  for (const entry of entries) zip.file(entry.name, entry.blob)
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  return { name: zipName, blob }
}

/** Trigger a browser download for a blob. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
