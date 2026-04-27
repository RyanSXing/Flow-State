const el = document.getElementById('character')
let isDragging = false
let lastX = 0
let lastY = 0

// Update character appearance
window.overlayAPI.onCharacterSet((data) => {
  if (data.avatarImage) el.src = "../" + data.avatarImage
})

// Bounce animation on reaction
window.overlayAPI.onReaction(() => {
  el.classList.remove('bouncing')
  void el.offsetWidth
  el.classList.add('bouncing')
  el.addEventListener('animationend', () => el.classList.remove('bouncing'), { once: true })
})

// Hover over character → disable click-through so mouse events are captured
el.addEventListener('mouseenter', () => {
  window.overlayAPI.setClickThrough(false)
  el.style.cursor = 'grab'
})

el.addEventListener('mouseleave', () => {
  if (!isDragging) {
    window.overlayAPI.setClickThrough(true)
    el.style.cursor = 'default'
  }
})

el.addEventListener('mousedown', (e) => {
  isDragging = true
  lastX = e.screenX
  lastY = e.screenY
  el.style.cursor = 'grabbing'
  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  const dx = e.screenX - lastX
  const dy = e.screenY - lastY
  lastX = e.screenX
  lastY = e.screenY
  if (dx !== 0 || dy !== 0) window.overlayAPI.reportMove(dx, dy)
})

document.addEventListener('mouseup', () => {
  if (!isDragging) return
  isDragging = false
  el.style.cursor = 'grab'
})

// ── Pomodoro timer ──────────────────────────────────────────────────────────
const PHASES = {
  work:          { duration: 25 * 60, label: 'WORK',       color: '#ff7a5c', fill: 'linear-gradient(90deg,#ff6b6b,#ff8e53)', glow: '0 0 10px #ff6b6b88' },
  'short-break': { duration:  5 * 60, label: 'BREAK',      color: '#43e0c0', fill: 'linear-gradient(90deg,#43b89c,#4facfe)', glow: '0 0 10px #43b89c88' },
  'long-break':  { duration: 15 * 60, label: 'LONG BREAK', color: '#43e0c0', fill: 'linear-gradient(90deg,#43b89c,#4facfe)', glow: '0 0 10px #43b89c88' }
}

let pPhase = 'work'
let pSecondsLeft = PHASES.work.duration
let pDone = 0
let pRunning = false  // starts paused — user must press play

const timerBar      = document.getElementById('timer-bar')
const timerLabel    = document.getElementById('timer-label')
const timerFill     = document.getElementById('timer-fill')
const timerDots     = document.querySelectorAll('.timer-dot')
const timerPlay     = document.getElementById('timer-play')
const timerSettings = document.getElementById('timer-settings')

// Disable click-through when hovering controls area
const timerControls = document.getElementById('timer-controls')
timerControls.addEventListener('mouseenter', () => window.overlayAPI.setClickThrough(false))
timerControls.addEventListener('mouseleave', () => {
  if (!isDragging) window.overlayAPI.setClickThrough(true)
})
timerBar.addEventListener('mouseenter', () => window.overlayAPI.setClickThrough(false))
timerBar.addEventListener('mouseleave', () => {
  if (!isDragging) window.overlayAPI.setClickThrough(true)
})

function formatTime(s) {
  return Math.floor(s / 60).toString().padStart(2, '0') + ':' + (s % 60).toString().padStart(2, '0')
}

function renderTimer() {
  const phase = PHASES[pPhase]
  const pct = ((phase.duration - pSecondsLeft) / phase.duration) * 100
  timerLabel.textContent = phase.label + ' \u00b7 ' + formatTime(pSecondsLeft)
  timerLabel.style.color = phase.color
  timerFill.style.width = pct + '%'
  timerFill.style.background = phase.fill
  timerFill.style.boxShadow = phase.glow
  timerDots.forEach(function(dot, i) {
    const filled = i < pDone
    dot.style.background = phase.color
    dot.style.opacity = filled ? '1' : '0.2'
    dot.style.boxShadow = filled ? '0 0 5px ' + phase.color : 'none'
  })
  timerBar.classList.toggle('paused', !pRunning)
  timerPlay.textContent = pRunning ? '\u23F8' : '\u25B6'
}

function advancePhase() {
  const from = pPhase
  let to
  if (pPhase === 'work') {
    pDone++
    to = pDone >= 4 ? 'long-break' : 'short-break'
  } else if (pPhase === 'long-break') {
    pDone = 0
    to = 'work'
  } else {
    to = 'work'
  }
  pPhase = to
  pSecondsLeft = PHASES[to].duration
  renderTimer()
  window.overlayAPI.sendTransition({ from: from, to: to, pomodoroCount: pDone })
  // Notify main: only keep loop active during work phases
  window.overlayAPI.setPomodoroRunning(pRunning && to === 'work')
}

function tick() {
  if (!pRunning) return
  pSecondsLeft--
  if (pSecondsLeft <= 0) {
    advancePhase()
  } else {
    renderTimer()
  }
}

setInterval(tick, 1000)
renderTimer()

// Play/pause button
timerPlay.addEventListener('click', function(e) {
  e.stopPropagation()
  pRunning = !pRunning
  renderTimer()
  window.overlayAPI.sendPause({ paused: !pRunning })
  window.overlayAPI.setPomodoroRunning(pRunning && pPhase === 'work')
})

// Settings button
timerSettings.addEventListener('click', function(e) {
  e.stopPropagation()
  window.overlayAPI.openSettings()
})
