import dns from 'node:dns'
import cors from 'cors'
import express from 'express'

dns.setDefaultResultOrder('ipv4first')
import { assertBackendConfig, config } from './config.js'
import { apiRouter } from './routes/api.js'
import { cronRouter } from './routes/cron.js'

assertBackendConfig()

const app = express()
app.use(cors({ origin: config.corsOrigin }))
app.use(express.json({ limit: '2mb' }))

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'horus', docs: '/api/health' })
})

app.use('/api', apiRouter)
app.use('/cron', cronRouter)

app.listen(config.port, () => {
  console.log(`[horus-backend] http://0.0.0.0:${config.port}`)
})
