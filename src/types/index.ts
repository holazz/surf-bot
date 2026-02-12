export interface NewsItem {
  title: string
  body: string
  url: string
  source: string
  published_at: string
  categories: string
}

export type SessionType = 'V2' | 'V2_INSTANT' | 'V2_THINKING'

export interface MessagePayload {
  message: string
  sessionId: string
  sessionType: SessionType
}
