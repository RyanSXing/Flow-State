const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, dialog, systemPreferences, nativeImage } = require('electron')
const path = require('path')
const { createLoop } = require('./src/loop')
const { log, emitter: logEmitter } = require('./src/logger')
const { getCharacter, getAllCharacters } = require('./src/characters')
const store = require('./src/store')
const memory = require('./src/memory')
const { generateTransitionDialogue } = require('./src/character')
const { speak } = require('./src/tts')

let overlayWin = null
let settingsWin = null
let devtoolsWin = null
let tray = null
let loop = null
let pomodoroActive = false

// ── Screen Recording Permission ──────────────────────────────────────────────

function checkScreenPermission() {
  const status = systemPreferences.getMediaAccessStatus('screen')
  if (status !== 'granted') {
    console.warn('[permissions] Screen Recording not granted yet — screenshots will fail until permission is given in System Preferences → Privacy & Security → Screen Recording')
  }
  return true
}

// ── Overlay Window ───────────────────────────────────────────────────────────

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const OVERLAY_W = 180
  const OVERLAY_H = 190
  const savedPos = store.getOverlayPosition()
  const x = savedPos.x !== null ? savedPos.x : width - OVERLAY_W - 20
  const y = savedPos.y !== null ? savedPos.y : height - OVERLAY_H - 20

  overlayWin = new BrowserWindow({
    x, y,
    width: OVERLAY_W,
    height: OVERLAY_H,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload', 'overlay-preload.js')
    }
  })

  overlayWin.setIgnoreMouseEvents(true, { forward: true })
  overlayWin.loadFile(path.join(__dirname, 'overlay', 'index.html'))

  overlayWin.webContents.on('did-finish-load', () => {
    const settings = store.getSettings()
    const character = getCharacter(settings.character)
    overlayWin.webContents.send('character:set', {
      avatarImage: character.avatarImage,
      avatarColor: character.avatarColor,
      avatarInitial: character.avatarInitial
    })
  })
}

// ── Settings Window ──────────────────────────────────────────────────────────

function createSettingsWindow() {
  if (settingsWin) { settingsWin.focus(); return }

  settingsWin = new BrowserWindow({
    width: 380,
    height: 640,
    title: 'Flow State',
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload', 'settings-preload.js')
    }
  })

  settingsWin.loadFile(path.join(__dirname, 'settings', 'index.html'))
  settingsWin.on('closed', () => { settingsWin = null })
}

function createDevtoolsWindow() {
  if (devtoolsWin) { devtoolsWin.focus(); return }
  devtoolsWin = new BrowserWindow({
    width: 700,
    height: 500,
    title: 'Flow State — Dev Terminal',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload', 'devtools-preload.js')
    }
  })
  devtoolsWin.loadFile(path.join(__dirname, 'devtools', 'index.html'))
  devtoolsWin.on('closed', () => { devtoolsWin = null })
}

// ── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'))
  tray = new Tray(icon)
  updateTrayMenu()
}

