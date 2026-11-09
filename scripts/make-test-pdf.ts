/* Generates a small 3-page test PDF for manual testing. */
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { writeFileSync } from 'node:fs'

const doc = await PDFDocument.create()
const font = await doc.embedFont(StandardFonts.Helvetica)
const bold = await doc.embedFont(StandardFonts.HelveticaBold)

for (let i = 1; i <= 3; i++) {
  const page = doc.addPage([595, 842])
  page.drawText(`Test document — page ${i} of 3`, {
    x: 60,
    y: 760,
    size: 22,
    font: bold,
    color: rgb(0.1, 0.1, 0.2),
  })
  page.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit.', {
    x: 60,
    y: 720,
    size: 13,
    font,
    color: rgb(0.25, 0.28, 0.35),
  })
  page.drawRectangle({
    x: 60,
    y: 200,
    width: 200,
    height: 120,
    color: rgb(0.85, 0.9, 0.98),
    rotate: degrees(0),
  })
  page.drawText(`Box ${i}`, { x: 80, y: 255, size: 16, font, color: rgb(0.2, 0.3, 0.7) })
  for (let line = 0; line < 14; line++) {
    page.drawText('Body text line ' + (line + 1) + ' — select me to verify text stays vector.', {
      x: 60,
      y: 660 - line * 22,
      size: 11,
      font,
      color: rgb(0.35, 0.38, 0.45),
    })
  }
}

writeFileSync('test-sample.pdf', await doc.save())
console.log('test-sample.pdf written')
