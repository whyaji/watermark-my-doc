/** Parse a hex color (`#rgb` or `#rrggbb`) into RGB components in the 0–1 range. */
export function hexToRgb01(hex: string): [number, number, number] {
  let value = (hex || '').trim().replace(/^#/, '')
  if (value.length === 3) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return [0, 0, 0]
  const int = parseInt(value, 16)
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255]
}

/** Hex color → `rgba()` string. */
export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb01(hex)
  const clamped = Math.min(1, Math.max(0, alpha))
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${clamped})`
}

export function isValidHex(value: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
}

export function normalizeHex(value: string, fallback = '#000000'): string {
  const trimmed = value.trim()
  if (!isValidHex(trimmed)) return fallback
  let hex = trimmed.replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('')
  }
  return `#${hex.toLowerCase()}`
}
