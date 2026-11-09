<script setup lang="ts">
import type { Anchor } from '../../types'

defineProps<{ modelValue: Anchor }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: Anchor): void }>()

const anchors: { value: Anchor; title: string }[] = [
  { value: 'top-left', title: 'Top left' },
  { value: 'top-center', title: 'Top center' },
  { value: 'top-right', title: 'Top right' },
  { value: 'middle-left', title: 'Middle left' },
  { value: 'center', title: 'Center' },
  { value: 'middle-right', title: 'Middle right' },
  { value: 'bottom-left', title: 'Bottom left' },
  { value: 'bottom-center', title: 'Bottom center' },
  { value: 'bottom-right', title: 'Bottom right' },
]
</script>

<template>
  <div class="anchor-grid">
    <button
      v-for="anchor in anchors"
      :key="anchor.value"
      type="button"
      :title="anchor.title"
      :aria-label="anchor.title"
      :class="{ active: anchor.value === modelValue }"
      @click="emit('update:modelValue', anchor.value)"
    />
  </div>
</template>
