import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'

// Bundle the worker with the app — no CDN, works offline and on any static host.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// pdf.js v6 keeps teardown on the loading task, not on the document proxy.
const loadingTasks = new WeakMap<PDFDocumentProxy, PDFDocumentLoadingTask>()

export async function openPdf(file: File): Promise<PDFDocumentProxy> {
  const buffer = await file.arrayBuffer()
  const task = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const doc = await task.promise
  loadingTasks.set(doc, task)
  return doc
}

/** Tear down a document (terminates its worker). */
export async function closePdf(doc: PDFDocumentProxy): Promise<void> {
  const task = loadingTasks.get(doc)
  if (task) {
    await task.destroy()
    loadingTasks.delete(doc)
  }
}

/** Quick probe used when adding files: returns the page count. */
export async function probePdf(file: File): Promise<number> {
  const doc = await openPdf(file)
  const pages = doc.numPages
  await closePdf(doc)
  return pages
}

/** Page size in PDF points (72 pt = 1 inch). */
export async function getPdfPageSize(
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const size = { width: viewport.width, height: viewport.height }
  page.cleanup()
  return size
}

export interface RenderedPage {
  canvas: HTMLCanvasElement
  /** Page size in PDF points, independent of the render scale. */
  width: number
  height: number
}

/** Render a page onto a white canvas at the given scale (1 = 72 dpi). */
export async function renderPdfPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const points = page.getViewport({ scale: 1 })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({ canvas, viewport, background: '#ffffff' }).promise
  page.cleanup()

  return { canvas, width: points.width, height: points.height }
}
