<script setup lang="ts">
import { ref } from 'vue'
import { addFiles } from '../store'

withDefaults(defineProps<{ big?: boolean }>(), { big: false })

const dragging = ref(false)
const input = ref<HTMLInputElement | null>(null)

function onDrop(event: DragEvent): void {
  event.stopPropagation()
  dragging.value = false
  const dropped = event.dataTransfer?.files
  if (dropped?.length) void addFiles(dropped)
}

function onPick(event: Event): void {
  const target = event.target as HTMLInputElement
  if (target.files?.length) void addFiles(target.files)
  target.value = ''
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center transition-colors"
    :class="[
      big ? 'py-16' : 'py-6',
      dragging
        ? 'drop-active'
        : 'border-slate-700 bg-slate-900/40 hover:border-indigo-500/60 hover:bg-slate-900/60',
    ]"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
    @click="input?.click()"
  >
    <svg
      class="h-10 w-10 text-indigo-400/80"
      :class="big ? 'h-14 w-14' : 'h-9 w-9'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>

    <div>
      <p class="font-semibold text-slate-200">
        Drag &amp; drop your files here
        <span v-if="big">or click to browse</span>
      </p>
      <p class="mt-1 text-xs text-slate-500">
        Images (PNG, JPG, WebP, GIF…) and PDF documents — multiple files supported
      </p>
    </div>

    <button type="button" class="btn btn-primary" @click.stop="input?.click()">
      Choose files
    </button>

    <p class="chip chip-ok">100% in your browser — files are never uploaded</p>

    <input
      ref="input"
      type="file"
      multiple
      accept="image/*,.pdf,application/pdf"
      class="hidden"
      @change="onPick"
    />
  </div>
</template>
