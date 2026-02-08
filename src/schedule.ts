import { CronJob } from 'cron'
import { run } from './index'

CronJob.from({
  cronTime: '0 0 8 * * *',
  async onTick() {
    try {
      await run()
    }
    catch {}
  },
  start: true,
  timeZone: 'Asia/Shanghai',
})
