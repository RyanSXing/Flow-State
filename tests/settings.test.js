const fs = require('fs')
const path = require('path')

const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings', 'settings.js'), 'utf8')
const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'preload', 'settings-preload.js'), 'utf8')
const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'settings', 'index.html'), 'utf8')

describe('settings session state sync', () => {
  test('preload exposes session state updates from main', () => {
    expect(preloadSource).toContain('onSessionStateUpdate')
    expect(preloadSource).toContain("ipcRenderer.on('session:state-update'")
  })

  test('settings renderer updates pause and resume controls from main state', () => {
    expect(settingsSource).toContain('window.settingsAPI.onSessionStateUpdate')
    expect(settingsSource).toContain('showSessionState')
    expect(settingsSource).toContain('if (state.taskDescription && state.paused) showPaused()')
    expect(settingsSource).toContain('else if (state.taskDescription) showActive()')
    expect(settingsSource).toContain('else showIdle()')
  })

  test('settings page removes check interval and session log surfaces', () => {
    expect(settingsHtml).not.toContain('id="interval"')
    expect(settingsHtml).not.toContain('Check Interval')
    expect(settingsHtml).not.toContain('id="session-log"')
    expect(settingsHtml).not.toContain('Session Log')
    expect(settingsSource).not.toContain('interval-label')
    expect(settingsSource).not.toContain('onLogUpdate')
  })

  test('settings page exposes editable pomodoro timer controls', () => {
    expect(settingsHtml).toContain('id="pomodoro-work"')
    expect(settingsHtml).toContain('id="pomodoro-short-break"')
    expect(settingsHtml).toContain('id="pomodoro-long-break"')
    expect(settingsHtml).toContain('id="pomodoro-rounds"')
    expect(settingsSource).toContain('readPomodoroSettings')
    expect(settingsSource).toContain('pomodoro: readPomodoroSettings()')
  })

  test('settings page exposes a live timer reset action', () => {
    expect(preloadSource).toContain('resetPomodoroTimer')
    expect(preloadSource).toContain("ipcRenderer.invoke('pomodoro:reset'")
    expect(settingsHtml).toContain('id="btn-reset-timer"')
    expect(settingsSource).toContain("document.getElementById('btn-reset-timer')")
    expect(settingsSource).toContain('window.settingsAPI.resetPomodoroTimer()')
  })
})
