<script setup lang="ts">
defineProps<{ label: string; modelValue: boolean; hint?: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <div class="min-w-0">
      <span class="label label-flat">{{ label }}</span>
      <p v-if="hint" class="hint">{{ hint }}</p>
    </div>
    <button
      type="button"
      class="switch"
      :class="{ on: modelValue }"
      :aria-pressed="modelValue"
      :aria-label="label"
      @click="emit('update:modelValue', !modelValue)"
    />
  </div>
</template>
