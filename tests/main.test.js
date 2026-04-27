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
    expect(mainSource).toContain('const OVERLAY_H = 160')
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
})
