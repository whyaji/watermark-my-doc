<script setup lang="ts">
import { clampNum } from '../../lib/watermark'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue: number
    min: number
    max: number
    step?: number
    unit?: string
    hint?: string
  }>(),
  { step: 1, unit: '', hint: '' },
)

const emit = defineEmits<{ (event: 'update:modelValue', value: number): void }>()

function commit(raw: string): void {
  if (raw.trim() === '' || raw === '-') return
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  emit('update:modelValue', clampNum(value, props.min, props.max))
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
          :max="max"
          :step="step"
          :value="modelValue"
          @input="commit(($event.target as HTMLInputElement).value)"
        />
        <span v-if="unit" class="w-5 text-[0.65rem] text-slate-500">{{ unit }}</span>
      </div>
    </div>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="commit(($event.target as HTMLInputElement).value)"
    />
    <p v-if="hint" class="hint mt-1">{{ hint }}</p>
  </div>
</template>
