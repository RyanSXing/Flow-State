const mockBuffer = Buffer.from('fake-png-data')
jest.mock('screenshot-desktop', () => jest.fn().mockResolvedValue(mockBuffer))

const { captureScreen } = require('../src/capture')

describe('capture', () => {
  test('returns base64 string', async () => {
    const result = await captureScreen()
    expect(typeof result).toBe('string')
    expect(result).toBe(mockBuffer.toString('base64'))
  })

  test('requests PNG format', async () => {
    const screenshotDesktop = require('screenshot-desktop')
    await captureScreen()
    expect(screenshotDesktop).toHaveBeenCalledWith({ format: 'png' })
  })
})
