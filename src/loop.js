const { captureScreen } = require('./capture')
const { analyzeScreen } = require('./analyzer')
const { generateDialogue } = require('./character')
const { speak } = require('./tts')
const memory = require('./memory')
const { log } = require('./logger')

const INTERVAL_MS = 30000
const IDLE_THRESHOLD_S = 20

function createLoop({ getApiKeys, getSettings, getCharacter, onReaction, getIdleTime, getPomodoroActive = () => true }) {
  let timer = null

  async function tick() {
    const settings = getSettings()
    if (settings.paused || !settings.taskDescription) {
      scheduleNext()
      return
    }

    if (!getPomodoroActive()) {
      scheduleNext()
      return
    }

    const idleSeconds = getIdleTime()
    const { anthropic, elevenlabs } = getApiKeys()
    const character = getCharacter(settings.character)

    try {
      if (idleSeconds >= IDLE_THRESHOLD_S) {
        log('IDLE', `User idle for ${Math.round(idleSeconds)}s — skipping screenshot`)
        const verdict = { onTask: false, activity: `idle for ${Math.round(idleSeconds)} seconds` }
        memory.addEvent(verdict)
        const memoryLog = memory.formatForPrompt()
        log('DIALOGUE', `Generating ${character.name} idle dialogue`)
        const dialogue = await generateDialogue(verdict, memoryLog, character, settings.taskDescription, anthropic)
        log('DIALOGUE', `"${dialogue}"`)
        log('TTS', 'Speaking...')
        await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)
        log('TTS', 'Playback complete')
        onReaction({ verdict, dialogue, character, isIdle: true })
      } else {
        log('LOOP', 'Capturing screen')
        const base64 = await captureScreen()
        log('VISION', `Analyzing for task: "${settings.taskDescription}"`)
        const verdict = await analyzeScreen(base64, settings.taskDescription, anthropic)
        log('VISION', `${verdict.onTask ? 'ON-TASK' : 'OFF-TASK'} — ${verdict.activity} (confidence: ${verdict.confidence})`)
        memory.addEvent({ onTask: verdict.onTask, activity: verdict.activity })
        const memoryLog = memory.formatForPrompt()
        log('DIALOGUE', `Generating ${character.name} dialogue`)
        const dialogue = await generateDialogue(verdict, memoryLog, character, settings.taskDescription, anthropic)
        log('DIALOGUE', `"${dialogue}"`)
        log('TTS', 'Speaking...')
        await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)
        log('TTS', 'Playback complete')
        onReaction({ verdict, dialogue, character })
      }
    } catch (err) {
      log('ERROR', `Cycle error: ${err.message}`)
    } finally {
      scheduleNext()
    }
  }

  function scheduleNext() {
    timer = setTimeout(tick, INTERVAL_MS)
    log('LOOP', `Next check in ${INTERVAL_MS / 1000}s`)
  }

  function start() {
    stop()
    log('LOOP', `Loop started — interval: ${INTERVAL_MS / 1000}s, idle threshold: ${IDLE_THRESHOLD_S}s`)
    scheduleNext()
  }

  function stop() {
    if (timer) { clearTimeout(timer); timer = null }
    memory.clear()
    log('LOOP', 'Loop stopped — memory cleared')
  }

  return { tick, start, stop }
}

module.exports = { createLoop }
