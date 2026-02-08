import axios from 'axios'

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

export async function getDailyQuestions(): Promise<string[]> {
  const res = await axios.get('https://cms.cyber.co/api/daily-questions?populate=*&sort=date:desc&pagination[limit]=1')
  return res.data.data[0].attributes.questions.map((q: any) => q.question.zh)
}
