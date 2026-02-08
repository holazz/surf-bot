import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import c from 'picocolors'

export async function updateToken(accessToken: string, refreshToken: string) {
  const envPath = path.resolve(process.cwd(), '.env')
  let envContent = await fsp.readFile(envPath, 'utf-8')

  envContent = envContent.replace(
    /^ACCESS_TOKEN=.*/m,
    `ACCESS_TOKEN=${accessToken}`,
  )

  envContent = envContent.replace(
    /^REFRESH_TOKEN=.*/m,
    `REFRESH_TOKEN=${refreshToken}`,
  )

  await fsp.writeFile(envPath, envContent, 'utf-8')
}

// 检查 Token 是否即将过期（提前 5 分钟刷新）
export function isTokenExpiringSoon(token: string, bufferSeconds: number = 300) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    const exp = payload.exp
    const now = Math.floor(Date.now() / 1000)
    return now >= exp - bufferSeconds
  }
  catch {
    return true
  }
}

export function generateSessionId() {
  const randomBytes = crypto.randomBytes(16)
  randomBytes[6] = (randomBytes[6] & 0x0F) | 0x40 // 版本 4
  randomBytes[8] = (randomBytes[8] & 0x3F) | 0x80 // 变体 1

  const hex = randomBytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function generateRequestId() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getErrorMessage(error: any) {
  const errorPaths = [
    ['response', 'data', 'message'],
    ['response', 'data', 'error'],
    ['response', 'data'],
    ['response', 'statusText'],
    ['error', 'reason'],
    ['cause'],
    ['reason'],
    ['message'],
  ]

  for (const path of errorPaths) {
    let value = error
    for (const key of path) {
      if (value === null || value === undefined)
        break
      value = value[key]
    }
    if (value) {
      return typeof value === 'object' ? JSON.stringify(value, Object.getOwnPropertyNames(value)) : String(value)
    }
  }
  return 'error'
}

export function retry<A extends unknown[], T>(fn: (...args: A) => Promise<T>, times = 0, delay = 0) {
  return (...args: A): Promise<T> =>
    new Promise((resolve, reject) => {
      const attempt = async () => {
        try {
          resolve(await fn(...args))
        }
        catch (err: any) {
          console.log(c.red(`[${fn.name || 'anonymous'}] ${getErrorMessage(err)}`))
          if (times-- <= 0) {
            reject(err)
          }
          else {
            setTimeout(attempt, delay)
          }
        }
      }
      attempt()
    })
}
