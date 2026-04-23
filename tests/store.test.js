const mockStore = { get: jest.fn(), set: jest.fn() }
jest.mock('electron-store', () => jest.fn(() => mockStore))

const { getApiKeys, setApiKey, getSettings, setSetting, getOverlayPosition, setOverlayPosition } = require('../src/store')

describe('store', () => {
  beforeEach(() => jest.clearAllMocks())

  test('getApiKeys returns both keys', () => {
    mockStore.get.mockReturnValueOnce('ant-key').mockReturnValueOnce('el-key')
    expect(getApiKeys()).toEqual({ anthropic: 'ant-key', elevenlabs: 'el-key' })
    expect(mockStore.get).toHaveBeenCalledWith('anthropicKey', '')
    expect(mockStore.get).toHaveBeenCalledWith('elevenlabsKey', '')
  })

  test('setApiKey stores anthropic key', () => {
    setApiKey('anthropic', 'new-key')
    expect(mockStore.set).toHaveBeenCalledWith('anthropicKey', 'new-key')
  })

  test('setApiKey stores elevenlabs key', () => {
    setApiKey('elevenlabs', 'el-new')
    expect(mockStore.set).toHaveBeenCalledWith('elevenlabsKey', 'el-new')
  })

  test('getSettings returns defaults', () => {
    mockStore.get.mockImplementation((key, def) => def)
    expect(getSettings()).toEqual({
      character: 'drill-sergeant',
      interval: 20,
      paused: false,
      taskDescription: ''
    })
  })

  test('setSetting stores key-value', () => {
    setSetting('interval', 30)
    expect(mockStore.set).toHaveBeenCalledWith('interval', 30)
  })

  test('getOverlayPosition returns stored or null defaults', () => {
    mockStore.get.mockImplementation((key, def) => def)
    expect(getOverlayPosition()).toEqual({ x: null, y: null })
  })

  test('setOverlayPosition stores x and y', () => {
    setOverlayPosition(100, 200)
    expect(mockStore.set).toHaveBeenCalledWith('overlayX', 100)
    expect(mockStore.set).toHaveBeenCalledWith('overlayY', 200)
  })
})