function updateTrayMenu() {
  const settings = store.getSettings()
  const sessionActive = !!settings.taskDescription
  const menu = Menu.buildFromTemplate([
    { label: 'Open Settings', click: createSettingsWindow },
    { type: 'separator' },
    { label: 'Dev Terminal', click: createDevtoolsWindow },
    { type: 'separator' },
    {
      label: settings.paused ? 'Resume Session' : 'Pause Session',
      enabled: sessionActive,
      click: () => {
        const newPaused = !store.getSettings().paused
        store.setSetting('paused', newPaused)
        if (newPaused) {
          loop.stop()
        } else {
          loop.start()
        }
        updateTrayMenu()
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
  tray.setToolTip('Flow State')
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

function pushLogUpdate() {
  if (!settingsWin) return
  settingsWin.webContents.send('session:log-update', memory.getRecent(50))
}

function registerIPC() {
  ipcMain.handle('settings:load', () => {
    const settings = store.getSettings()
    const keys = store.getApiKeys()
    return { ...settings, anthropicKey: keys.anthropic, elevenlabsKey: keys.elevenlabs }
  })

  ipcMain.handle('settings:save', (_, { character, interval, anthropicKey, elevenlabsKey }) => {
    store.setSetting('character', character)
    store.setSetting('interval', interval)
    store.setApiKey('anthropic', anthropicKey || '')
    store.setApiKey('elevenlabs', elevenlabsKey || '')

    if (overlayWin) {
      const char = getCharacter(character)
      overlayWin.webContents.send('character:set', {
        avatarImage: char.avatarImage,
        avatarColor: char.avatarColor,
        avatarInitial: char.avatarInitial
      })
    }

    const currentSettings = store.getSettings()
    if (!currentSettings.paused && currentSettings.taskDescription) {
      loop.start()
    }
  })

  ipcMain.handle('session:start', (_, taskDescription) => {
    store.setSetting('taskDescription', taskDescription)
    store.setSetting('paused', false)
    memory.clear()
    log('SESSION', `Session started — task: "${taskDescription}"`)
    loop.start()
    updateTrayMenu()
    pushLogUpdate()
  })

  ipcMain.handle('session:pause', () => {
    store.setSetting('paused', true)
    log('SESSION', 'Session paused')
    loop.stop()
    updateTrayMenu()
  })

  ipcMain.handle('session:resume', () => {
    store.setSetting('paused', false)
    log('SESSION', 'Session resumed')
    loop.start()
    updateTrayMenu()
  })

  ipcMain.handle('characters:get', () => getAllCharacters())

  ipcMain.on('overlay:moved', (_, { dx, dy }) => {
    if (!overlayWin) return
    const [cx, cy] = overlayWin.getPosition()
    const nx = cx + dx
    const ny = cy + dy
    overlayWin.setPosition(nx, ny)
    store.setOverlayPosition(nx, ny)
  })

  ipcMain.on('overlay:click-through', (_, enabled) => {
    if (!overlayWin) return
    overlayWin.setIgnoreMouseEvents(enabled, { forward: true })
  })

  ipcMain.handle('pomodoro:transition', async (_, { from, to, pomodoroCount }) => {
    const settings = store.getSettings()
    const { anthropic, elevenlabs } = store.getApiKeys()
    const character = getCharacter(settings.character)
    try {
      const dialogue = await generateTransitionDialogue(from, to, pomodoroCount, character, settings.taskDescription, anthropic)
      await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)
      if (overlayWin) overlayWin.webContents.send('reaction:fire', { dialogue })
    } catch (err) {
      log('ERROR', 'Pomodoro transition error: ' + err.message)
      if (overlayWin) overlayWin.webContents.send('reaction:fire', {})
    }
  })

  ipcMain.handle('pomodoro:pause', async (_, { paused }) => {
    const settings = store.getSettings()
    const { anthropic, elevenlabs } = store.getApiKeys()
    const character = getCharacter(settings.character)
    try {
      const from = paused ? 'running' : 'paused'
      const to = paused ? 'paused' : 'running'
      const dialogue = await generateTransitionDialogue(from, to, 0, character, settings.taskDescription, anthropic)
      await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)
      if (overlayWin) overlayWin.webContents.send('reaction:fire', { dialogue })
    } catch (err) {
      log('ERROR', 'Pomodoro pause error: ' + err.message)
    }
  })

  ipcMain.on('pomodoro:running', (_, { active }) => {
    pomodoroActive = active
  })

  ipcMain.on('settings:open', () => {
    if (settingsWin) { settingsWin.show(); settingsWin.focus() }
  })

  ipcMain.on('devtools:clear', () => {})
}

// ── Loop Setup ───────────────────────────────────────────────────────────────

function setupLoop() {
  const { powerMonitor } = require('electron')

  loop = createLoop({
    getApiKeys: () => store.getApiKeys(),
    getSettings: () => store.getSettings(),
    getCharacter: (id) => getCharacter(id),
    getIdleTime: () => powerMonitor.getSystemIdleTime(),
    getPomodoroActive: () => pomodoroActive,
    onReaction: ({ dialogue }) => {
      if (overlayWin) overlayWin.webContents.send('reaction:fire', { dialogue })
      pushLogUpdate()
    }
  })

  const settings = store.getSettings()
  logEmitter.on('log', (entry) => {
    if (devtoolsWin) devtoolsWin.webContents.send('devtools:log', entry)
  })
  if (settings.taskDescription && !settings.paused) {
    loop.start()
  }
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.dock.hide()

app.whenReady().then(() => {
  if (!checkScreenPermission()) return

  createOverlayWindow()
  log('SYSTEM', 'Flow State started')
  createTray()
  registerIPC()
  setupLoop()
})

app.on('window-all-closed', (e) => {
  e.preventDefault()
})

app.on('before-quit', () => {
  if (loop) loop.stop()
})
