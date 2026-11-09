<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { BLEND_MODES, FONT_FAMILIES, PRESETS } from '../defaults'
import { applyPreset, config, resetConfig } from '../store'
import AnchorGrid from './ui/AnchorGrid.vue'
import ColorField from './ui/ColorField.vue'
import MeasureField from './ui/MeasureField.vue'
import RangeField from './ui/RangeField.vue'
import Segmented from './ui/Segmented.vue'
import SelectField from './ui/SelectField.vue'
import ToggleField from './ui/ToggleField.vue'

const textarea = ref<HTMLTextAreaElement | null>(null)

const fontOptions = FONT_FAMILIES.map((family) => ({ value: family, label: family }))
const fillOptions = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
]
const layoutOptions = [
  { value: 'single', label: 'Single' },
  { value: 'tile', label: 'Repeat (tile)' },
]
const tokenList = ['{name}', '{date}', '{page}', '{pages}', '{filename}', '{time}']

const showShadow = computed(() => config.shadow.enabled)
const showGradient = computed(() => config.fillMode === 'gradient')

function insertToken(token: string): void {
  const element = textarea.value
  const text = config.text
  if (!element) {
    config.text = text + token
    return
  }
  const start = element.selectionStart ?? text.length
  const end = element.selectionEnd ?? start
  config.text = text.slice(0, start) + token + text.slice(end)
  void nextTick(() => {
    element.focus()
    const caret = start + token.length
    element.setSelectionRange(caret, caret)
  })
}

function addGradientStop(): void {
  if (config.gradientColors.length >= 4) return
  config.gradientColors.push(config.gradientColors[config.gradientColors.length - 1] ?? '#6366f1')
}

function removeGradientStop(index: number): void {
  if (config.gradientColors.length <= 2) return
  config.gradientColors.splice(index, 1)
}
</script>

