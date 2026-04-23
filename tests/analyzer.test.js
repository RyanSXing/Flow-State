global.fetch = jest.fn()

const { analyzeScreen } = require('../src/analyzer')

const validResponse = { onTask: false, activity: 'watching YouTube', confidence: 0.95 }

function mockFetchSuccess(json) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      content: [{ text: JSON.stringify(json) }]
    })
  })
}

describe('analyzeScreen', () => {
  beforeEach(() => jest.clearAllMocks())

  test('calls Claude API with base64 image and task', async () => {
    mockFetchSuccess(validResponse)
    await analyzeScreen('base64data', 'study for exam', 'ant-key')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'ant-key' })
      })
    )
  })

  test('returns parsed verdict object', async () => {
    mockFetchSuccess(validResponse)
    const result = await analyzeScreen('base64data', 'study for exam', 'ant-key')
    expect(result).toEqual(validResponse)
  })

  test('handles JSON wrapped in markdown code block', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: '```json\n' + JSON.stringify(validResponse) + '\n```' }]
      })
    })
    const result = await analyzeScreen('base64data', 'study for exam', 'ant-key')
    expect(result.onTask).toBe(false)
  })

  test('throws on API error', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    await expect(analyzeScreen('base64', 'task', 'bad-key')).rejects.toThrow('Claude API error: 401')
  })
})
