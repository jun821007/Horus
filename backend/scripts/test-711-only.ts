import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { querySevenElevenTracking } from '../src/lib/tracking/seven-eleven.js'

const tn = process.argv[2] ?? ''
if (!tn) {
  console.error('Usage: npx tsx scripts/test-711-only.ts <tracking_number>')
  process.exit(1)
}

const outDir = join(import.meta.dirname, 'debug-out')
mkdirSync(outDir, { recursive: true })

console.log('tracking:', tn)
const started = Date.now()
const result = await querySevenElevenTracking(tn, 12)
console.log('elapsed_ms:', Date.now() - started)
console.log(JSON.stringify(result, null, 2))
writeFileSync(join(outDir, '711-last-result.json'), JSON.stringify(result, null, 2))
