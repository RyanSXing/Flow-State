# Pomodoro Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a glowing pill progress bar Pomodoro timer (25/5/15 cycle) to the Flow-State overlay, centered below the character avatar, with hover-reveal pause and full AI character reactions on phase transitions.

**Architecture:** Timer state machine lives entirely in `overlay.js` (renderer). On phase transitions, renderer sends `pomodoro:transition` IPC to main, which calls `generateTransitionDialogue` + `speak` then fires `reaction:fire` back. No changes to `loop.js` or `store.js`.

**Tech Stack:** Electron IPC, vanilla JS setInterval, CSS animations, Claude Haiku API (via fetch), ElevenLabs TTS

---

## File Map

| File | Change |
|------|--------|
| `src/character.js` | Add `generateTransitionDialogue` function + export |
| `tests/character.test.js` | Add tests for `generateTransitionDialogue` |
| `preload/overlay-preload.js` | Expose `sendTransition` and `sendPause` on `overlayAPI` |
| `main.js` | Import `generateTransitionDialogue` + `speak`; add 2 IPC handlers; resize overlay window |
| `overlay/index.html` | Add `#timer-bar` DOM + CSS |
| `overlay/overlay.js` | Add pomodoro state machine, DOM updates, hover/pause logic, IPC calls |

---

## Task 1: Add `generateTransitionDialogue` to `src/character.js`

**Files:**
- Modify: `src/character.js`
- Modify: `tests/character.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/character.test.js`:

```js
const { generateTransitionDialogue } = require('../src/character')

describe('generateTransitionDialogue', () => {
  beforeEach(() => jest.clearAllMocks())

  test('calls Claude API with phase transition info', async () => {
    mockFetchSuccess('Take a breather, you earned it!')
    await generateTransitionDialogue(
      'work', 'short-break', 1,
      characterConfig,
      'build the app',
      'ant-key'
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.messages[0].content).toContain('Drill Sergeant')
    expect(body.messages[0].content).toContain('work session')
    expect(body.messages[0].content).toContain('short break')
    expect(body.messages[0].content).toContain('build the app')
  })

  test('includes pomodoro count for work→break transitions', async () => {
    mockFetchSuccess('One down, three to go!')
    await generateTransitionDialogue(
      'work', 'short-break', 1,
      characterConfig, 'study', 'ant-key'
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.messages[0].content).toContain('1 of 4')
  })

  test('returns trimmed dialogue string', async () => {
    mockFetchSuccess('  Break time!  ')
    const result = await generateTransitionDialogue(
      'work', 'short-break', 1,
      characterConfig, 'study', 'ant-key'
    )
    expect(result).toBe('Break time!')
  })

  test('throws on API error', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    await expect(
      generateTransitionDialogue('work', 'short-break', 1, characterConfig, 'task', 'key')
    ).rejects.toThrow('Claude API error: 500')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/rsxing/Flow-State/Flow-State
npx jest tests/character.test.js --no-coverage 2>&1 | tail -20
```

Expected: `generateTransitionDialogue is not a function` or similar import error.

- [ ] **Step 3: Implement `generateTransitionDialogue` in `src/character.js`**

Add after the existing `buildPrompt` function (before `generateDialogue`):

```js
function buildTransitionPrompt(from, to, pomodoroCount, characterConfig, taskDescription) {
  const labels = { work: 'work session', 'short-break': 'short break', 'long-break': 'long break' }
  const countNote = from === 'work' ? ` (pomodoro ${pomodoroCount} of 4 complete)` : ''
  return `You are ${characterConfig.name}. ${characterConfig.personalityPrompt}

The user's task: ${taskDescription || 'focused work'}
Timer transition: ${labels[from] || from}${countNote} → ${labels[to] || to}

Write exactly 1 sentence acknowledging this transition, 100 characters max. Stay in character. No stage directions.`
}

async function generateTransitionDialogue(from, to, pomodoroCount, characterConfig, taskDescription, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{ role: 'user', content: buildTransitionPrompt(from, to, pomodoroCount, characterConfig, taskDescription) }]
    })
  })
  if (!response.ok) throw new Error(`Claude API error: ${response.status}`)
  const data = await response.json()
  return data.content[0].text.trim().slice(0, 100)
}
```

