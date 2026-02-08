import type { Buffer } from 'node:buffer'
import process from 'node:process'
import ora from 'ora'
import c from 'picocolors'
import WebSocket from 'ws'
import { getDailyQuestions, getToken } from './api'
import { generateRequestId, generateSessionId, isTokenExpiringSoon, updateToken } from './utils'
import 'dotenv/config'

type SessionType = 'V2' | 'V2_INSTANT' | 'V2_THINKING'

interface MessagePayload {
  message: string
  sessionId: string
  sessionType: SessionType
}

async function getAccessToken() {
  let token = process.env.ACCESS_TOKEN!
  if (isTokenExpiringSoon(token)) {
    const { accessToken, refreshToken } = await getToken(token, process.env.REFRESH_TOKEN!, process.env.DEVICE_ID!)
    token = accessToken
    process.env.ACCESS_TOKEN = accessToken
    process.env.REFRESH_TOKEN = refreshToken
    await updateToken(accessToken, refreshToken)
  }
  return token
}

export async function sendMessage({ message, sessionId, sessionType }: MessagePayload) {
  const accessToken = await getAccessToken()
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `wss://api.asksurf.ai/muninn/v4/chat/sessions/${sessionId}/ws?token=${accessToken}&session_type=${sessionType}&platform=WEB`,
    )

    let fullResponse = ''
    let isResolved = false
    let thinkingSpinner: ReturnType<typeof ora> | null = null
    let isThinking = false

    ws.on('open', () => {
      console.log(c.green('✓') + c.dim(' WebSocket连接已建立'))

      const requestData = {
        request_id: generateRequestId(),
        type: 'chat_request',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: message,
              },
            ],
          },
        ],
      }

      ws.send(JSON.stringify(requestData))
      console.log(c.green('✓') + c.dim(' 已发送消息'))
    })

    ws.on('message', (data: Buffer) => {
      const messageStr = data.toString()

      try {
        const parsed = JSON.parse(messageStr)

        switch (parsed.event_type) {
          case 'connected':
            console.log(c.green('✓') + c.dim(' 已连接到Surf会话'))
            break

          case 'chat_start':
            console.log(c.cyan('◆') + c.dim(` 聊天开始: ${parsed.data?.title || ''}`))
            break

            // case 'tool_calls':
            //   console.log(c.yellow('⚡') + c.dim(` 工具调用: ${parsed.data?.tool_name} - ${parsed.data?.phase}`))
            //   break

          case 'message_chunk':
            if (isThinking && thinkingSpinner) {
              thinkingSpinner.stop()
              isThinking = false
              console.log() // 换行
            }
            // 累积消息内容
            if (parsed.data?.content) {
              fullResponse += parsed.data.content
              process.stdout.write(parsed.data.content)
            }
            break

          case 'reasoning':
            // 使用 ora 显示思考内容
            if (parsed.data?.text_chunk) {
              if (!isThinking) {
                thinkingSpinner = ora({
                  text: c.magenta(parsed.data.text_chunk),
                  spinner: 'dots',
                  prefixText: c.dim('[思考]'),
                }).start()
                isThinking = true
              }
              else if (thinkingSpinner) {
                // 更新 spinner 的文本内容
                thinkingSpinner.text = c.magenta(parsed.data.text_chunk)
              }
            }
            break

          case 'end':
            // 确保停止思考动画
            if (isThinking && thinkingSpinner) {
              thinkingSpinner.stop()
              isThinking = false
            }
            console.log('\n')
            console.log(c.green('✓') + c.dim(' 回答完成'))

            if (!isResolved) {
              isResolved = true
              resolve(fullResponse)
              ws.close()
            }
            break

          case 'custom':
            // 自定义事件，如检索完成
            if (parsed.data?.event_data?.type === 'RETRIEVER_DONE') {
              console.log(c.blue('🔍') + c.dim(` 检索完成: ${parsed.data.event_data.title}`))
            }
            break

          default:
            // 其他事件类型
            break
        }
      }
      catch (error) {
        console.error(c.red('✗') + c.dim(' 解析消息时出错:'), error)
      }
    })

    // 错误处理
    ws.on('error', (error) => {
      if (thinkingSpinner)
        thinkingSpinner.stop()
      console.error(c.red('✗') + c.dim(' WebSocket错误:'), error)
      if (!isResolved) {
        isResolved = true
        reject(error)
      }
    })

    // 连接关闭
    ws.on('close', () => {
      if (thinkingSpinner)
        thinkingSpinner.stop()
      console.log(c.dim('○ 连接已关闭'))
      if (!isResolved) {
        isResolved = true
        resolve(fullResponse)
      }
    })
  })
}

async function run() {
  try {
    const questions = await getDailyQuestions()
    const questionCount = Number.parseInt(process.env.QUESTION_COUNT || '1', 10)
    const questionsToAsk = questions.slice(0, questionCount)

    console.log()
    console.log(c.bold(c.cyan('=== Surf AI 聊天 ===')))
    console.log(c.dim(`共 ${questionsToAsk.length} 个问题`))

    for (let i = 0; i < questionsToAsk.length; i++) {
      const question = questionsToAsk[i]

      console.log()
      console.log(c.bold(c.blue(`--- 问题 ${i + 1}/${questionsToAsk.length} ---`)))
      console.log(c.yellow('❓') + c.bold(' 问题: ') + c.dim(question))
      console.log()

      const response = await sendMessage({
        message: question,
        sessionId: generateSessionId(),
        sessionType: (process.env.SESSION_TYPE as SessionType) || 'V2',
      })

      console.log()
      console.log(c.bold(c.green('=== 回答 ===')))
      console.log(response)
      console.log()
    }

    console.log(c.bold(c.green('✓ 所有问题已完成')))
  }
  catch (error) {
    console.error(c.red('✗') + c.bold(' 脚本执行出错:'), error)
  }
}

run()
