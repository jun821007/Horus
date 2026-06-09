import sharp from 'sharp'
import { createWorker, PSM, type Worker } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng', 1, { logger: () => {} })
      await worker.setParameters({ tessedit_char_whitelist: '0123456789' })
      return worker
    })()
  }
  return workerPromise
}

type OcrHit = { digits: string; conf: number }

function isImageBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false
  if (buf.slice(0, 3).toString() === 'GIF') return true
  if (buf[0] === 0x89 && buf[1] === 0x50) return true
  if (buf[0] === 0xff && buf[1] === 0xd8) return true
  return false
}

async function toPng(image: Buffer, scale: number): Promise<{ buf: Buffer; width: number; height: number }> {
  const meta = await sharp(image, { animated: false, pages: 1 }).metadata()
  const w = meta.width ?? 80
  const h = meta.height ?? 30
  const width = w * scale
  const height = h * scale
  const buf = await sharp(image, { animated: false, pages: 1 })
    .flatten({ background: '#ffffff' })
    .resize(width, height, { kernel: sharp.kernel.nearest })
    .grayscale()
    .normalize()
    .withMetadata({ density: 300 })
    .png()
    .toBuffer()
  return { buf, width, height }
}

async function ocrLine(worker: Worker, image: Buffer): Promise<OcrHit> {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE })
  const { data } = await worker.recognize(image)
  return { digits: (data.text ?? '').replace(/\D/g, '').slice(0, 4), conf: data.confidence ?? 0 }
}

async function ocrSlices(worker: Worker, image: Buffer, width: number, height: number): Promise<OcrHit> {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR })
  const sliceW = Math.max(1, Math.floor(width / 4))
  let digits = ''
  let confSum = 0
  for (let i = 0; i < 4; i += 1) {
    const left = Math.min(i * sliceW, Math.max(0, width - sliceW))
    const slice = await sharp(image)
      .extract({ left, top: 0, width: sliceW, height })
      .withMetadata({ density: 300 })
      .png()
      .toBuffer()
    const { data } = await worker.recognize(slice)
    const ch = (data.text ?? '').replace(/\D/g, '').slice(0, 1)
    if (!ch) return { digits: '', conf: 0 }
    digits += ch
    confSum += data.confidence ?? 0
  }
  return { digits, conf: confSum / 4 }
}

export async function recognizeDigitsCaptcha(image: Buffer): Promise<string> {
  if (!image.length) throw new Error('OCR captcha failed: empty image')
  if (!isImageBuffer(image)) throw new Error('OCR captcha failed: not an image')

  const worker = await getWorker()
  const { buf, width, height } = await toPng(image, 6)

  const threshold = await sharp(buf).threshold(140).withMetadata({ density: 300 }).png().toBuffer()
  const hits: OcrHit[] = [
    await ocrLine(worker, buf),
    await ocrLine(worker, threshold),
  ]

  const lineBest = hits.filter((h) => h.digits.length === 4).sort((a, b) => b.conf - a.conf)[0]
  if (lineBest) return lineBest.digits

  const sliced = await ocrSlices(worker, buf, width, height)
  if (sliced.digits.length === 4) return sliced.digits

  const best = [...hits, sliced].sort((a, b) => b.digits.length - a.digits.length || b.conf - a.conf)[0]
  throw new Error(`OCR captcha failed: got "${best?.digits ?? ''}"`)
}

export async function shutdownOcrWorker(): Promise<void> {
  if (!workerPromise) return
  const worker = await workerPromise
  await worker.terminate()
  workerPromise = null
}
