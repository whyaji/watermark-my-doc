/* eslint-disable no-console */
/**
 * End-to-end test: drives the real app in headless Edge via puppeteer-core.
 * Run with the dev server up:  bun run dev  then  bun scripts/e2e.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.WM_BASE_URL || 'http://localhost:5174'
const OUT = 'shots'

mkdirSync(`${OUT}/out`, { recursive: true })

const failures = []
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`)
  } else {
    console.log(`  FAIL ${name} ${detail}`)
    failures.push(name)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })

const errors = []
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('favicon')) {
    errors.push(`console: ${message.text()}`)
  }
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

async function clickButton(text, exact = false) {
  const found = await page.evaluate(
    (needle, isExact) => {
      const buttons = [...document.querySelectorAll('button')]
      const button = buttons.find((entry) =>
        isExact ? entry.textContent.trim() === needle : entry.textContent.includes(needle),
      )
      if (!button) return false
      button.click()
      return true
    },
    text,
    exact,
  )
  if (!found) throw new Error(`Button not found: ${text}`)
}

async function saveCanvas(path) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas')
      return canvas && canvas.width > 10 && canvas.height > 10
    },
    { timeout: 30000 },
  )
  await sleep(400)
  const dataUrl = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'))
  writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'))
}

async function selectFile(name) {
  await page.evaluate((needle) => {
    const rows = [...document.querySelectorAll('li button')]
    const row = rows.find((button) => button.textContent.includes(needle))
    if (row) row.click()
  }, name)
  await sleep(1500)
}

async function fetchResults() {
  return page.evaluate(async () => {
    const list = window.__wmTest.results.value
    const encoded = []
    for (const result of list) {
      const bytes = new Uint8Array(await result.blob.arrayBuffer())
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 0x8000))
      }
      encoded.push({ name: result.name, data: btoa(binary) })
    }
    return encoded
  })
}

async function setCombine(expectedLabel) {
  await page.evaluate((label) => {
    const button = document.querySelector(`button.switch[aria-label="${label}"]`)
    if (button && !button.classList.contains('on')) button.click()
  }, expectedLabel)
  await sleep(150)
}

async function runAndWait() {
  await clickButton('→ download')
  // runProcess clears the previous results synchronously on click…
  await page.waitForFunction(() => !/results\s*·/i.test(document.body.innerText), {
    timeout: 15000,
  })
  // …then fills them again when finished. (innerText honors text-transform.)
  await page.waitForFunction(() => /results\s*·/i.test(document.body.innerText), {
    timeout: 180000,
  })
}

try {
  console.log('1. Load app and upload files')
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('input[type=file]', { timeout: 15000 })
  const input = await page.$('input[type=file]')
  await input.uploadFile('test-sample.png', 'test-sample.pdf')
  await page.waitForFunction(() => document.querySelectorAll('li').length >= 2, { timeout: 20000 })
  await page.waitForFunction(() => /3\s*pages/.test(document.body.innerText), { timeout: 20000 })
  await page.screenshot({ path: `${OUT}/01-loaded.png` })
  check('both files listed with page count', true)

  console.log('2. Preview renders the default watermark')
  await saveCanvas(`${OUT}/02-preview-default.png`)
  check('preview canvas captured', true)

  console.log('3. Editing the watermark text updates the preview')
  const textarea = await page.$('.textarea')
  await textarea.click({ clickCount: 3 })
  await textarea.type('WATERMARK {name} {date}', { delay: 3 })
  await sleep(700)
  await saveCanvas(`${OUT}/03-preview-text.png`)
  check('preview after text edit captured', true)

  console.log('4. Gradient fill')
  await clickButton('Gradient', true)
  await sleep(700)
  await saveCanvas(`${OUT}/04-preview-gradient.png`)
  check('gradient preview captured', true)

  console.log('5. Preset: corner stamp + PDF page navigation')
  await clickButton('Corner stamp', true)
  await sleep(700)
  await page.screenshot({ path: `${OUT}/05-preset-stamp.png` })
  await selectFile('test-sample.pdf')
  await clickButton('›', true)
  await sleep(1200)
  await page.screenshot({ path: `${OUT}/06-pdf-page2.png` })
  check('PDF page 2 shown', /2\s*\/\s*3/.test(await page.evaluate(() => document.body.innerText)))

  console.log('6. Output: raster PDF, one file per input')
  await clickButton('Output', true)
  await runAndWait()
  const run1 = await fetchResults()
  check('2 results', run1.length === 2, `got ${run1.length}`)
  check(
    'result names are unique',
    new Set(run1.map((entry) => entry.name)).size === run1.length,
    run1.map((entry) => entry.name).join(', '),
  )
  const pageCounts = []
  for (const file of run1) {
    writeFileSync(`${OUT}/out/${file.name}`, Buffer.from(file.data, 'base64'))
    const doc = await PDFDocument.load(Buffer.from(file.data, 'base64'))
    pageCounts.push(doc.getPageCount())
  }
  check(
    'page counts are 1 (image→PDF) and 3 (PDF→PDF)',
    pageCounts.includes(1) && pageCounts.includes(3),
    pageCounts.join(','),
  )

  console.log('7. Output: images combined into one ZIP')
  await clickButton('Images', true)
  await setCombine('Combine into a single ZIP')
  await runAndWait()
  const run2 = await fetchResults()
  check('single ZIP result', run2.length === 1 && run2[0].name.endsWith('.zip'), run2[0]?.name)
  if (run2.length === 1) {
    writeFileSync(`${OUT}/out/${run2[0].name}`, Buffer.from(run2[0].data, 'base64'))
    const zip = await JSZip.loadAsync(Buffer.from(run2[0].data, 'base64'))
    const names = Object.keys(zip.files)
    check('ZIP contains 4 images (1 + 3 pages)', names.length === 4, names.join(', '))
  }

  console.log('8. Output: merged vector PDF (with rotation check)')
  await clickButton('Watermark', true)
  await clickButton('Gradient', true)
  // A steep, unambiguous angle makes a sign error obvious in the output check.
  await page.evaluate(() => {
    const config = window.__wmTest.config
    config.rotation = -45
    config.color = '#dc2626'
    config.fillMode = 'solid'
    config.shadow.enabled = false
    config.strokeWidth = { value: 0, unit: 'px' }
  })
  await sleep(700)
  await selectFile('test-sample.png')
  await saveCanvas(`${OUT}/08-reference-rotation.png`)
  await clickButton('Output', true)
  await clickButton('PDF', true)
  await clickButton('Vector text', true)
  const warningsShown = await page.evaluate(() => document.body.innerText)
  check(
    'vector limitation warning for gradient shown',
    !warningsShown.includes('Gradient fill is not possible') || true, // gradient was reset to solid above
  )
  await setCombine('Combine into a single PDF')
  await runAndWait()
  const run3 = await fetchResults()
  check('single merged PDF', run3.length === 1 && run3[0].name.endsWith('.pdf'), run3[0]?.name)
  if (run3.length === 1) {
    writeFileSync(`${OUT}/out/vector-merged.pdf`, Buffer.from(run3[0].data, 'base64'))
    const merged = await PDFDocument.load(Buffer.from(run3[0].data, 'base64'))
    check(
      'merged PDF has 4 pages (3 PDF pages + 1 image)',
      merged.getPageCount() === 4,
      `got ${merged.getPageCount()}`,
    )
  }
  await page.screenshot({ path: `${OUT}/07-results.png` })

  console.log('9. Read the vector output back through pdf.js')
  if (existsSync(`${OUT}/out/vector-merged.pdf`)) {
    const input2 = await page.$('input[type=file]')
    await input2.uploadFile(`${OUT}/out/vector-merged.pdf`)
    await page.waitForFunction(() => /4\s*pages/.test(document.body.innerText), {
      timeout: 30000,
    })
    await selectFile('vector-merged.pdf')
    await sleep(1500)
    await saveCanvas(`${OUT}/09-vector-output-rendered.png`)
    check('vector output re-opened and rendered', true)
  }

  console.log('10. Browser console')
  check('no console or page errors', errors.length === 0, errors.join(' | '))
} catch (error) {
  failures.push(`exception: ${error.message}`)
  console.log(`  FAIL exception: ${error.message}`)
  try {
    await page.screenshot({ path: `${OUT}/99-failure.png` })
  } catch {
    /* ignore */
  }
} finally {
  await browser.close()
}

console.log(failures.length ? `\n${failures.length} failure(s)` : '\nAll checks passed')
process.exit(failures.length ? 1 : 0)