Replace the final `module.exports` line with:
```js
module.exports = { generateDialogue, generateTransitionDialogue }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/character.test.js --no-coverage 2>&1 | tail -20
```

Expected: all tests pass (existing `generateDialogue` tests + 4 new `generateTransitionDialogue` tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/rsxing/Flow-State/Flow-State
git add src/character.js tests/character.test.js
git commit -m "feat: add generateTransitionDialogue for pomodoro phase transitions"
```

---

## Task 2: Add IPC bridges to `preload/overlay-preload.js`

**Files:**
- Modify: `preload/overlay-preload.js`

Current file contents:
```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('overlayAPI', {
  onCharacterSet: (cb) => ipcRenderer.on('character:set', (_, data) => cb(data)),
  onReaction: (cb) => ipcRenderer.on('reaction:fire', (_, data) => cb(data)),
  reportMove: (dx, dy) => ipcRenderer.send('overlay:moved', { dx, dy }),
  setClickThrough: (enabled) => ipcRenderer.send('overlay:click-through', enabled)
})
```

- [ ] **Step 1: Add `sendTransition` and `sendPause` to `overlayAPI`**

Replace the entire file with:

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('overlayAPI', {
  onCharacterSet: (cb) => ipcRenderer.on('character:set', (_, data) => cb(data)),
  onReaction: (cb) => ipcRenderer.on('reaction:fire', (_, data) => cb(data)),
  reportMove: (dx, dy) => ipcRenderer.send('overlay:moved', { dx, dy }),
  setClickThrough: (enabled) => ipcRenderer.send('overlay:click-through', enabled),
  sendTransition: (payload) => ipcRenderer.invoke('pomodoro:transition', payload),
  sendPause: (payload) => ipcRenderer.invoke('pomodoro:pause', payload)
})
```

- [ ] **Step 2: Commit**

```bash
cd /Users/rsxing/Flow-State/Flow-State
git add preload/overlay-preload.js
git commit -m "feat: expose sendTransition and sendPause on overlayAPI"
```

---

## Task 3: Add IPC handlers and resize overlay in `main.js`

**Files:**
- Modify: `main.js`

- [ ] **Step 1: Add imports at the top of `main.js`**

After the existing requires (after line 7 `const memory = require('./src/memory')`), add:

```js
const { generateTransitionDialogue } = require('./src/character')
const { speak } = require('./src/tts')
```

- [ ] **Step 2: Resize the overlay window**

Find and replace in `main.js`:

Old:
```js
  const size = 100
  overlayWin = new BrowserWindow({
```

New:
```js
  const OVERLAY_W = 180
  const OVERLAY_H = 160
  overlayWin = new BrowserWindow({
```

Then find and replace the width/height properties:

Old:
```js
    width: size,
    height: size,
```

New:
```js
    width: OVERLAY_W,
    height: OVERLAY_H,
```

Then update the default position calculation. Find:

Old:
```js
  const x = savedPos.x !== null ? savedPos.x : width - size - 20
  const y = savedPos.y !== null ? savedPos.y : height - size - 20
```

New:
```js
  const x = savedPos.x !== null ? savedPos.x : width - OVERLAY_W - 20
  const y = savedPos.y !== null ? savedPos.y : height - OVERLAY_H - 20
```

- [ ] **Step 3: Add the two IPC handlers**

Find the block containing `ipcMain.on('overlay:click-through', ...)` (around line 209) and add the following two handlers directly after it:

```js
  ipcMain.handle('pomodoro:transition', async (_, { from, to, pomodoroCount }) => {
    const settings = store.getSettings()
    const { anthropic, elevenlabs } = store.getApiKeys()
    const character = getCharacter(settings.character)
    try {
      const dialogue = await generateTransitionDialogue(from, to, pomodoroCount, character, settings.taskDescription, anthropic)
      await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)
      if (overlayWin) overlayWin.webContents.send('reaction:fire', { dialogue })
    } catch (err) {
      log('ERROR', `Pomodoro transition error: ${err.message}`)
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
      log('ERROR', `Pomodoro pause error: ${err.message}`)
    }
  })
```

- [ ] **Step 4: Run the full test suite to make sure nothing broke**

```bash
cd /Users/rsxing/Flow-State/Flow-State
npx jest --no-coverage 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/rsxing/Flow-State/Flow-State
git add main.js
git commit -m "feat: add pomodoro IPC handlers and resize overlay window"
```

---

## Task 4: Add timer HTML and CSS to `overlay/index.html`

**Files:**
- Modify: `overlay/index.html`

Current file:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent; overflow: hidden; user-select: none; }

    #character {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
      -webkit-app-region: no-drag;
      display: block;
      cursor: default;
    }

    #character.bouncing {
      animation: bounce 0.5s ease;
    }

    @keyframes bounce {
      0%   { transform: scale(1); }
      25%  { transform: scale(1.3) rotate(-5deg); }
      50%  { transform: scale(0.9) rotate(5deg); }
      75%  { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
  </style>
</head>
<body><img id="character" src="../assets/character.png" width="80" height="80" draggable="false" /><script src="overlay.js"></script></body>
</html>
```

- [ ] **Step 1: Replace `overlay/index.html` with the timer-enhanced version**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: transparent;
      overflow: hidden;
      user-select: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 10px 10px;
      gap: 8px;
    }

    #character {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
      -webkit-app-region: no-drag;
      display: block;
      cursor: default;
      flex-shrink: 0;
    }

    #character.bouncing {
      animation: bounce 0.5s ease;
    }

    @keyframes bounce {
      0%   { transform: scale(1); }
      25%  { transform: scale(1.3) rotate(-5deg); }
      50%  { transform: scale(0.9) rotate(5deg); }
      75%  { transform: scale(1.1); }
      100% { transform: scale(1); }
    }

    /* ── Timer bar ── */
    #timer-bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      position: relative;
      cursor: pointer;
      -webkit-app-region: no-drag;
    }

    #timer-label {
      font-family: monospace;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #ff7a5c;
    }

    #timer-track {
      width: 160px;
      height: 8px;
      background: rgba(255,255,255,0.08);
      border-radius: 99px;
      overflow: hidden;
    }

    #timer-fill {
      height: 100%;
      width: 0%;
      border-radius: 99px;
      transition: width 0.9s linear;
    }

    #timer-dots {
      display: flex;
      gap: 5px;
    }

    .timer-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ff7a5c;
      opacity: 0.2;
      transition: opacity 0.3s, box-shadow 0.3s;
    }

    #timer-pause {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(0,0,0,0.75);
      border: 1px solid rgba(255,255,255,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      line-height: 1;
      opacity: 0;
      transition: opacity 0.2s;
      -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px);
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.7; }
    }

    #timer-bar.paused #timer-fill {
      animation: pulse 1.5s ease-in-out infinite;
      transition: none;
    }
  </style>
</head>
<body>
  <img id="character" src="../assets/character.png" width="80" height="80" draggable="false" />

  <div id="timer-bar">
    <div id="timer-label">WORK · 25:00</div>
    <div id="timer-track">
      <div id="timer-fill"></div>
    </div>
    <div id="timer-dots">
      <div class="timer-dot"></div>
      <div class="timer-dot"></div>
      <div class="timer-dot"></div>
      <div class="timer-dot"></div>
    </div>
    <div id="timer-pause">⏸</div>
  </div>

  <script src="overlay.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/rsxing/Flow-State/Flow-State
git add overlay/index.html
git commit -m "feat: add timer bar HTML and CSS to overlay"
```

---

## Task 5: Add pomodoro state machine to `overlay/overlay.js`

**Files:**
- Modify: `overlay/overlay.js`

- [ ] **Step 1: Append the pomodoro state machine to the end of `overlay/overlay.js`**

Add the following after the existing `document.addEventListener('mouseup', ...)` block:

```js
// ── Pomodoro timer ──────────────────────────────────────────────────────────
const PHASES = {
  work:          { duration: 25 * 60, label: 'WORK',       color: '#ff7a5c', fill: 'linear-gradient(90deg,#ff6b6b,#ff8e53)', glow: '0 0 10px #ff6b6b88' },
  'short-break': { duration:  5 * 60, label: 'BREAK',      color: '#43e0c0', fill: 'linear-gradient(90deg,#43b89c,#4facfe)', glow: '0 0 10px #43b89c88' },
  'long-break':  { duration: 15 * 60, label: 'LONG BREAK', color: '#43e0c0', fill: 'linear-gradient(90deg,#43b89c,#4facfe)', glow: '0 0 10px #43b89c88' }
}

let pPhase = 'work'
let pSecondsLeft = PHASES.work.duration
let pDone = 0        // completed work sessions this cycle (0–4)
let pRunning = true
let pInterval = null

const timerBar   = document.getElementById('timer-bar')
const timerLabel = document.getElementById('timer-label')
const timerFill  = document.getElementById('timer-fill')
const timerDots  = document.querySelectorAll('.timer-dot')
const timerPause = document.getElementById('timer-pause')

function formatTime(s) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

function renderTimer() {
  const phase = PHASES[pPhase]
  const pct = ((phase.duration - pSecondsLeft) / phase.duration) * 100
  timerLabel.textContent = `${phase.label} · ${formatTime(pSecondsLeft)}`
  timerLabel.style.color = phase.color
  timerFill.style.width = `${pct}%`
  timerFill.style.background = phase.fill
  timerFill.style.boxShadow = phase.glow
  timerDots.forEach((dot, i) => {
    const filled = i < pDone
    dot.style.background = phase.color
    dot.style.opacity = filled ? '1' : '0.2'
    dot.style.boxShadow = filled ? `0 0 5px ${phase.color}` : 'none'
  })
  timerBar.classList.toggle('paused', !pRunning)
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
  window.overlayAPI.sendTransition({ from, to, pomodoroCount: pDone })
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

pInterval = setInterval(tick, 1000)
renderTimer()

// Hover: show pause button + disable click-through
timerBar.addEventListener('mouseenter', () => {
  window.overlayAPI.setClickThrough(false)
  timerPause.style.opacity = '1'
})

timerBar.addEventListener('mouseleave', () => {
  if (!isDragging) {
    window.overlayAPI.setClickThrough(true)
    timerPause.style.opacity = '0'
  }
})

// Pause button click
timerPause.addEventListener('click', (e) => {
  e.stopPropagation()
  pRunning = !pRunning
  timerBar.classList.toggle('paused', !pRunning)
  timerPause.textContent = pRunning ? '⏸' : '▶'
  window.overlayAPI.sendPause({ paused: !pRunning })
})
```

- [ ] **Step 2: Manual smoke test**

Start the app and verify:
```bash
cd /Users/rsxing/Flow-State/Flow-State
npm start
```

Check:
- Timer bar appears below the character avatar
- Countdown ticks down from 25:00
- Hovering over timer area reveals the pause button
- Clicking pause stops the timer, bar pulses, button shows ▶
- Clicking ▶ resumes the timer

- [ ] **Step 3: Commit**

```bash
cd /Users/rsxing/Flow-State/Flow-State
git add overlay/overlay.js
git commit -m "feat: add pomodoro state machine to overlay"
```

---

## Task 6: End-to-end phase transition test

- [ ] **Step 1: Speed-test a transition (temporary)**

To verify the full reaction chain without waiting 25 minutes, temporarily change `PHASES.work.duration` to `5` in `overlay/overlay.js`:

```js
work: { duration: 5, label: 'WORK', ... }
```

Start the app with API keys set, set a task in settings, and wait 5 seconds. Verify:
- Timer hits 0, advances to BREAK phase
- Character bounces
- AI voice line plays
- Dot fills

- [ ] **Step 2: Restore production durations**

Revert `PHASES.work.duration` back to `25 * 60`.

- [ ] **Step 3: Run full test suite one final time**

```bash
cd /Users/rsxing/Flow-State/Flow-State
npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Final commit**

```bash
cd /Users/rsxing/Flow-State/Flow-State
git add -A
git commit -m "feat: pomodoro timer complete — bar, transitions, character reactions"
```
