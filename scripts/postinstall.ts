import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import c from 'picocolors'

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

async function createEnvFile(directory: string) {
  const filename = '.env'
  const filepath = join(directory, filename)
  try {
    await access(filepath)
  }
  catch {
    const content = `# LLM API 配置 (OpenAI 兼容接口，支持 OpenAI / DeepSeek / QWEN / 其他兼容服务)
LLM_API_KEY=
LLM_API_BASE_URL=
LLM_MODEL=

# Access Token (从浏览器中获取 x-access-token)
ACCESS_TOKEN=

# Refresh Token (用于刷新 access_token)
REFRESH_TOKEN=

# 设备ID (从浏览器中获取 x-device-id)
DEVICE_ID=

# 聊天模式 (V2, V2_INSTANT, V2_THINKING)
SESSION_TYPE=V2_THINKING

# 提问次数范围
QUESTION_COUNT_RANGE=7,10

# 提问间隔时间范围 (单位：分钟)
QUESTION_INTERVAL_RANGE=0,1

# 定时任务的 Cron 表达式 (每天早上8点)
SCHEDULE_CRON=0 8 * * *
`
    await mkdir(directory, { recursive: true })
    await writeFile(filepath, content)
    console.log(c.green(`Created: ${relative(ROOT_DIR, filepath)}`))
  }
}

createEnvFile(join(ROOT_DIR))
