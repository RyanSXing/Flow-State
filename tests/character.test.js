global.fetch = jest.fn()

const { generateDialogue } = require('../src/character')

function mockFetchSuccess(text) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ content: [{ text }] })
  })
}

const characterConfig = {
  name: 'Drill Sergeant',
  personalityPrompt: 'You are a strict drill sergeant.',
  elevenLabsVoiceId: 'abc123'
}

describe('generateDialogue', () => {
  beforeEach(() => jest.clearAllMocks())

  test('calls Claude API with character and verdict info', async () => {
    mockFetchSuccess('Get back to work, soldier!')
    await generateDialogue(
      { onTask: false, activity: 'watching YouTube' },
      'formatted memory string',
      characterConfig,
      'study for exam',
      'ant-key'
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.messages[0].content).toContain('Drill Sergeant')
    expect(body.messages[0].content).toContain('watching YouTube')
    expect(body.messages[0].content).toContain('study for exam')
  })

  test('returns dialogue string from API', async () => {
    mockFetchSuccess('Pathetic, soldier!')
    const result = await generateDialogue(
      { onTask: false, activity: 'playing games' },
      '',
      characterConfig,
      'study',
      'ant-key'
    )
    expect(result).toBe('Pathetic, soldier!')
  })

  test('includes memory in prompt when provided', async () => {
    mockFetchSuccess('Again with the YouTube?')
    await generateDialogue(
      { onTask: false, activity: 'watching YouTube' },
      '[10:03] OFF-TASK: watching YouTube',
      characterConfig,
      'study',
      'ant-key'
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.messages[0].content).toContain('[10:03] OFF-TASK: watching YouTube')
  })

  test('throws on API error', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
    await expect(generateDialogue({}, '', characterConfig, 'task', 'key')).rejects.toThrow('Claude API error: 429')
  })
})
