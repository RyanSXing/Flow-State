const DEFAULT_POMODORO = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4
}

async function init() {
  const [settings, characters] = await Promise.all([
    window.settingsAPI.loadSettings(),
    window.settingsAPI.getCharacters()
  ])

  const charSelect = document.getElementById('character')
  characters.forEach(c => {
    const opt = document.createElement('option')
    opt.value = c.id
    opt.textContent = c.name
    if (c.id === settings.character) opt.selected = true
    charSelect.appendChild(opt)
  })

  document.getElementById('task').value = settings.taskDescription || ''
  document.getElementById('anthropic-key').value = settings.anthropicKey || ''
  document.getElementById('elevenlabs-key').value = settings.elevenlabsKey || ''
  writePomodoroSettings(settings.pomodoro || DEFAULT_POMODORO)

  showSessionState(settings)
}

function setVisible(id, visible) {
  document.getElementById(id).style.display = visible ? 'block' : 'none'
}

function showActive() {
  setVisible('btn-start', false)
  setVisible('btn-update', true)
  setVisible('btn-pause', true)
  setVisible('btn-resume', false)
  document.getElementById('session-state').className = 'status-pill'
  document.getElementById('session-state').textContent = 'Active'
  document.getElementById('status').textContent = 'Session active'
}

function showPaused() {
  setVisible('btn-start', false)
  setVisible('btn-update', true)
  setVisible('btn-pause', false)
  setVisible('btn-resume', true)
  document.getElementById('session-state').className = 'status-pill paused'
  document.getElementById('session-state').textContent = 'Paused'
  document.getElementById('status').textContent = 'Session paused'
}

function showIdle() {
  setVisible('btn-start', true)
  setVisible('btn-update', false)
  setVisible('btn-pause', false)
  setVisible('btn-resume', false)
  document.getElementById('session-state').className = 'status-pill idle'
  document.getElementById('session-state').textContent = 'Idle'
  document.getElementById('status').textContent = ''
}

function showSessionState(state) {
  if (state.taskDescription && state.paused) showPaused()
  else if (state.taskDescription) showActive()
  else showIdle()
}

function clampInt(value, min, max, fallback) {
  const parsed = parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function readPomodoroSettings() {
  return {
    workMinutes: clampInt(document.getElementById('pomodoro-work').value, 1, 90, DEFAULT_POMODORO.workMinutes),
    shortBreakMinutes: clampInt(document.getElementById('pomodoro-short-break').value, 1, 45, DEFAULT_POMODORO.shortBreakMinutes),
    longBreakMinutes: clampInt(document.getElementById('pomodoro-long-break').value, 1, 90, DEFAULT_POMODORO.longBreakMinutes),
    sessionsUntilLongBreak: clampInt(document.getElementById('pomodoro-rounds').value, 1, 12, DEFAULT_POMODORO.sessionsUntilLongBreak)
  }
}

function writePomodoroSettings(settings) {
  document.getElementById('pomodoro-work').value = settings.workMinutes
  document.getElementById('pomodoro-short-break').value = settings.shortBreakMinutes
  document.getElementById('pomodoro-long-break').value = settings.longBreakMinutes
  document.getElementById('pomodoro-rounds').value = settings.sessionsUntilLongBreak
}

async function saveCurrentSettings() {
  await window.settingsAPI.saveSettings({
    character: document.getElementById('character').value,
    pomodoro: readPomodoroSettings(),
    anthropicKey: document.getElementById('anthropic-key').value,
    elevenlabsKey: document.getElementById('elevenlabs-key').value
  })
}

async function savePomodoroSettings(message) {
  writePomodoroSettings(readPomodoroSettings())
  await saveCurrentSettings()
  document.getElementById('status').textContent = message
}

document.getElementById('btn-start').addEventListener('click', async () => {
  const task = document.getElementById('task').value.trim()
  if (!task) {
    document.getElementById('status').textContent = 'Enter a task first.'
    return
  }
  await saveCurrentSettings()
  await window.settingsAPI.startSession(task)
  showActive()
})

document.getElementById('btn-update').addEventListener('click', async () => {
  const task = document.getElementById('task').value.trim()
  if (!task) { document.getElementById('status').textContent = 'Enter a task first.'; return }
  await saveCurrentSettings()
  await window.settingsAPI.startSession(task)
  document.getElementById('status').textContent = 'Task updated'
  setTimeout(() => { document.getElementById('status').textContent = 'Session active' }, 2000)
})

document.getElementById('btn-pause').addEventListener('click', async () => {
  await window.settingsAPI.pauseSession()
  showPaused()
})

document.getElementById('btn-resume').addEventListener('click', async () => {
  await window.settingsAPI.resumeSession()
  showActive()
})

document.getElementById('btn-save-pomodoro').addEventListener('click', async () => {
  await savePomodoroSettings('Timer settings applied')
})

document.getElementById('btn-reset-pomodoro').addEventListener('click', async () => {
  writePomodoroSettings(DEFAULT_POMODORO)
  await savePomodoroSettings('Classic timer restored')
})

document.getElementById('btn-reset-timer').addEventListener('click', async () => {
  await window.settingsAPI.resetPomodoroTimer()
  document.getElementById('status').textContent = 'Timer reset'
  showPaused()
})

document.getElementById('character').addEventListener('change', saveCurrentSettings)
document.getElementById('anthropic-key').addEventListener('change', saveCurrentSettings)
document.getElementById('elevenlabs-key').addEventListener('change', saveCurrentSettings)

window.settingsAPI.onSessionStateUpdate((state) => {
  showSessionState(state)
})

init()
