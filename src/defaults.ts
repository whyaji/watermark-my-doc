import type { OutputOptions, WatermarkConfig } from './types'

export const FONT_FAMILIES: string[] = [
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'Segoe UI',
  'Impact',
  'Comic Sans MS',
]

export const BLEND_MODES: { value: string; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color dodge' },
  { value: 'color-burn', label: 'Color burn' },
  { value: 'hard-light', label: 'Hard light' },
  { value: 'soft-light', label: 'Soft light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
]

export const DEFAULT_CONFIG: WatermarkConfig = {
  text: 'CONFIDENTIAL',
  fontFamily: 'Arial',
  fontSize: { value: 7, unit: '%' },
  bold: true,
  italic: false,
  letterSpacing: { value: 0, unit: 'px' },
  lineHeight: 1.25,
  fillMode: 'solid',
  color: '#1e293b',
  gradientColors: ['#6366f1', '#ec4899'],
  gradientAngle: 45,
  opacity: 40,
  blendMode: 'source-over',
  rotation: -30,
  strokeColor: '#ffffff',
  strokeWidth: { value: 0, unit: 'px' },
  shadow: {
    enabled: false,
    color: '#000000',
    blur: { value: 6, unit: 'px' },
    offsetX: { value: 2, unit: 'px' },
    offsetY: { value: 2, unit: 'px' },
  },
  layout: 'tile',
  anchor: 'center',
  offsetX: { value: 0, unit: 'px' },
  offsetY: { value: 0, unit: 'px' },
  margin: { value: 3, unit: '%' },
  tileSpacingX: { value: 6, unit: '%' },
  tileSpacingY: { value: 7, unit: '%' },
  tileOffsetX: { value: 0, unit: '%' },
  tileOffsetY: { value: 0, unit: '%' },
}

export const DEFAULT_OUTPUT: OutputOptions = {
  format: 'pdf',
  combine: false,
  imageFormat: 'png',
  quality: 0.92,
  imageScale: 100,
  pdfMode: 'raster',
  dpi: 150,
  suffix: '_watermarked',
  archiveName: 'watermarked',
}

export function cloneConfig(config: WatermarkConfig): WatermarkConfig {
  return JSON.parse(JSON.stringify(config)) as WatermarkConfig
}

export interface Preset {
  id: string
  name: string
  config: WatermarkConfig
}

export const PRESETS: Preset[] = [
  {
    id: 'classic',
    name: 'Diagonal tile',
    config: cloneConfig(DEFAULT_CONFIG),
  },
  {
    id: 'stamp',
    name: 'Corner stamp',
    config: {
      ...cloneConfig(DEFAULT_CONFIG),
      text: 'APPROVED',
      layout: 'single',
      anchor: 'bottom-right',
      rotation: -8,
      fontSize: { value: 4, unit: '%' },
      opacity: 95,
      color: '#dc2626',
      margin: { value: 3, unit: '%' },
      offsetX: { value: 0, unit: 'px' },
      offsetY: { value: 0, unit: 'px' },
    },
  },
  {
    id: 'center',
    name: 'Centered',
    config: {
      ...cloneConfig(DEFAULT_CONFIG),
      text: 'DRAFT',
      layout: 'single',
      anchor: 'center',
      rotation: -20,
      fontSize: { value: 14, unit: '%' },
      opacity: 22,
      color: '#0f172a',
    },
  },
  {
    id: 'gradient',
    name: 'Gradient',
    config: {
      ...cloneConfig(DEFAULT_CONFIG),
      text: 'SAMPLE',
      layout: 'single',
      anchor: 'center',
      rotation: -15,
      fontSize: { value: 12, unit: '%' },
      opacity: 85,
      fillMode: 'gradient',
      gradientColors: ['#6366f1', '#ec4899', '#f59e0b'],
      gradientAngle: 45,
      strokeColor: '#0f172a',
      strokeWidth: { value: 0.3, unit: '%' },
    },
  },
  {
    id: 'subtle',
    name: 'Subtle rows',
    config: {
      ...cloneConfig(DEFAULT_CONFIG),
      text: '© {name}',
      layout: 'tile',
      rotation: 0,
      fontSize: { value: 3, unit: '%' },
      opacity: 55,
      color: '#475569',
      bold: false,
      lineHeight: 1.4,
      tileSpacingX: { value: 4, unit: '%' },
      tileSpacingY: { value: 6, unit: '%' },
    },
  },
]
