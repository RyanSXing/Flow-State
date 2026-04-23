const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, dialog, systemPreferences, nativeImage } = require('electron')
const path = require('path')
const { createLoop } = require('./src/loop')
const { getCharacter, getAllCharacters } = require('./src/characters')
const store = require('./src/store')
const memory = require('./src/memory')

let overlayWin = null
let settingsWin = null
let tray = null
let loop = null

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
  const size = 100
  const savedPos = store.getOverlayPosition()
  const x = savedPos.x !== null ? savedPos.x : width - size - 20
  const y = savedPos.y !== null ? savedPos.y : height - size - 20

  overlayWin = new BrowserWindow({
    x, y,
    width: size,
    height: size,
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

// ── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  // 16x16 white circle template image
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAA+SURBVDiNY/z//z8DJYCJgUIw+A2gygAWBgYGBlIMABswasCoAaMGjBowasCoAaMGjBowasCoAQMGAABq0QjwmSUqfQAAAABJRU5ErkJggg=='
  )
  tray = new Tray(icon)
  updateTrayMenu()
}

function updateTrayMenu() {
  const settings = store.getSettings()
  const sessionActive = !!settings.taskDescription
  const menu = Menu.buildFromTemplate([
    { label: 'Open Settings', click: createSettingsWindow },
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
          loop.start(store.getSettings().interval)
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
        avatarColor: char.avatarColor,
        avatarInitial: char.avatarInitial
      })
    }

    const currentSettings = store.getSettings()
    if (!currentSettings.paused && currentSettings.taskDescription) {
      loop.start(interval)
    }
  })

  ipcMain.handle('session:start', (_, taskDescription) => {
    store.setSetting('taskDescription', taskDescription)
    store.setSetting('paused', false)
    memory.clear()
    loop.start(store.getSettings().interval)
    updateTrayMenu()
    pushLogUpdate()
  })

  ipcMain.handle('session:pause', () => {
    store.setSetting('paused', true)
    loop.stop()
    updateTrayMenu()
  })

  ipcMain.handle('session:resume', () => {
    store.setSetting('paused', false)
    loop.start(store.getSettings().interval)
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
}

// ── Loop Setup ───────────────────────────────────────────────────────────────

function setupLoop() {
  const { powerMonitor } = require('electron')

  loop = createLoop({
    getApiKeys: () => store.getApiKeys(),
    getSettings: () => store.getSettings(),
    getCharacter: (id) => getCharacter(id),
    getIdleTime: () => powerMonitor.getSystemIdleTime(),
    onReaction: ({ dialogue }) => {
      if (overlayWin) overlayWin.webContents.send('reaction:fire', { dialogue })
      pushLogUpdate()
    }
  })

  const settings = store.getSettings()
  if (settings.taskDescription && !settings.paused) {
    loop.start(settings.interval)
  }
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.dock.hide()

app.whenReady().then(() => {
  if (!checkScreenPermission()) return

  createOverlayWindow()
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
