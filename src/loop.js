const { log } = require('./logger')
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
  let ticking = false

  async function tick() {
    if (ticking) {
      log('LOOP', 'Tick skipped — still processing previous')
      return
    }
    const settings = getSettings()
    if (settings.paused || !settings.taskDescription) return
    if (getIdleTime() >= IDLE_THRESHOLD_SECONDS) {
      log('LOOP', `Tick skipped — user idle (${Math.round(getIdleTime())}s)`)
      return
    }
    ticking = true
    log('LOOP', 'Tick started — capturing screen')

    const { anthropic, elevenlabs } = getApiKeys()
    const character = getCharacter(settings.character)

    try {
      const base64 = await captureScreen()
      log('VISION', `Analyzing screen for task: "${settings.taskDescription}"`)
      const verdict = await analyzeScreen(base64, settings.taskDescription, anthropic)
      log('VISION', `Result: ${verdict.onTask ? 'ON-TASK' : 'OFF-TASK'} — ${verdict.activity} (confidence: ${verdict.confidence})`)
      memory.addEvent({ onTask: verdict.onTask, activity: verdict.activity })

      const memoryLog = memory.formatForPrompt()
      log('DIALOGUE', `Generating ${character.name} dialogue`)
      const dialogue = await generateDialogue(verdict, memoryLog, character, settings.taskDescription, anthropic)
      log('DIALOGUE', `Generated: "${dialogue}"`)
      log('TTS', `Speaking via ElevenLabs (voice: ${character.elevenLabsVoiceId})`)
      await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)
      log('TTS', 'Playback complete')
      onReaction({ verdict, dialogue, character })
    } catch (err) {
      log('ERROR', `Tick error: ${err.message}`)
      console.error('[loop] tick error:', err.message)
    } finally {
      ticking = false
    }
  }

  async function checkIdle() {
    const settings = getSettings()
    if (settings.paused || !settings.taskDescription) return

    const idleSeconds = getIdleTime()
    log('IDLE', `Idle check — ${Math.round(idleSeconds)}s idle`)
    const now = Date.now()

    if (idleSeconds >= IDLE_THRESHOLD_SECONDS && !wasIdle && (now - lastIdleReactionAt) > IDLE_REACTION_COOLDOWN_MS) {
      log('IDLE', `User idle for ${Math.round(idleSeconds)}s — triggering reaction`)
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
    log('LOOP', `Loop started — interval: ${intervalSeconds}s`)
  }

  function stop() {
    if (mainInterval) { clearInterval(mainInterval); mainInterval = null }
    if (idleInterval) { clearInterval(idleInterval); idleInterval = null }
    memory.clear()
    log('LOOP', 'Loop stopped — session memory cleared')
  }

  return { tick, start, stop }
}

module.exports = { createLoop }
