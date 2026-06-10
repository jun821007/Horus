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

function isGifCaptcha(buf: Buffer): boolean {
  return buf.slice(0, 3).toString() === 'GIF'
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

async function ocrLine(worker: Worker, image: Buffer, modes = [PSM.SINGLE_LINE, PSM.RAW_LINE]): Promise<OcrHit> {
  let best: OcrHit = { digits: '', conf: 0 }
  for (const mode of modes) {
    await worker.setParameters({ tessedit_pageseg_mode: mode })
    const { data } = await worker.recognize(image)
    const digits = (data.text ?? '').replace(/\D/g, '').slice(0, 4)
    const conf = data.confidence ?? 0
    if (digits.length > best.digits.length || (digits.length === best.digits.length && conf > best.conf)) {
      best = { digits, conf }
    }
  }
  return best
}

async function ocrSlices(worker: Worker, image: Buffer, width: number, height: number): Promise<OcrHit> {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR })
  const sliceW = Math.max(8, Math.floor(width / 4))
  let digits = ''
  let confSum = 0
  for (let i = 0; i < 4; i += 1) {
    const left = Math.max(0, Math.min(i * sliceW, width - sliceW))
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

function pickBest(hits: OcrHit[]): string | null {
  const tallies = new Map<string, { conf: number; votes: number }>()
  for (const hit of hits) {
    if (hit.digits.length !== 4) continue
    const prev = tallies.get(hit.digits)
    if (!prev) tallies.set(hit.digits, { conf: hit.conf, votes: 1 })
    else tallies.set(hit.digits, { conf: Math.max(prev.conf, hit.conf), votes: prev.votes + 1 })
  }
  const ranked = [...tallies.entries()].sort((a, b) => b[1].votes - a[1].votes || b[1].conf - a[1].conf)
  return ranked[0]?.[0] ?? null
}

async function recognizeGifCaptcha(worker: Worker, image: Buffer): Promise<string | null> {
  const { buf, width, height } = await toPng(image, 6)
  const threshold = await sharp(buf).threshold(140).withMetadata({ density: 300 }).png().toBuffer()
  const hits = [await ocrLine(worker, buf), await ocrLine(worker, threshold), await ocrSlices(worker, buf, width, height)]
  return pickBest(hits) ?? hits.sort((a, b) => b.digits.length - a.digits.length || b.conf - a.conf)[0]?.digits ?? null
}

async function recognizeNoisyCaptcha(worker: Worker, image: Buffer): Promise<string | null> {
  const meta = await sharp(image, { animated: false, pages: 1 }).metadata()
  const w = meta.width ?? 80
  const h = meta.height ?? 40
  const hits: OcrHit[] = []

  for (const scale of [8, 12]) {
    const width = w * scale
    const height = h * scale
    const base = sharp(image, { animated: false, pages: 1 })
      .flatten({ background: '#ffffff' })
      .resize(width, height, { kernel: sharp.kernel.nearest })
      .grayscale()

    const variants = await Promise.all([
      base.clone().blur(1.2).threshold(200).withMetadata({ density: 300 }).png().toBuffer(),
      base.clone().median(3).blur(0.8).threshold(180).withMetadata({ density: 300 }).png().toBuffer(),
      base.clone().gamma(2.2).threshold(170).withMetadata({ density: 300 }).png().toBuffer(),
    ])

    for (const variant of variants) {
      hits.push(await ocrLine(worker, variant, [PSM.RAW_LINE, PSM.SPARSE_TEXT]))
      hits.push(await ocrSlices(worker, variant, width, height))
    }
  }

  return pickBest(hits)
}

export async function recognizeDigitsCaptcha(image: Buffer): Promise<string> {
  if (!image.length) throw new Error('OCR captcha failed: empty image')
  if (!isImageBuffer(image)) throw new Error('OCR captcha failed: not an image')

  const worker = await getWorker()
  const digits = isGifCaptcha(image)
    ? await recognizeGifCaptcha(worker, image)
    : await recognizeNoisyCaptcha(worker, image)

  if (digits && digits.length === 4) return digits
  throw new Error(`OCR captcha failed: got "${digits ?? ''}"`)
}

export async function shutdownOcrWorker(): Promise<void> {
  if (!workerPromise) return
  const worker = await workerPromise
  await worker.terminate()
  workerPromise = null
}
