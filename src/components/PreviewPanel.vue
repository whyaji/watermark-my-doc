<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { config, files, selectedItem } from '../store'
import { drawWatermark } from '../lib/watermark'
import { closePdf, getPdfPageSize, openPdf, renderPdfPage } from '../lib/pdf'
import type { SourceItem } from '../types'

interface Surface {
  kind: 'image' | 'pdf'
  /** Source units: image pixels, or PDF points. */
  width: number
  height: number
  /** Canvas backing pixels per source unit (includes device pixel ratio). */
  scale: number
  dpr: number
}

interface CachedImage {
  element: HTMLImageElement
  width: number
  height: number
}

const viewportEl = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const showWatermark = ref(true)
const zoom = ref(1)
const pageIndex = ref(1)
const loading = ref(false)
const error = ref<string | null>(null)
const surface = ref<Surface | null>(null)

const item = computed(() => selectedItem.value)
const pageCount = computed(() => (item.value?.kind === 'pdf' ? (item.value.pages ?? 1) : 1))
const displayPage = computed(() => Math.min(pageIndex.value, pageCount.value))
const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)

const dimensionLabel = computed(() => {
  const meta = surface.value
  if (!meta) return ''
  if (meta.kind === 'image') return `${Math.round(meta.width)} × ${Math.round(meta.height)} px`
  return `page ${displayPage.value}/${pageCount.value} · ${Math.round(meta.width)} × ${Math.round(meta.height)} pt`
})

const imageCache = new Map<string, CachedImage>()
const pdfCache = new Map<string, PDFDocumentProxy>()

let baseCanvas: HTMLCanvasElement | null = null
let renderToken = 0
let resizeObserver: ResizeObserver | null = null
let paintTimer: ReturnType<typeof setTimeout> | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null

async function loadImage(current: SourceItem): Promise<CachedImage> {
  const cached = imageCache.get(current.id)
  if (cached) return cached
  const element = new Image()
  const url = current.url ?? URL.createObjectURL(current.file)
  await new Promise<void>((resolve, reject) => {
    element.onload = () => resolve()
    element.onerror = () => reject(new Error(`Cannot decode ${current.name}`))
    element.src = url
  })
  const entry: CachedImage = {
    element,
    width: element.naturalWidth,
    height: element.naturalHeight,
  }
  imageCache.set(current.id, entry)
  return entry
}

async function loadPdf(current: SourceItem): Promise<PDFDocumentProxy> {
  const cached = pdfCache.get(current.id)
  if (cached) return cached
  const doc = await openPdf(current.file)
  pdfCache.set(current.id, doc)
  return doc
}

async function rebuild(): Promise<void> {
  const current = item.value
  const container = viewportEl.value
  if (!current || !container) return

  const token = ++renderToken
  loading.value = true
  error.value = null
  try {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const availWidth = Math.max(container.clientWidth - 40, 120)
    const availHeight = Math.max(container.clientHeight - 40, 120)

    if (current.kind === 'image') {
      const image = await loadImage(current)
      if (token !== renderToken) return
      const fit = Math.min(availWidth / image.width, availHeight / image.height, 4)
      const scale = Math.max(fit * zoom.value, 0.02) * dpr
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image.element, 0, 0, canvas.width, canvas.height)
      baseCanvas = canvas
      surface.value = { kind: 'image', width: image.width, height: image.height, scale, dpr }
    } else {
      const doc = await loadPdf(current)
      const page = Math.min(pageIndex.value, doc.numPages)
      const size = await getPdfPageSize(doc, page)
      if (token !== renderToken) return
      const fit = Math.min(availWidth / size.width, availHeight / size.height, 4)
      const scale = Math.max(fit * zoom.value, 0.05) * dpr
      const rendered = await renderPdfPage(doc, page, scale)
      if (token !== renderToken) return
      baseCanvas = rendered.canvas
      surface.value = { kind: 'pdf', width: size.width, height: size.height, scale, dpr }
    }
    paint()
  } catch (failure) {
    if (token !== renderToken) return
    baseCanvas = null
    surface.value = null
    error.value = (failure as Error).message || 'Preview failed'
  } finally {
    if (token === renderToken) loading.value = false
  }
}

