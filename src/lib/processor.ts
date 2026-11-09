import type { OutputOptions, OutputResult, SourceItem, WatermarkConfig } from '../types'
import { extFor, pad2, splitName, yieldToUi, zipEntries, type ZipEntry } from './files'
import { encodeCanvas, watermarkImage } from './image'
import { closePdf, openPdf, renderPdfPage } from './pdf'
import { buildPdfFromFiles, tokensFor } from './pdfOut'
import { drawWatermark } from './watermark'

export interface ProgressState {
  active: boolean
  done: number
  total: number
  label: string
}

export interface CancelToken {
  cancelled: boolean
}

function abortError(): DOMException {
  return new DOMException('Cancelled', 'AbortError')
}

function makeResult(name: string, blob: Blob): OutputResult {
  return { id: crypto.randomUUID(), name, blob, url: URL.createObjectURL(blob), size: blob.size }
}

function pdfResult(name: string, bytes: Uint8Array): OutputResult {
  const copy = new Uint8Array(bytes)
  return makeResult(name, new Blob([copy], { type: 'application/pdf' }))
}

function dedupeNames(entries: ZipEntry[]): ZipEntry[] {
  const seen = new Map<string, number>()
  return entries.map((entry) => {
    const count = seen.get(entry.name) ?? 0
    seen.set(entry.name, count + 1)
    if (count === 0) return entry
    const { base, ext } = splitName(entry.name)
    return { ...entry, name: `${base}-${count + 1}${ext ? `.${ext}` : ''}` }
  })
}

/** Results with identical names (same base name from different folders) get a numeric suffix. */
function uniqueResultNames(results: OutputResult[]): OutputResult[] {
  const seen = new Map<string, number>()
  for (const result of results) {
    const count = seen.get(result.name) ?? 0
    seen.set(result.name, count + 1)
    if (count > 0) {
      const { base, ext } = splitName(result.name)
      result.name = `${base}-${count + 1}${ext ? `.${ext}` : ''}`
    }
  }
  return results
}

/**
 * Run the full job. Everything happens in memory in the browser —
 * no uploads, no server round trips.
 */
export async function processAll(
  items: SourceItem[],
  config: WatermarkConfig,
  options: OutputOptions,
  progress: ProgressState,
  cancel: CancelToken,
): Promise<OutputResult[]> {
  const isCancelled = () => cancel.cancelled
  if (options.format === 'pdf') {
    return uniqueResultNames(await processPdfs(items, config, options, progress, isCancelled))
  }
  return uniqueResultNames(await processImages(items, config, options, progress, isCancelled))
}

async function processImages(
  items: SourceItem[],
  config: WatermarkConfig,
  options: OutputOptions,
  progress: ProgressState,
  isCancelled: () => boolean,
): Promise<OutputResult[]> {
  const outputsFor = (item: SourceItem) => (item.kind === 'image' ? 1 : (item.pages ?? 1))
  const baseTotal = items.reduce((sum, item) => sum + outputsFor(item), 0)
  const needsZip = options.combine || items.some((item) => outputsFor(item) > 1)
  const total = baseTotal + (needsZip ? 1 : 0)
  let done = 0

  const check = () => {
    if (isCancelled()) throw abortError()
  }
  const report = (label: string) => {
    progress.done = Math.min(done, total)
    progress.total = total
    progress.label = label
  }

  const groups: { item: SourceItem; entries: ZipEntry[] }[] = []
  const ext = extFor(options.imageFormat)

  for (const item of items) {
    check()
    const entries: ZipEntry[] = []

    if (item.kind === 'image') {
      const canvas = await watermarkImage(item.file, config, {
        scale: options.imageScale / 100,
        tokens: tokensFor(item, 1, 1),
      })
      const blob = await encodeCanvas(canvas, options.imageFormat, options.quality)
      entries.push({ name: `${item.base}${options.suffix}.${ext}`, blob })
      done += 1
      report(`Watermarking ${item.name}`)
    } else {
      const doc = await openPdf(item.file)
      try {
        const pages = doc.numPages
        const multiPage = pages > 1
        for (let page = 1; page <= pages; page++) {
          check()
          const { canvas } = await renderPdfPage(doc, page, options.dpi / 72)
          const ctx = canvas.getContext('2d')!
          drawWatermark(ctx, canvas.width, canvas.height, config, {
            scale: options.dpi / 96,
            tokens: tokensFor(item, page, pages),
          })
          const blob = await encodeCanvas(canvas, options.imageFormat, options.quality)
          const name = multiPage
            ? `${item.base}${options.suffix}_p${pad2(page)}.${ext}`
            : `${item.base}${options.suffix}.${ext}`
          entries.push({ name, blob })
          done += 1
          report(`${item.name} — page ${page}/${pages}`)
          await yieldToUi()
        }
      } finally {
        await closePdf(doc)
      }
    }

    groups.push({ item, entries })
  }

  if (options.combine) {
    progress.label = 'Packaging ZIP…'
    const { name, blob } = await zipEntries(
      dedupeNames(groups.flatMap((group) => group.entries)),
      `${options.archiveName}.zip`,
    )
    progress.done = total
    progress.total = total
    return [makeResult(name, blob)]
  }

  const results: OutputResult[] = []
  for (const group of groups) {
    if (group.entries.length === 1) {
      results.push(makeResult(group.entries[0].name, group.entries[0].blob))
    } else {
      const { name, blob } = await zipEntries(
        group.entries,
        `${group.item.base}${options.suffix}.zip`,
      )
      results.push(makeResult(name, blob))
    }
  }
  progress.done = total
  progress.total = total
  progress.label = 'Done'
  return results
}

async function processPdfs(
  items: SourceItem[],
  config: WatermarkConfig,
  options: OutputOptions,
  progress: ProgressState,
  isCancelled: () => boolean,
): Promise<OutputResult[]> {
  const buildOptions = {
    mode: options.pdfMode,
    dpi: options.dpi,
    quality: options.quality,
    config,
  }
  const combined = options.combine

  const trackProgress =
    (prefix: string) =>
    (done: number, total: number, label: string): void => {
      progress.done = done
      progress.total = total
      progress.label = prefix ? `${prefix} — ${label}` : label
    }

  if (combined) {
    const bytes = await buildPdfFromFiles(items, buildOptions, trackProgress(''), isCancelled)
    return [pdfResult(`${options.archiveName}.pdf`, bytes)]
  }

  const results: OutputResult[] = []
  for (const item of items) {
    if (isCancelled()) throw abortError()
    const bytes = await buildPdfFromFiles([item], buildOptions, trackProgress(item.name), isCancelled)
    results.push(pdfResult(`${item.base}${options.suffix}.pdf`, bytes))
  }
  return results
}
