const screenshotDesktop = require('screenshot-desktop')

async function captureScreen() {
  const buffer = await screenshotDesktop({ format: 'png' })
  return buffer.toString('base64')
}

module.exports = { captureScreen }
