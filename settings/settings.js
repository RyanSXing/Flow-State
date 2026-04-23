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
  document.getElementById('interval').value = settings.interval
  document.getElementById('interval-label').textContent = `Check every ${settings.interval} seconds`
  document.getElementById('anthropic-key').value = settings.anthropicKey || ''
  document.getElementById('elevenlabs-key').value = settings.elevenlabsKey || ''

  if (settings.taskDescription && settings.paused) showPaused()
  else if (settings.taskDescription) showActive()
}

function showActive() {
  document.getElementById('btn-start').style.display = 'none'
  document.getElementById('btn-pause').style.display = 'inline-block'
  document.getElementById('btn-resume').style.display = 'none'
  document.getElementById('status').textContent = 'Session active'
}

function showPaused() {
  document.getElementById('btn-start').style.display = 'none'
  document.getElementById('btn-pause').style.display = 'none'
  document.getElementById('btn-resume').style.display = 'inline-block'
  document.getElementById('status').textContent = 'Session paused'
}

function showIdle() {
  document.getElementById('btn-start').style.display = 'inline-block'
  document.getElementById('btn-pause').style.display = 'none'
  document.getElementById('btn-resume').style.display = 'none'
  document.getElementById('status').textContent = ''
}

async function saveCurrentSettings() {
  await window.settingsAPI.saveSettings({
    character: document.getElementById('character').value,
    interval: parseInt(document.getElementById('interval').value),
    anthropicKey: document.getElementById('anthropic-key').value,
    elevenlabsKey: document.getElementById('elevenlabs-key').value
  })
}

document.getElementById('interval').addEventListener('input', (e) => {
  document.getElementById('interval-label').textContent = `Check every ${e.target.value} seconds`
})

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

document.getElementById('btn-pause').addEventListener('click', async () => {
  await window.settingsAPI.pauseSession()
  showPaused()
})

document.getElementById('btn-resume').addEventListener('click', async () => {
  await window.settingsAPI.resumeSession()
  showActive()
})

document.getElementById('character').addEventListener('change', saveCurrentSettings)
document.getElementById('anthropic-key').addEventListener('change', saveCurrentSettings)
document.getElementById('elevenlabs-key').addEventListener('change', saveCurrentSettings)

window.settingsAPI.onLogUpdate((events) => {
  const log = document.getElementById('session-log')
  if (!events || !events.length) {
    log.innerHTML = '<div style="color:#333">No events yet.</div>'
    return
  }
  log.innerHTML = events.map(e => `
    <div class="log-entry">
      <span class="log-time">[${e.time}]</span>
      <span class="${e.onTask ? 'log-on' : 'log-off'}">${e.onTask ? '✓' : '✗'}</span>
      ${e.activity}
    </div>
  `).join('')
  log.scrollTop = log.scrollHeight
})

init()
