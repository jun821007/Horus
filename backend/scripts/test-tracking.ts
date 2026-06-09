import { resolveCarrier } from '../src/lib/carrier.js'
import { queryCarrierStatus } from '../src/lib/tracking-provider.js'

const tn = process.argv[2] ?? '8531038342'
const carrier = resolveCarrier(tn)

console.log('tracking:', tn)
console.log('carrier:', carrier)
console.log('querying...')

const started = Date.now()
const result = await queryCarrierStatus(carrier, tn)
console.log('elapsed_ms:', Date.now() - started)
console.log(JSON.stringify(result, null, 2))
