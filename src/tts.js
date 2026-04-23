const { exec } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

async function speak(text, voiceId, apiKey) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  })

  if (!response.ok) throw new Error(`ElevenLabs API error: ${response.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  const tmpFile = path.join(os.tmpdir(), `flow-state-${Date.now()}.mp3`)
  fs.writeFileSync(tmpFile, buffer)

  return new Promise((resolve) => {
    exec(`afplay "${tmpFile}"`, () => {
      fs.unlinkSync(tmpFile)
      resolve()
    })
  })
}

module.exports = { speak }
