import type { ImageFormat, TokenContext, WatermarkConfig } from '../types'
import { mimeFor } from './files'
import { drawWatermark } from './watermark'

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      /* fall through to <img> decoding (e.g. SVG) */
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error(`Cannot decode ${file.name}`))
      element.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

/** Decode an image and paint it onto a fresh canvas (no watermark). */
export async function rasterizeImage(file: File, scale = 1): Promise<HTMLCanvasElement> {
  const decoded = await decodeImage(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(decoded.width * scale))
    canvas.height = Math.max(1, Math.round(decoded.height * scale))
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    decoded.release()
  }
}

/** Decode an image and paint it with the watermark applied. */
export async function watermarkImage(
  file: File,
  config: WatermarkConfig,
  options: { scale: number; tokens?: TokenContext },
): Promise<HTMLCanvasElement> {
  const decoded = await decodeImage(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(decoded.width * options.scale))
    canvas.height = Math.max(1, Math.round(decoded.height * options.scale))
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)
    drawWatermark(ctx, canvas.width, canvas.height, config, {
      scale: options.scale,
      tokens: options.tokens,
    })
    return canvas
  } finally {
    decoded.release()
  }
}

export async function imageSize(file: File): Promise<{ width: number; height: number }> {
  const decoded = await decodeImage(file)
  const size = { width: decoded.width, height: decoded.height }
  decoded.release()
  return size
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))),
      mime,
      quality,
    )
  })
}

/**
 * Encode a canvas. JPEG has no alpha channel, so transparent pixels are
 * flattened onto white (JPEG would otherwise render them black).
 */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number,
): Promise<Blob> {
  if (format !== 'jpeg') {
    return canvasToBlob(canvas, mimeFor(format), quality)
  }
  const flat = document.createElement('canvas')
  flat.width = canvas.width
  flat.height = canvas.height
  const ctx = flat.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(canvas, 0, 0)
  return canvasToBlob(flat, 'image/jpeg', quality)
}
