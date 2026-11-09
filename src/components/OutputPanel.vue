<script setup lang="ts">
import { computed } from 'vue'
import {
  cancelProcess,
  clearResults,
  config,
  files,
  output,
  progress,
  results,
  runProcess,
} from '../store'
import { formatBytes, saveBlob } from '../lib/files'
import { vectorLimitations } from '../lib/pdfOut'
import RangeField from './ui/RangeField.vue'
import Segmented from './ui/Segmented.vue'
import ToggleField from './ui/ToggleField.vue'

const formatOptions = [
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Images' },
]
const imageFormatOptions = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
]
const pdfModeOptions = [
  { value: 'vector', label: 'Vector text' },
  { value: 'raster', label: 'Raster image' },
]
const dpiOptions = [
  { value: '96', label: '96 dpi · screen' },
  { value: '150', label: '150 dpi · web' },
  { value: '300', label: '300 dpi · print' },
]

const hasPdfInput = computed(() => files.value.some((item) => item.kind === 'pdf'))
const hasImageInput = computed(() => files.value.some((item) => item.kind === 'image'))

const warnings = computed(() =>
  output.format === 'pdf' && output.pdfMode === 'vector' ? vectorLimitations(config) : [],
)

const progressPercent = computed(() =>
  progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0,
)

const combineHint = computed(() =>
  output.format === 'pdf'
    ? 'All inputs and pages become one merged PDF'
    : 'Every produced image is packed into one ZIP',
)

function setDpi(event: Event): void {
  output.dpi = Number((event.target as HTMLSelectElement).value)
}

function downloadAll(): void {
  results.value.forEach((result, index) => {
    setTimeout(() => saveBlob(result.blob, result.name), index * 250)
  })
}
</script>

<template>
  <div class="panel flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="border-b border-slate-800/70 px-4 py-2.5">
      <h2 class="section-title">Output</h2>
    </div>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div>
        <span class="label">Format</span>
        <Segmented v-model="output.format" :options="formatOptions" />
      </div>

      <ToggleField
        :label="
          output.format === 'pdf' ? 'Combine into a single PDF' : 'Combine into a single ZIP'
        "
        v-model="output.combine"
        :hint="combineHint"
      />

      <div v-if="output.combine">
        <span class="label">File name</span>
        <div class="flex items-center gap-1.5">
          <input
            v-model.trim="output.archiveName"
            class="input"
            placeholder="watermarked"
            spellcheck="false"
          />
          <span class="text-xs text-slate-500">
            .{{ output.format === 'pdf' ? 'pdf' : 'zip' }}
          </span>
        </div>
      </div>
      <div v-else>
        <span class="label">Name suffix</span>
        <input v-model="output.suffix" class="input" placeholder="_watermarked" spellcheck="false" />
      </div>

      <!-- Image output options -->
      <template v-if="output.format === 'image'">
        <div>
          <span class="label">Image format</span>
          <Segmented v-model="output.imageFormat" :options="imageFormatOptions" />
        </div>

        <RangeField
          v-if="output.imageFormat !== 'png'"
          label="Quality"
          v-model="output.quality"
          :min="0.1"
          :max="1"
          :step="0.01"
        />

        <RangeField
          v-if="hasImageInput"
          label="Image output scale"
          v-model="output.imageScale"
          :min="25"
          :max="100"
          :step="5"
          unit="%"
          hint="Resize image inputs while watermarking"
        />

        <div v-if="hasPdfInput">
          <span class="label">PDF → image resolution</span>
          <select class="select" :value="output.dpi" @change="setDpi">
            <option v-for="option in dpiOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </template>

      <!-- PDF output options -->
      <template v-else>
        <div>
          <span class="label">Watermark mode</span>
          <Segmented v-model="output.pdfMode" :options="pdfModeOptions" />
          <p class="hint mt-1.5">
            <strong class="text-slate-400">Vector</strong> keeps pages as real text — selectable,
            tiny files, solid color only.
            <strong class="text-slate-400">Raster</strong> renders pages as images — every style
            works (gradient, outline, shadow).
          </p>
        </div>

        <div v-if="output.pdfMode === 'raster'">
          <span class="label">Page resolution</span>
          <select class="select" :value="output.dpi" @change="setDpi">
            <option v-for="option in dpiOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <RangeField
          v-if="output.pdfMode === 'raster'"
          label="Page image quality"
          v-model="output.quality"
          :min="0.5"
          :max="1"
          :step="0.01"
        />
      </template>

      <ul v-if="warnings.length" class="space-y-1.5">
        <li
          v-for="warning in warnings"
          :key="warning"
          class="chip chip-warn w-full whitespace-normal py-1.5 leading-snug"
        >
          {{ warning }}
        </li>
      </ul>

      <!-- Run -->
      <div class="space-y-2 border-t border-slate-800/70 pt-4">
        <button
          v-if="!progress.active"
          type="button"
          class="btn btn-primary w-full"
          :disabled="!files.length"
          @click="runProcess"
        >
          Watermark {{ files.length }} file{{ files.length === 1 ? '' : 's' }} → download
        </button>
        <button v-else type="button" class="btn w-full" @click="cancelProcess">Cancel</button>

        <div v-if="progress.active || progress.label">
          <div class="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-200"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
          <div class="mt-1 flex justify-between text-[0.65rem] text-slate-500">
            <span class="truncate pr-2">{{ progress.label }}</span>
            <span v-if="progress.total" class="flex-none">
              {{ progress.done }}/{{ progress.total }}
            </span>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div v-if="results.length" class="space-y-2 border-t border-slate-800/70 pt-4">
        <div class="flex items-center justify-between">
          <h3 class="section-title">Results · {{ results.length }}</h3>
          <div class="flex gap-1">
            <button
              v-if="results.length > 1"
              type="button"
              class="btn btn-ghost btn-xs"
              @click="downloadAll"
            >
              Download all
            </button>
            <button type="button" class="btn btn-ghost btn-xs" @click="clearResults">Clear</button>
          </div>
        </div>

        <ul class="space-y-1.5">
          <li
            v-for="result in results"
            :key="result.id"
            class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs text-slate-200">{{ result.name }}</p>
              <p class="text-[0.62rem] text-slate-500">{{ formatBytes(result.size) }}</p>
            </div>
            <button type="button" class="btn btn-xs" @click="saveBlob(result.blob, result.name)">
              Save
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
