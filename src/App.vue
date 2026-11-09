<script setup lang="ts">
import { ref } from 'vue'
import ConfigPanel from './components/ConfigPanel.vue'
import Dropzone from './components/Dropzone.vue'
import FileList from './components/FileList.vue'
import OutputPanel from './components/OutputPanel.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import { addFiles, clearFiles, hasFiles, notice } from './store'

const tab = ref<'watermark' | 'output'>('watermark')

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const dropped = event.dataTransfer?.files
  if (dropped?.length) void addFiles(dropped)
}
</script>

<template>
  <div class="flex min-h-screen flex-col" @dragover.prevent @drop.prevent="onDrop">
    <header class="border-b border-slate-800/70 bg-slate-950/60 backdrop-blur">
      <div class="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
        <div class="flex items-center gap-2.5">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/50"
          >
            <svg
              class="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M14 3v5h5" />
              <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5z" />
              <path d="M9 12.5h6" />
              <path d="M9 16h4" />
            </svg>
          </div>
          <div>
            <h1 class="text-sm font-bold tracking-tight text-slate-100">Watermark My Doc</h1>
            <p class="text-[0.65rem] text-slate-500">Images &amp; PDFs · text watermarks</p>
          </div>
        </div>

        <span class="chip chip-ok ml-auto">Files never leave your browser</span>

        <button v-if="hasFiles" type="button" class="btn btn-ghost btn-xs" @click="clearFiles">
          Clear all
        </button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
      <Dropzone v-if="!hasFiles" big />

      <div
        v-else
        class="grid gap-4 lg:h-[calc(100vh-8.5rem)] lg:grid-cols-[250px_minmax(0,1fr)_400px]"
      >
        <FileList class="min-h-0" />
        <PreviewPanel class="min-h-0" />
        <div class="flex min-h-0 flex-col gap-3">
          <div class="seg">
            <button
              type="button"
              :class="{ active: tab === 'watermark' }"
              @click="tab = 'watermark'"
            >
              Watermark
            </button>
            <button type="button" :class="{ active: tab === 'output' }" @click="tab = 'output'">
              Output
            </button>
          </div>
          <ConfigPanel v-show="tab === 'watermark'" />
          <OutputPanel v-show="tab === 'output'" />
        </div>
      </div>
    </main>

    <footer class="border-t border-slate-800/70 py-3">
      <p class="mx-auto max-w-[1600px] px-4 text-center text-[0.65rem] text-slate-600">
        Processing runs entirely on your device with Vue, pdf.js, pdf-lib and JSZip — nothing is
        uploaded to any server.
      </p>
    </footer>

    <transition name="notice">
      <div
        v-if="notice"
        class="fixed bottom-5 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-slate-200 shadow-2xl"
      >
        {{ notice }}
      </div>
    </transition>
  </div>
</template>
