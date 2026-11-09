<script setup lang="ts">
import { ref, watch } from 'vue'
import { isValidHex, normalizeHex } from '../../lib/colors'

const props = defineProps<{ label: string; modelValue: string; hint?: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()

const text = ref(props.modelValue)

watch(
  () => props.modelValue,
  (value) => {
    text.value = value
  },
)

function onSwatch(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  text.value = value
  emit('update:modelValue', value)
}

function onText(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  text.value = value
  if (isValidHex(value)) emit('update:modelValue', normalizeHex(value))
}

function commit(): void {
  const normalized = normalizeHex(text.value, props.modelValue)
  text.value = normalized
  emit('update:modelValue', normalized)
}
</script>

<template>
  <div>
    <span class="label">{{ label }}</span>
    <div class="flex items-center gap-1.5">
      <input type="color" :value="modelValue" @input="onSwatch" />
      <input
        class="input flex-1 uppercase"
        :value="text"
        spellcheck="false"
        autocomplete="off"
        @input="onText"
        @blur="commit"
      />
    </div>
    <p v-if="hint" class="hint mt-1">{{ hint }}</p>
  </div>
</template>
