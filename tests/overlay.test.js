const fs = require('fs')
const path = require('path')

const overlaySource = fs.readFileSync(path.join(__dirname, '..', 'overlay', 'overlay.js'), 'utf8')
const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'preload', 'overlay-preload.js'), 'utf8')
const overlayHtml = fs.readFileSync(path.join(__dirname, '..', 'overlay', 'index.html'), 'utf8')

describe('overlay pomodoro settings sync', () => {
  test('overlay preload exposes pomodoro settings updates', () => {
    expect(preloadSource).toContain('onPomodoroSettingsUpdate')
    expect(preloadSource).toContain("ipcRenderer.on('pomodoro:settings-update'")
  })

  test('overlay preload exposes pomodoro reset updates', () => {
    expect(preloadSource).toContain('onPomodoroReset')
    expect(preloadSource).toContain("ipcRenderer.on('pomodoro:reset'")
  })

  test('overlay uses configurable pomodoro durations', () => {
    expect(overlaySource).toContain('pomodoroSettings')
    expect(overlaySource).toContain('applyPomodoroSettings')
    expect(overlaySource).toContain('workMinutes * 60')
    expect(overlaySource).toContain('sessionsUntilLongBreak')
    expect(overlaySource).toContain('window.overlayAPI.onPomodoroSettingsUpdate')
  })

  test('overlay resets pomodoro phase progress and running state', () => {
    expect(overlaySource).toContain('resetPomodoroTimer')
    expect(overlaySource).toContain("pPhase = 'work'")
    expect(overlaySource).toContain('pSecondsLeft = PHASES.work.duration')
    expect(overlaySource).toContain('pDone = 0')
    expect(overlaySource).toContain('pRunning = false')
    expect(overlaySource).toContain('window.overlayAPI.onPomodoroReset')
  })

  test('overlay renders sprite-backed avatars', () => {
    expect(overlayHtml).toContain('div id="character"')
    expect(overlaySource).toContain('avatarSprite')
    expect(overlaySource).toContain('applyAvatarSprite')
    expect(overlaySource).toContain('playAvatarAnimation')
    expect(overlaySource).toContain('backgroundPosition')
  })

  test('overlay supports separate idle talking and swing avatar animations', () => {
    expect(preloadSource).toContain('onAvatarTalking')
    expect(preloadSource).toContain("ipcRenderer.on('avatar:talking'")
    expect(overlaySource).toContain('avatarSpriteStates')
    expect(overlaySource).toContain("playAvatarAnimation('talking')")
    expect(overlaySource).toContain("playAvatarAnimation('swing')")
    expect(overlaySource).toContain("playAvatarAnimation('idle')")
    expect(overlaySource).toContain('const sourceFrame = getAvatarSourceFrame(frame)')
    expect(overlaySource).toContain('avatarSprite.offsetY || 0')
    expect(overlaySource).toContain('const bgY = Math.round(((avatarSprite.offsetY || 0) - sourceFrame.y) * scale)')
    expect(overlaySource).toContain('sourceFrame.x')
    expect(overlaySource).toContain('avatarSprite.sheetWidth')
    expect(overlaySource).toContain('playRestingAvatarAnimation()')
    expect(overlaySource).toMatch(/onAvatarTalking[\s\S]*if \(data\.talking\)[\s\S]*playAvatarAnimation\('talking'\)[\s\S]*} else {\s+playAvatarAnimation\('swing'\)\s+}/)
  })

  test('overlay avatar and controls stay readable on light backgrounds', () => {
    expect(overlayHtml).toContain('background-color: #fff')
    expect(overlayHtml).toContain('overflow: hidden')
    expect(overlayHtml).toContain('border-radius: 50%')
    expect(overlayHtml).toContain('background-size: contain')
    expect(overlayHtml).toContain('background: #fff')
    expect(overlayHtml).toContain('color: #24312f')
    expect(overlaySource).toContain("el.style.backgroundPosition = bgX + 'px ' + bgY + 'px'")
    expect(overlaySource).toContain('const scale = 88 / avatarSprite.frameWidth')
  })

  test('overlay uses simplified chrome and prominent timer label', () => {
    expect(overlayHtml).toContain('box-shadow: none')
    expect(overlayHtml).toContain('font-size: 12px')
    expect(overlayHtml).toContain('letter-spacing: 1px')
    expect(overlayHtml).toContain('color: #17201f')
    expect(overlayHtml).not.toContain('0 0 0 3px rgba(255,255,255,0.9)')
  })
})
