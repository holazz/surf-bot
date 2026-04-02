import type { Buffer } from 'node:buffer'
import type { MessagePayload, NewsItem, SessionType } from './types'
import process from 'node:process'
import ora from 'ora'
import c from 'picocolors'
import WebSocket from 'ws'
import {
  // fetchCryptoCompare,
  // fetchPANews,
  fetchMarsbit,
  fetchReddit,
  generateHotQuestions,
  getChatHistory,
  getSessions,
  getToken,
  shareChat,
  shareImage,
} from './api'
import {
  generateRequestId,
  generateSessionId,
  getRandomElementFromArray,
  isTokenExpiringSoon,
  retry,
  updateToken,
} from './utils'
import 'dotenv/config'

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

async function getDailyQuestions(count = 1): Promise<string[]> {
  const date = new Date().toISOString().split('T')[0]
  console.log(c.cyan(`\n📡 区块链每日热点问题搜集 — ${date}\n`))
  const allNews: NewsItem[] = []

  // try {
  //   console.log(c.gray('  → 获取 CryptoCompare 新闻...'))
  //   const news = await retry(fetchCryptoCompare, 3)(50)
  //   allNews.push(...news)
  //   console.log(c.green(`  ✓ CryptoCompare: ${news.length} 篇`))
  // }
  // catch {
  //   console.log(c.yellow('  ⚠ CryptoCompare 新闻获取失败，跳过'))
  // }

  // try {
  //   console.log(c.gray('  → 获取 PANews 新闻...'))
  //   const paNews = await retry(fetchPANews, 3)(50)
  //   allNews.push(...paNews)
  //   console.log(c.green(`  ✓ PANews: ${paNews.length} 篇`))
  // }
  // catch {
  //   console.log(c.yellow('  ⚠ PANews 新闻获取失败，跳过'))
  // }

  try {
    console.log(c.gray('  → 获取 MarsBit 新闻...'))
    const marsbit = await retry(fetchMarsbit, 3)(50)
    allNews.push(...marsbit)
    console.log(c.green(`  ✓ MarsBit: ${marsbit.length} 篇`))
  }
  catch {
    console.log(c.yellow('  ⚠ MarsBit 新闻获取失败，跳过'))
  }

  try {
    console.log(c.gray('  → 获取 Reddit 热门帖子...'))
    const reddit = await retry(fetchReddit, 3)(50)
    allNews.push(...reddit)
    console.log(c.green(`  ✓ Reddit: ${reddit.length} 篇`))
  }
  catch {
    console.log(c.yellow('  ⚠ Reddit 帖子获取失败，跳过'))
  }

  if (allNews.length === 0) {
    throw new Error('所有新闻源获取均失败，无法生成热点问题')
  }

  console.log(c.bold(c.white(`  📰 共获取 ${allNews.length} 篇新闻/帖子`)))

  console.log(c.gray(`  → 调用 LLM 生成 ${count} 个热点问题...`))
  const apiKey = process.env.LLM_API_KEY!
  const baseURL = process.env.LLM_API_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.LLM_MODEL || 'gpt-4o'
  const questions = await retry(generateHotQuestions, 3)({ apiKey, baseURL, model }, allNews, count)
  console.log(c.green(`  ✓ 生成 ${questions.length} 个热点问题\n`))

  return questions
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

export async function run() {
  try {
    const [minCount, maxCount] = (process.env.QUESTION_COUNT_RANGE || '1,1')
      .split(',')
      .map(s => Number.parseInt(s.trim(), 10))
    const questionCount = getRandomElementFromArray(
      Array.from({ length: maxCount - minCount + 1 }, (_, i) => i + minCount),
    )[0]
    const allQuestions = await getDailyQuestions(questionCount * 10)
    const questions = getRandomElementFromArray(allQuestions, questionCount)
    const [minInterval, maxInterval] = (process.env.QUESTION_INTERVAL_RANGE || '0,0')
      .split(',')
      .map(s => Number.parseInt(s.trim(), 10))

    console.log()
    console.log(c.bold(c.cyan('=== Surf AI 聊天 ===')))
    console.log(c.dim(`共 ${questions.length} 个问题`))

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]

      console.log()
      console.log(c.bold(c.blue(`--- 问题 ${i + 1}/${questions.length} ---`)))
      console.log(c.yellow('❓') + c.bold(' 问题: ') + c.dim(question))
      console.log()

      const sessionId = generateSessionId()
      const response = await sendMessage({
        message: question,
        sessionId,
        sessionType: (process.env.SESSION_TYPE as SessionType) || 'V2',
      })

      console.log()
      console.log(c.bold(c.green('=== 回答 ===')))
      console.log(response)
      console.log()

      console.log(c.gray('  → 获取聊天历史...'))
      const sessions = await getSessions(process.env.ACCESS_TOKEN!, process.env.DEVICE_ID!)
      const chatId = sessions[0].id
      await getChatHistory(process.env.ACCESS_TOKEN!, process.env.DEVICE_ID!, chatId)

      console.log(c.gray('  → 分享聊天结果...'))
      await shareImage(process.env.ACCESS_TOKEN!, process.env.DEVICE_ID!, response as string)
      await shareChat(process.env.ACCESS_TOKEN!, process.env.DEVICE_ID!, chatId)

      if (i < questions.length - 1) {
        const waitMinutes = getRandomElementFromArray(
          Array.from({ length: maxInterval - minInterval + 1 }, (_, idx) => idx + minInterval),
        )[0]
        if (waitMinutes > 0) {
          console.log(c.dim(`⏳ 等待 ${waitMinutes} 分钟后继续...`))
          await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000))
        }
      }
    }

    console.log(c.bold(c.green('✓ 所有问题已完成')))
  }
  catch (error) {
    console.error(c.red('✗') + c.bold(' 脚本执行出错:'), error)
  }
}