<template>
  <div class="panel flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex items-center justify-between gap-2 border-b border-slate-800/70 px-4 py-2.5">
      <h2 class="section-title">Watermark settings</h2>
      <button type="button" class="btn btn-ghost btn-xs" @click="resetConfig">Reset</button>
    </div>

    <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
      <!-- Presets -->
      <div>
        <span class="label">Presets</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="preset in PRESETS"
            :key="preset.id"
            type="button"
            class="chip transition-colors hover:border-indigo-400/60 hover:text-indigo-200"
            @click="applyPreset(preset.id)"
          >
            {{ preset.name }}
          </button>
        </div>
      </div>

      <!-- Text -->
      <section class="space-y-3">
        <h3 class="section-title">Text</h3>

        <div>
          <span class="label">Watermark text · multi-line supported</span>
          <textarea
            ref="textarea"
            v-model="config.text"
            class="textarea"
            rows="3"
            placeholder="CONFIDENTIAL"
            spellcheck="false"
          />
          <div class="mt-1.5 flex flex-wrap gap-1">
            <button
              v-for="token in tokenList"
              :key="token"
              type="button"
              class="token-btn"
              :title="`Insert ${token}`"
              @click="insertToken(token)"
            >
              {{ token }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <SelectField label="Font" v-model="config.fontFamily" :options="fontOptions" />
          <MeasureField
            label="Size"
            v-model="config.fontSize"
            :max-px="400"
            :max-pct="60"
            hint="% of the shorter side"
          />
        </div>

        <div class="flex items-end gap-3">
          <div class="flex gap-1.5 pb-4">
            <button
              type="button"
              class="btn btn-xs"
              :class="{ 'btn-primary': config.bold }"
              title="Bold"
              @click="config.bold = !config.bold"
            >
              <span class="font-bold">B</span>
            </button>
            <button
              type="button"
              class="btn btn-xs italic"
              :class="{ 'btn-primary': config.italic }"
              title="Italic"
              @click="config.italic = !config.italic"
            >
              I
            </button>
          </div>
          <div class="min-w-0 flex-1">
            <RangeField
              label="Line height"
              v-model="config.lineHeight"
              :min="0.8"
              :max="3"
              :step="0.05"
              unit="×"
            />
          </div>
        </div>

        <MeasureField
          label="Letter spacing"
          v-model="config.letterSpacing"
          :min="-20"
          :max-px="80"
          :max-pct="20"
        />
      </section>

      <!-- Color & effects -->
      <section class="space-y-3">
        <h3 class="section-title">Color &amp; effects</h3>

        <div>
          <span class="label">Fill</span>
          <Segmented v-model="config.fillMode" :options="fillOptions" />
        </div>

        <ColorField v-if="!showGradient" label="Color" v-model="config.color" />

        <div v-else class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="label label-flat">Gradient stops</span>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              :disabled="config.gradientColors.length >= 4"
              @click="addGradientStop"
            >
              + Stop
            </button>
          </div>
          <div
            v-for="(stop, index) in config.gradientColors"
            :key="index"
            class="flex items-end gap-1.5"
          >
            <div class="min-w-0 flex-1">
              <ColorField
                :label="`Stop ${index + 1}`"
                :model-value="stop"
                @update:model-value="config.gradientColors[index] = $event"
              />
            </div>
            <button
              type="button"
              class="icon-btn mb-1"
              title="Remove stop"
              :disabled="config.gradientColors.length <= 2"
              @click="removeGradientStop(index)"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <RangeField
            label="Gradient angle"
            v-model="config.gradientAngle"
            :min="0"
            :max="360"
            unit="°"
          />
        </div>

        <RangeField label="Opacity" v-model="config.opacity" :min="0" :max="100" unit="%" />
        <RangeField
          label="Rotation"
          v-model="config.rotation"
          :min="-180"
          :max="180"
          unit="°"
          hint="Degrees, clockwise"
        />
        <SelectField label="Blend mode" v-model="config.blendMode" :options="BLEND_MODES" />

        <div class="grid grid-cols-2 gap-3">
          <ColorField label="Outline color" v-model="config.strokeColor" />
          <MeasureField
            label="Outline width"
            v-model="config.strokeWidth"
            :max-px="40"
            :max-pct="5"
          />
        </div>

        <ToggleField label="Drop shadow" v-model="config.shadow.enabled" />
        <div v-if="showShadow" class="grid grid-cols-2 gap-3">
          <ColorField label="Shadow color" v-model="config.shadow.color" />
          <MeasureField label="Blur" v-model="config.shadow.blur" :max-px="60" :max-pct="10" />
          <MeasureField
            label="Offset X"
            v-model="config.shadow.offsetX"
            :min="-50"
            :max-px="60"
            :max-pct="10"
          />
          <MeasureField
            label="Offset Y"
            v-model="config.shadow.offsetY"
            :min="-50"
            :max-px="60"
            :max-pct="10"
          />
        </div>
      </section>

      <!-- Placement -->
      <section class="space-y-3">
        <h3 class="section-title">Placement</h3>

        <Segmented v-model="config.layout" :options="layoutOptions" />

        <template v-if="config.layout === 'single'">
          <div class="flex gap-4">
            <div>
              <span class="label">Position</span>
              <AnchorGrid v-model="config.anchor" />
            </div>
            <div class="min-w-0 flex-1 space-y-3">
              <MeasureField
                label="Edge margin"
                v-model="config.margin"
                :max-px="200"
                :max-pct="40"
              />
              <MeasureField
                label="Offset X"
                v-model="config.offsetX"
                :min="-100"
                :max-px="300"
                :max-pct="50"
              />
              <MeasureField
                label="Offset Y"
                v-model="config.offsetY"
                :min="-100"
                :max-px="300"
                :max-pct="50"
              />
            </div>
          </div>
        </template>

        <template v-else>
          <div class="grid grid-cols-2 gap-3">
            <MeasureField
              label="Spacing X"
              v-model="config.tileSpacingX"
              :max-px="500"
              :max-pct="100"
            />
            <MeasureField
              label="Spacing Y"
              v-model="config.tileSpacingY"
              :max-px="500"
              :max-pct="100"
            />
            <MeasureField
              label="Grid offset X"
              v-model="config.tileOffsetX"
              :min="-100"
              :max-px="500"
              :max-pct="100"
            />
            <MeasureField
              label="Grid offset Y"
              v-model="config.tileOffsetY"
              :min="-100"
              :max-px="500"
              :max-pct="100"
            />
          </div>
          <p class="hint">
            Values in <code class="text-indigo-300">%</code> scale with the document, so the look
            stays identical across page sizes and image resolutions.
          </p>
        </template>
      </section>
    </div>
  </div>
</template>
