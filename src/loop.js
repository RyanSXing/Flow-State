const { captureScreen } = require('./capture')
const { analyzeScreen } = require('./analyzer')
const { generateDialogue } = require('./character')
const { speak } = require('./tts')
const memory = require('./memory')

const IDLE_THRESHOLD_SECONDS = 30
const IDLE_REACTION_COOLDOWN_MS = 60000

function createLoop({ getApiKeys, getSettings, getCharacter, onReaction, getIdleTime }) {
  let mainInterval = null
  let idleInterval = null
  let lastIdleReactionAt = 0
  let wasIdle = false

  async function tick() {
    const settings = getSettings()
    if (settings.paused || !settings.taskDescription) return

    const { anthropic, elevenlabs } = getApiKeys()
    const character = getCharacter(settings.character)

    try {
      const base64 = await captureScreen()
      const verdict = await analyzeScreen(base64, settings.taskDescription, anthropic)
      memory.addEvent({ onTask: verdict.onTask, activity: verdict.activity })

      const memoryLog = memory.formatForPrompt()
      const dialogue = await generateDialogue(verdict, memoryLog, character, settings.taskDescription, anthropic)
      await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)
      onReaction({ verdict, dialogue, character })
    } catch (err) {
      console.error('[loop] tick error:', err.message)
    }
  }

  async function checkIdle() {
    const settings = getSettings()
    if (settings.paused || !settings.taskDescription) return

    const idleSeconds = getIdleTime()
    const now = Date.now()

    if (idleSeconds >= IDLE_THRESHOLD_SECONDS && !wasIdle && (now - lastIdleReactionAt) > IDLE_REACTION_COOLDOWN_MS) {
      wasIdle = true
      lastIdleReactionAt = now
      const { anthropic, elevenlabs } = getApiKeys()
      const character = getCharacter(settings.character)
      const idleVerdict = { onTask: false, activity: `idle for ${Math.round(idleSeconds)} seconds` }
      memory.addEvent(idleVerdict)
      try {
        const memoryLog = memory.formatForPrompt()
        const dialogue = await generateDialogue(idleVerdict, memoryLog, character, settings.taskDescription, anthropic)
        await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)
        onReaction({ verdict: idleVerdict, dialogue, character, isIdle: true })
      } catch (err) {
        console.error('[loop] idle error:', err.message)
      }
    } else if (idleSeconds < IDLE_THRESHOLD_SECONDS) {
      wasIdle = false
    }
  }

  function start(intervalSeconds) {
    stop()
    mainInterval = setInterval(tick, intervalSeconds * 1000)
    idleInterval = setInterval(checkIdle, 5000)
  }

  function stop() {
    if (mainInterval) { clearInterval(mainInterval); mainInterval = null }
    if (idleInterval) { clearInterval(idleInterval); idleInterval = null }
    memory.clear()
  }

  return { tick, start, stop }
}

module.exports = { createLoop }
