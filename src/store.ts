import { computed, reactive, ref } from 'vue'
import { DEFAULT_CONFIG, DEFAULT_OUTPUT, PRESETS, cloneConfig } from './defaults'
import { classifyFile, saveBlob, splitName } from './lib/files'
import { probePdf } from './lib/pdf'
import { processAll, type CancelToken, type ProgressState } from './lib/processor'
import type { OutputOptions, OutputResult, SourceItem, WatermarkConfig } from './types'

/** All app state lives in this module — a tiny reactive singleton. */

export const files = ref<SourceItem[]>([])
export const selectedId = ref<string | null>(null)
export const config = reactive<WatermarkConfig>(cloneConfig(DEFAULT_CONFIG))
export const output = reactive<OutputOptions>({ ...DEFAULT_OUTPUT })
export const progress = reactive<ProgressState>({ active: false, done: 0, total: 0, label: '' })
export const results = ref<OutputResult[]>([])
export const notice = ref<string | null>(null)
export const cancelToken: CancelToken = { cancelled: false }

export const hasFiles = computed(() => files.value.length > 0)
export const selectedItem = computed(
  () => files.value.find((item) => item.id === selectedId.value) ?? files.value[0] ?? null,
)

let noticeTimer: ReturnType<typeof setTimeout> | null = null

export function showNotice(message: string, duration = 5000): void {
  notice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = null
  }, duration)
}

export async function addFiles(list: FileList | File[]): Promise<void> {
  const incoming = Array.from(list)
  const accepted: SourceItem[] = []
  let skipped = 0

  for (const file of incoming) {
    const kind = classifyFile(file)
    if (!kind) {
      skipped += 1
      continue
    }
    const { base, ext } = splitName(file.name)
    accepted.push({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      base,
      ext,
      kind,
      size: file.size,
      pages: kind === 'image' ? 1 : null,
      error: null,
      url: kind === 'image' ? URL.createObjectURL(file) : null,
    })
  }

  if (skipped > 0) {
    showNotice(`${skipped} file(s) skipped — only images and PDFs are supported.`)
  }
  if (!accepted.length) return

  files.value = [...files.value, ...accepted]
  if (!selectedId.value) selectedId.value = accepted[0].id

  // Read page counts in the background so the UI can show them.
  // NOTE: iterate `files.value` — those are the reactive proxies; mutating the
  // raw objects in `accepted` would not trigger a re-render.
  const addedIds = new Set(accepted.map((entry) => entry.id))
  for (const item of files.value) {
    if (!addedIds.has(item.id) || item.kind !== 'pdf') continue
    try {
      item.pages = await probePdf(item.file)
    } catch {
      item.pages = item.pages ?? 1
      item.error = 'Cannot open this PDF (it may be password protected).'
    }
  }
}

export function removeFile(id: string): void {
  const index = files.value.findIndex((item) => item.id === id)
  if (index === -1) return
  const [removed] = files.value.splice(index, 1)
  if (removed?.url) URL.revokeObjectURL(removed.url)
  if (selectedId.value === id) selectedId.value = files.value[0]?.id ?? null
}

export function clearFiles(): void {
  for (const item of files.value) {
    if (item.url) URL.revokeObjectURL(item.url)
  }
  files.value = []
  selectedId.value = null
  clearResults()
  progress.active = false
  progress.done = 0
  progress.total = 0
  progress.label = ''
}

export function moveFile(id: string, direction: -1 | 1): void {
  const index = files.value.findIndex((item) => item.id === id)
  const target = index + direction
  if (index === -1 || target < 0 || target >= files.value.length) return
  const next = [...files.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  files.value = next
}

export function selectFile(id: string): void {
  selectedId.value = id
}

export function applyPreset(id: string): void {
  const preset = PRESETS.find((entry) => entry.id === id)
  if (!preset) return
  Object.assign(config, cloneConfig(preset.config))
}

export function resetConfig(): void {
  Object.assign(config, cloneConfig(DEFAULT_CONFIG))
}

export function clearResults(): void {
  for (const result of results.value) URL.revokeObjectURL(result.url)
  results.value = []
}

export function downloadResult(result: OutputResult): void {
  saveBlob(result.blob, result.name)
}

export async function runProcess(): Promise<void> {
  if (!files.value.length || progress.active) return
  clearResults()
  cancelToken.cancelled = false
  progress.active = true
  progress.done = 0
  progress.total = 0
  progress.label = 'Starting…'
  try {
    results.value = await processAll(files.value, config, output, progress, cancelToken)
    progress.label = cancelToken.cancelled ? 'Cancelled' : 'Done'
  } catch (error) {
    const failure = error as Error
    if (failure?.name === 'AbortError') {
      progress.label = 'Cancelled'
    } else {
      progress.label = 'Failed'
      showNotice(`Processing failed: ${failure?.message || 'unknown error'}`, 8000)
    }
  } finally {
    progress.active = false
  }
}

export function cancelProcess(): void {
  cancelToken.cancelled = true
}

// Dev-only hook used by the automated browser test (`scripts/e2e.mjs`).
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__wmTest = { files, config, output, progress, results }
}
