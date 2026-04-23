global.fetch = jest.fn()

const mockExec = jest.fn((cmd, cb) => cb(null))
const mockWriteFileSync = jest.fn()
const mockUnlinkSync = jest.fn()

jest.mock('child_process', () => ({ exec: mockExec }))
jest.mock('fs', () => ({ writeFileSync: mockWriteFileSync, unlinkSync: mockUnlinkSync }))
jest.mock('os', () => ({ tmpdir: () => '/tmp' }))
jest.mock('path', () => ({ join: (...args) => args.join('/') }))

const { speak } = require('../src/tts')

describe('speak', () => {
  beforeEach(() => jest.clearAllMocks())

  test('calls ElevenLabs API with correct params', async () => {
    const fakeAudio = Buffer.from('mp3data')
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeAudio.buffer
    })
    await speak('Hello soldier', 'voice123', 'el-key')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-speech/voice123',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'xi-api-key': 'el-key' })
      })
    )
  })

  test('writes MP3 to temp file and plays it', async () => {
    const fakeAudio = Buffer.from('mp3data')
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeAudio.buffer
    })
    await speak('Hello', 'v1', 'key')
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/\.mp3$/),
      expect.any(Buffer)
    )
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('afplay'),
      expect.any(Function)
    )
  })

  test('deletes temp file after playback', async () => {
    const fakeAudio = Buffer.from('mp3data')
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeAudio.buffer
    })
    await speak('Hello', 'v1', 'key')
    const tmpPath = mockWriteFileSync.mock.calls[0][0]
    expect(mockUnlinkSync).toHaveBeenCalledWith(tmpPath)
  })

  test('throws on ElevenLabs API error', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(speak('text', 'v1', 'bad-key')).rejects.toThrow('ElevenLabs API error: 401')
  })
})
