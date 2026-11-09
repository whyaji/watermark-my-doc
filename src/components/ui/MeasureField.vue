<script setup lang="ts">
import { computed } from 'vue'
import { clampNum } from '../../lib/watermark'
import type { Measure } from '../../types'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue: Measure
    min?: number
    maxPx?: number
    maxPct?: number
    hint?: string
  }>(),
  { min: 0, maxPx: 400, maxPct: 100, hint: '' },
)

const emit = defineEmits<{ (event: 'update:modelValue', value: Measure): void }>()

const sliderMax = computed(() => (props.modelValue.unit === '%' ? props.maxPct : props.maxPx))
const step = computed(() => (props.modelValue.unit === '%' ? 0.5 : 1))

function updateValue(raw: string): void {
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  emit('update:modelValue', {
    value: clampNum(value, props.min, sliderMax.value),
    unit: props.modelValue.unit,
  })
}

function onUnit(event: Event): void {
  const unit = (event.target as HTMLSelectElement).value === '%' ? '%' : 'px'
  const max = unit === '%' ? props.maxPct : props.maxPx
  emit('update:modelValue', {
    value: clampNum(props.modelValue.value, props.min, max),
    unit,
  })
}
</script>

<template>
  <div>
    <div class="mb-1 flex items-center justify-between gap-2">
      <span class="label label-flat">{{ label }}</span>
      <div class="flex items-center gap-1">
        <input
          class="input input-num"
          type="number"
          :min="min"
          :max="sliderMax"
          :step="step"
          :value="modelValue.value"
          @input="updateValue(($event.target as HTMLInputElement).value)"
        />
        <select class="select select-sm" :value="modelValue.unit" @change="onUnit">
          <option value="px">px</option>
          <option value="%">%</option>
        </select>
      </div>
    </div>
    <input
      type="range"
      :min="min"
      :max="sliderMax"
      :step="step"
      :value="modelValue.value"
      @input="updateValue(($event.target as HTMLInputElement).value)"
    />
    <p v-if="hint" class="hint mt-1">{{ hint }}</p>
  </div>
</template>