function paint(): void {
  const target = canvasEl.value
  const base = baseCanvas
  const meta = surface.value
  if (!target || !base || !meta) return

  target.width = base.width
  target.height = base.height
  target.style.width = `${Math.round(base.width / meta.dpr)}px`
  target.style.height = `${Math.round(base.height / meta.dpr)}px`

  const ctx = target.getContext('2d')
  if (!ctx) return
  ctx.drawImage(base, 0, 0)

  if (!showWatermark.value || !item.value) return
  // Configured px values are 96-dpi CSS pixels: 0.75 pt each.
  const scale = meta.kind === 'image' ? meta.scale : meta.scale * 0.75
  drawWatermark(ctx, base.width, base.height, config, {
    scale,
    tokens: {
      name: item.value.base,
      filename: item.value.name,
      page: meta.kind === 'pdf' ? displayPage.value : 1,
      pages: pageCount.value,
    },
  })
}

function schedulePaint(): void {
  if (paintTimer) clearTimeout(paintTimer)
  paintTimer = setTimeout(paint, 80)
}

function setZoom(value: number): void {
  zoom.value = Math.min(4, Math.max(0.25, Math.round(value * 100) / 100))
}

watch(
  () => item.value?.id,
  () => {
    pageIndex.value = 1
    baseCanvas = null
    surface.value = null
    void rebuild()
  },
)

watch(
  () => [pageIndex.value, zoom.value, item.value?.pages],
  () => void rebuild(),
)

// Drop cached documents for files that were removed.
watch(
  () => files.value.map((entry) => entry.id),
  (ids) => {
    for (const [id, doc] of Array.from(pdfCache)) {
      if (!ids.includes(id)) {
        pdfCache.delete(id)
        void closePdf(doc).catch(() => undefined)
      }
    }
    for (const id of Array.from(imageCache.keys())) {
      if (!ids.includes(id)) imageCache.delete(id)
    }
  },
)

watch(config, schedulePaint, { deep: true })
watch(showWatermark, paint)

onMounted(() => {
  if (viewportEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => void rebuild(), 120)
    })
    resizeObserver.observe(viewportEl.value)
  }
  void nextTick(() => void rebuild())
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (paintTimer) clearTimeout(paintTimer)
  if (resizeTimer) clearTimeout(resizeTimer)
  for (const doc of pdfCache.values()) void closePdf(doc).catch(() => undefined)
  pdfCache.clear()
  imageCache.clear()
})
</script>

<template>
  <div class="panel flex h-[26rem] min-h-0 flex-col overflow-hidden lg:h-auto">
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-800/70 px-3 py-2">
      <span class="section-title mr-auto">Preview</span>

      <div v-if="item?.kind === 'pdf'" class="flex items-center gap-1">
        <button
          type="button"
          class="icon-btn"
          title="Previous page"
          :disabled="displayPage <= 1"
          @click="pageIndex = displayPage - 1"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <span class="min-w-[3.4rem] text-center text-[0.7rem] text-slate-400">
          {{ displayPage }} / {{ pageCount }}
        </span>
        <button
          type="button"
          class="icon-btn"
          title="Next page"
          :disabled="displayPage >= pageCount"
          @click="pageIndex = displayPage + 1"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <button
        type="button"
        class="btn btn-xs"
        :class="{ 'btn-primary': showWatermark }"
        :title="showWatermark ? 'Hide watermark' : 'Show watermark'"
        @click="showWatermark = !showWatermark"
      >
        {{ showWatermark ? 'Watermark on' : 'Watermark off' }}
      </button>

      <div class="flex items-center gap-1">
        <button type="button" class="icon-btn" title="Zoom out" @click="setZoom(zoom - 0.25)">
          <span aria-hidden="true">−</span>
        </button>
        <span class="w-10 text-center text-[0.7rem] text-slate-400">{{ zoomLabel }}</span>
        <button type="button" class="icon-btn" title="Zoom in" @click="setZoom(zoom + 0.25)">
          <span aria-hidden="true">+</span>
        </button>
        <button type="button" class="btn btn-ghost btn-xs" @click="setZoom(1)">Fit</button>
      </div>
    </div>

    <div
      ref="viewportEl"
      class="checker relative flex min-h-0 flex-1 items-start justify-center overflow-auto p-4"
    >
      <p v-if="error" class="m-auto text-xs text-rose-400">{{ error }}</p>
      <canvas
        v-else
        ref="canvasEl"
        class="rounded shadow-2xl ring-1 ring-slate-900/60"
        aria-label="Watermark preview"
      />
      <div
        v-if="loading"
        class="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/40"
      >
        <span class="chip">Rendering…</span>
      </div>
    </div>

    <div
      class="flex items-center justify-between gap-3 border-t border-slate-800/70 px-3 py-2 text-[0.68rem] text-slate-500"
    >
      <span class="truncate">{{ item?.name ?? 'No file selected' }}</span>
      <span class="flex-none">{{ dimensionLabel }}</span>
    </div>
  </div>
</template>
