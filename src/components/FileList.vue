<script setup lang="ts">
import { ref } from 'vue'
import { addFiles, files, moveFile, removeFile, selectFile, selectedId } from '../store'
import { formatBytes } from '../lib/files'

const input = ref<HTMLInputElement | null>(null)

function onPick(event: Event): void {
  const target = event.target as HTMLInputElement
  if (target.files?.length) void addFiles(target.files)
  target.value = ''
}
</script>

<template>
  <div class="panel flex max-h-[22rem] min-h-0 flex-col overflow-hidden lg:max-h-none">
    <div class="flex items-center justify-between border-b border-slate-800/70 px-3 py-2.5">
      <h2 class="section-title">Files · {{ files.length }}</h2>
      <button class="btn btn-ghost btn-xs" type="button" @click="input?.click()">+ Add</button>
    </div>

    <ul class="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
      <li
        v-for="(item, index) in files"
        :key="item.id"
        class="group flex items-center gap-1 rounded-lg p-1 transition-colors"
        :class="
          item.id === selectedId
            ? 'bg-indigo-500/15 ring-1 ring-indigo-400/40'
            : 'hover:bg-slate-800/60'
        "
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 rounded p-1 text-left"
          :title="item.name"
          @click="selectFile(item.id)"
        >
          <img
            v-if="item.url"
            :src="item.url"
            alt=""
            class="h-9 w-9 flex-none rounded object-cover ring-1 ring-slate-700/70"
          />
          <div
            v-else
            class="flex h-9 w-9 flex-none items-center justify-center rounded bg-slate-800 text-[0.6rem] font-bold text-indigo-300 ring-1 ring-slate-700/70"
          >
            PDF
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs text-slate-200">{{ item.name }}</p>
            <p class="truncate text-[0.62rem] text-slate-500">
              <template v-if="item.kind === 'pdf'">
                {{ item.pages == null ? 'reading…' : `${item.pages} page${item.pages === 1 ? '' : 's'}` }}
              </template>
              <template v-else>Image</template>
              · {{ formatBytes(item.size) }}
            </p>
            <p v-if="item.error" class="truncate text-[0.62rem] text-rose-400">{{ item.error }}</p>
          </div>
        </button>

        <div class="flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            class="icon-btn"
            title="Move up"
            :disabled="index === 0"
            @click="moveFile(item.id, -1)"
          >
            <span aria-hidden="true">▲</span>
          </button>
          <button
            type="button"
            class="icon-btn"
            title="Move down"
            :disabled="index === files.length - 1"
            @click="moveFile(item.id, 1)"
          >
            <span aria-hidden="true">▼</span>
          </button>
        </div>
        <button
          type="button"
          class="icon-btn"
          title="Remove file"
          @click="removeFile(item.id)"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </li>
    </ul>

    <div class="border-t border-slate-800/70 p-2">
      <button
        type="button"
        class="btn w-full justify-center border-dashed text-xs"
        @click="input?.click()"
      >
        + Add more files
      </button>
      <input
        ref="input"
        type="file"
        multiple
        accept="image/*,.pdf,application/pdf"
        class="hidden"
        @change="onPick"
      />
    </div>
  </div>
</template>
