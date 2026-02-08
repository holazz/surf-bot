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
    const content = `# Access Token (从浏览器中获取 x-access-token)
ACCESS_TOKEN=

# Refresh Token (用于刷新 access_token)
REFRESH_TOKEN=

# 设备ID (从浏览器中获取 x-device-id)
DEVICE_ID=

# 聊天模式 (V2, V2_INSTANT, V2_THINKING)
SESSION_TYPE=V2

# 提问次数
QUESTION_COUNT=1
`
    await mkdir(directory, { recursive: true })
    await writeFile(filepath, content)
    console.log(c.green(`Created: ${relative(ROOT_DIR, filepath)}`))
  }
}

createEnvFile(join(ROOT_DIR))
