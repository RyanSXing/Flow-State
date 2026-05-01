const fs = require('fs')
const path = require('path')

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8')

describe('main.js pomodoro IPC wiring', () => {
  test('imports transition dialogue and speech helpers', () => {
    expect(mainSource).toContain("const { generateTransitionDialogue } = require('./src/character')")
    expect(mainSource).toContain("const { speak } = require('./src/tts')")
  })

  test('uses expanded overlay dimensions for window size and placement', () => {
    expect(mainSource).toContain('const OVERLAY_W = 180')
    expect(mainSource).toContain('const OVERLAY_H = 205')
    expect(mainSource).toContain('width: OVERLAY_W')
    expect(mainSource).toContain('height: OVERLAY_H')
    expect(mainSource).toContain('width - OVERLAY_W - 20')
    expect(mainSource).toContain('height - OVERLAY_H - 20')
  })

  test('registers pomodoro transition and pause handlers', () => {
    expect(mainSource).toContain("ipcMain.handle('pomodoro:transition'")
    expect(mainSource).toContain("ipcMain.handle('pomodoro:pause'")
    expect(mainSource).toContain("await generateTransitionDialogue(from, to, pomodoroCount, character, settings.taskDescription, anthropic)")
    expect(mainSource).toContain("await generateTransitionDialogue(from, to, 0, character, settings.taskDescription, anthropic)")
    expect(mainSource).toContain("await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)")
    expect(mainSource).toContain("log('ERROR', 'Pomodoro transition error: ' + err.message)")
    expect(mainSource).toContain("log('ERROR', 'Pomodoro pause error: ' + err.message)")
  })

  test('notifies settings when pomodoro running changes session paused state', () => {
    expect(mainSource).toContain("settingsWin.webContents.send('session:state-update'")
    expect(mainSource).toContain('pushSessionStateUpdate()')
    expect(mainSource).toContain("ipcMain.on('pomodoro:running'")
  })

  test('pushes saved pomodoro settings to overlay', () => {
    expect(mainSource).toContain('pushPomodoroSettingsUpdate()')
    expect(mainSource).toContain("overlayWin.webContents.send('pomodoro:settings-update'")
    expect(mainSource).toContain("store.setSetting('pomodoro', pomodoro)")
  })

  test('forwards settings timer reset requests to overlay', () => {
    expect(mainSource).toContain("ipcMain.handle('pomodoro:reset'")
    expect(mainSource).toContain("overlayWin.webContents.send('pomodoro:reset'")
  })

  test('passes sprite metadata to overlay when character changes', () => {
    expect(mainSource).toContain('avatarSprite: character.avatarSprite')
    expect(mainSource).toContain('avatarSprite: char.avatarSprite')
  })

  test('plays talking animation during voice and reaction after voice', () => {
    expect(mainSource).toContain('pushAvatarTalking(true)')
    expect(mainSource).toContain('pushAvatarTalking(false)')
    expect(mainSource).toContain("overlayWin.webContents.send('avatar:talking'")
    expect(mainSource).toContain("overlayWin.webContents.send('reaction:fire', { dialogue })")
  })
})
