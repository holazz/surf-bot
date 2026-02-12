import process from 'node:process'
import { CronJob } from 'cron'
import { run } from './index'
import 'dotenv/config'

CronJob.from({
  cronTime: process.env.SCHEDULE_CRON || '0 0 8 * * *',
  async onTick() {
    try {
      await run()
    }
    catch {}
  },
  start: true,
  timeZone: 'Asia/Shanghai',
})
