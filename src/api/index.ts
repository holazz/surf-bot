import type { NewsItem } from '../types'
import axios from 'axios'
import { OpenAI } from 'openai'
import 'dotenv/config'

export async function getToken(accessToken: string, refreshToken: string, deviceId: string) {
  const res = await axios.post(
    'https://api.asksurf.ai/muninn/v2/auth/refresh',
    { refresh_token: refreshToken },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Origin': 'https://asksurf.ai',
        'Referer': 'https://asksurf.ai/',
        'x-device-id': deviceId,
      },
    },
  )
  const { access_token, refresh_token } = res.data.data
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
  }
}

// export async function getDailyQuestions(): Promise<string[]> {
//   const res = await axios.get('https://cms.cyber.co/api/daily-questions?populate=*&sort=date:desc&pagination[limit]=1')
//   return res.data.data[0].attributes.questions.map((q: any) => q.question.zh)
// }

export async function fetchCryptoCompare(limit: number): Promise<NewsItem[]> {
  const res = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', {
    params: {
      lang: 'EN',
      sortOrder: 'latest',
    },
  })
  const articles: any[] = res.data?.Data ?? []
  return articles.slice(0, limit).map(a => ({
    title: a.title,
    body: a.body,
    url: a.url,
    source: a.source,
    published_at: new Date(a.published_on * 1000).toISOString(),
    categories: a.categories,
  }))
}

export async function fetchPANews(limit: number): Promise<NewsItem[]> {
  const res = await axios.get('https://universal-api.panewslab.com/articles', {
    params: {
      type: 'NEWS',
      isShowInList: true,
      take: limit,
      skip: 0,
      isImportant: true,
    },
  })
  const articles: any[] = res.data ?? []
  return articles.slice(0, limit).map(a => ({
    title: a.title ?? '',
    body: a.desc ?? a.content ?? '',
    url: `https://www.panewslab.com/article/${a.id}`,
    source: 'PANews',
    published_at: a.publishedAt ?? new Date().toISOString(),
    categories:
      (a.columns ?? [])
        .map((col: any) => col?.column?.name)
        .filter(Boolean)
        .join(',') || 'Blockchain',
  }))
}

export async function fetchReddit(limit: number): Promise<NewsItem[]> {
  const res = await axios.get(`https://www.reddit.com/r/CryptoCurrency/hot.json`, {
    params: { limit },
  })
  const posts: any[] = res.data.data?.children ?? []
  return posts
    .filter((p: any) => {
      const d = p.data
      return !d.stickied && d.link_flair_text !== 'MEME' && d.link_flair_text !== 'COMEDY'
    })
    .slice(0, limit)
    .map((p: any) => {
      const d = p.data
      return {
        title: d.title ?? '',
        body: (d.selftext ?? '').slice(0, 500),
        url: d.url_overridden_by_dest || `https://reddit.com${d.permalink}`,
        source: `Reddit r/CryptoCurrency`,
        published_at: new Date((d.created_utc ?? 0) * 1000).toISOString(),
        categories: d.link_flair_text || 'Discussion',
      }
    })
}

export async function generateHotQuestions(
  llm: {
    apiKey: string
    baseURL: string
    model: string
  },
  news: NewsItem[],
  count: number,
): Promise<string[]> {
  const { apiKey, baseURL, model } = llm

  if (!apiKey || apiKey === 'your_llm_api_key_here') {
    throw new Error('LLM_API_KEY is not configured. Please set it in .env')
  }

  const openai = new OpenAI({ apiKey, baseURL })

  const today = new Date().toISOString().split('T')[0]

  const newsBlock = news
    .slice(0, 60)
    .map((n, i) => `${i + 1}. [${n.source}][${n.published_at.slice(0, 10)}] ${n.title}\n   ${n.body.slice(0, 300)}`)
    .join('\n')

  const prompt = `你是一位资深区块链行业分析师。今天是 ${today}。

以下是最近的加密货币新闻（来自 CryptoCompare、PANews、Reddit 等多个来源）：
${newsBlock}

请根据以上信息，生成 ${count} 个当天区块链行业热点问题。要求：
1. 每个问题必须基于上面提供的真实新闻事件
2. 问题中要包含项目名称、代币符号等细节
3. 问题之间不要重复同一个项目/事件
4. 覆盖不同的区块链生态（以太坊、Solana、L2、DeFi、NFT 等）
5. 用中文输出

请直接以 JSON 数组格式返回，不要包含其他文字：
["问题1", "问题2", ...]`

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      })

      const content = completion.choices?.[0]?.message?.content ?? '[]'
      const match = content.match(/\[[\s\S]*\]/)
      if (!match)
        throw new Error(`LLM response is not a valid JSON array:\n${content}`)

      return JSON.parse(match[0]) as string[]
    }
    catch (err: any) {
      const code = err?.code || err?.error?.code
      if (attempt < maxRetries && ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(code)) {
        const delay = attempt * 3000
        console.log(`  ⚠ 网络错误 (${code})，${delay / 1000}s 后重试 (${attempt}/${maxRetries})...`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }

  throw new Error('LLM request failed after max retries')
}

export async function getSessions(accessToken: string, deviceId: string) {
  const res = await axios.get('https://api.asksurf.ai/muninn/v1/chat/sessions', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Origin': 'https://asksurf.ai',
      'Referer': 'https://asksurf.ai/',
      'x-device-id': deviceId,
    },
    params: {
      limit: 10,
      offset: 0,
    },
  })
  return res.data.data.chat_sessions
}

export async function getChatHistory(accessToken: string, deviceId: string, chatId: string) {
  const res = await axios.get(`https://api.asksurf.ai/muninn/v2/chat/sessions/${chatId}/history`, {
    headers: {
      'Origin': 'https://asksurf.ai',
      'Referer': 'https://asksurf.ai/',
      'Authorization': `Bearer ${accessToken}`,
      'x-device-id': deviceId,
    },
  })
  return res.data
}

export async function shareChat(accessToken: string, deviceId: string, chatId: string) {
  const res = await axios.patch(
    `https://api.asksurf.ai/muninn/v1/chat/sessions/${chatId}`,
    {
      is_public: true,
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Origin': 'https://asksurf.ai',
        'Referer': 'https://asksurf.ai/',
        'x-device-id': deviceId,
      },
    },
  )
  return res.data
}

export async function shareImage(accessToken: string, deviceId: string, text: string) {
  const res = await axios.post(
    'https://api.asksurf.ai/muninn/v1/ner/extract',
    {
      text,
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Origin': 'https://asksurf.ai',
        'Referer': 'https://asksurf.ai/',
        'x-device-id': deviceId,
      },
    },
  )
  return res.data
}

export async function getSharedHistory(chatId: string) {
  const res = await axios.get(`https://api.asksurf.ai/muninn/v2/chat/sessions/${chatId}/shared-history`)
  return res.data
}
