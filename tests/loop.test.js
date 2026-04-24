jest.mock('../src/capture', () => ({ captureScreen: jest.fn().mockResolvedValue('base64img') }))
jest.mock('../src/analyzer', () => ({ analyzeScreen: jest.fn().mockResolvedValue({ onTask: false, activity: 'watching YouTube', confidence: 0.9 }) }))
jest.mock('../src/character', () => ({ generateDialogue: jest.fn().mockResolvedValue('Get back to work\!') }))
jest.mock('../src/tts', () => ({ speak: jest.fn().mockResolvedValue(undefined) }))
jest.mock('../src/memory', () => ({
  addEvent: jest.fn(),
  formatForPrompt: jest.fn().mockReturnValue('memory string'),
  clear: jest.fn(),
  getRecent: jest.fn().mockReturnValue([])
}))
jest.mock('../src/logger', () => ({ log: jest.fn() }))

const { createLoop } = require('../src/loop')
const capture = require('../src/capture')
const analyzer = require('../src/analyzer')
const character = require('../src/character')
const tts = require('../src/tts')
const memory = require('../src/memory')

describe('loop tick', () => {
  let loop
  let config

  beforeEach(() => {
    jest.clearAllMocks()
    capture.captureScreen.mockResolvedValue('base64img')
    analyzer.analyzeScreen.mockResolvedValue({ onTask: false, activity: 'watching YouTube', confidence: 0.9 })
    character.generateDialogue.mockResolvedValue('Get back to work\!')
    tts.speak.mockResolvedValue(undefined)
    memory.formatForPrompt.mockReturnValue('memory string')
    memory.getRecent.mockReturnValue([])
    config = {
      getApiKeys: () => ({ anthropic: 'ant-key', elevenlabs: 'el-key' }),
      getSettings: () => ({ taskDescription: 'study for exam', character: 'drill-sergeant', interval: 20, paused: false }),
      getCharacter: (id) => ({ id, name: 'Drill Sergeant', personalityPrompt: '...', elevenLabsVoiceId: 'v1' }),
      onReaction: jest.fn(),
      getIdleTime: jest.fn().mockReturnValue(0)
    }
    loop = createLoop(config)
  })

  test('tick calls capture, analyze, generate, speak in order when active', async () => {
    const order = []
    capture.captureScreen.mockImplementation(async () => { order.push('capture'); return 'b64' })
    analyzer.analyzeScreen.mockImplementation(async () => { order.push('analyze'); return { onTask: false, activity: 'YouTube', confidence: 0.9 } })
    character.generateDialogue.mockImplementation(async () => { order.push('generate'); return 'line' })
    tts.speak.mockImplementation(async () => { order.push('speak') })
    await loop.tick()
    expect(order).toEqual(['capture', 'analyze', 'generate', 'speak'])
  })

  test('tick adds event to memory', async () => {
    await loop.tick()
    expect(memory.addEvent).toHaveBeenCalledWith(expect.objectContaining({ onTask: false, activity: 'watching YouTube' }))
  })

  test('tick calls onReaction callback', async () => {
    await loop.tick()
    expect(config.onReaction).toHaveBeenCalledWith(expect.objectContaining({ dialogue: 'Get back to work\!' }))
  })

  test('tick skips to idle path when user is idle', async () => {
    config.getIdleTime = jest.fn().mockReturnValue(25)
    loop = createLoop(config)
    await loop.tick()
    expect(capture.captureScreen).not.toHaveBeenCalled()
    expect(analyzer.analyzeScreen).not.toHaveBeenCalled()
    expect(character.generateDialogue).toHaveBeenCalled()
    expect(tts.speak).toHaveBeenCalled()
  })

  test('tick skips entirely when paused', async () => {
    config.getSettings = () => ({ taskDescription: 'study', character: 'drill-sergeant', interval: 20, paused: true })
    loop = createLoop(config)
    await loop.tick()
    expect(capture.captureScreen).not.toHaveBeenCalled()
    expect(tts.speak).not.toHaveBeenCalled()
  })

  test('tick skips entirely when no task description', async () => {
    config.getSettings = () => ({ taskDescription: '', character: 'drill-sergeant', interval: 20, paused: false })
    loop = createLoop(config)
    await loop.tick()
    expect(capture.captureScreen).not.toHaveBeenCalled()
    expect(tts.speak).not.toHaveBeenCalled()
  })
})
