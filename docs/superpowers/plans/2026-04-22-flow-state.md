# Flow State Focus Coach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS background focus coach Electron app that periodically screenshots the screen, uses Claude Vision to determine if the user is on-task, and plays a voiced character reaction via ElevenLabs TTS — with session memory enabling contextual callbacks.

**Architecture:** Electron with three surfaces: a click-through overlay (persistent character), a settings window (tray-accessible), and the main process (core loop, IPC hub). All AI/TTS calls happen in the main process via native fetch. Logic modules are framework-agnostic and fully unit-testable with Jest.

**Tech Stack:** Electron 28, Node.js 18+ (native fetch), electron-store v8, screenshot-desktop, Jest 29.

---

## File Map

| File | Responsibility |
|---|---|
| `main.js` | Main process: app lifecycle, tray, window creation, IPC handlers, screen permission check |
| `src/store.js` | electron-store wrapper: API keys, settings, overlay position — no electron imports |
| `src/memory.js` | In-memory session event log: addEvent, getRecent, clear, formatForPrompt |
| `src/capture.js` | screenshot-desktop wrapper: returns base64 PNG string |
| `src/analyzer.js` | Claude Vision API call: `(base64, taskDescription, apiKey) → {onTask, activity, confidence}` |
| `src/character.js` | Claude Text API call: `(verdict, memory, characterConfig, taskDescription, apiKey) → string` |
| `src/tts.js` | ElevenLabs TTS: `(text, voiceId, apiKey)` → saves temp MP3, plays via afplay, deletes |
| `src/loop.js` | Core loop: wires capture→analyze→character→tts, idle detection, interval management |
| `src/characters/index.js` | Preset character configs array |
| `overlay/index.html` | Overlay BrowserWindow: character placeholder + bounce animation |
| `overlay/overlay.js` | Overlay renderer: IPC handlers, drag logic, animations |
| `settings/index.html` | Settings BrowserWindow: all controls |
| `settings/settings.js` | Settings renderer: form logic, IPC to main |
| `preload/overlay-preload.js` | contextBridge for overlay window |
| `preload/settings-preload.js` | contextBridge for settings window |
| `tests/*.test.js` | Jest unit tests for all src/ modules |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `main.js` (stub)
- Create: `jest.config.js`
- Create: directories

- [ ] **Step 1: Create package.json**

```json
{
  "name": "flow-state",
  "version": "0.1.0",
  "description": "Focus coach desktop app",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "test": "jest"
  },
  "dependencies": {
    "electron-store": "^8.1.0",
    "screenshot-desktop": "^1.12.7"
  },
  "devDependencies": {
    "electron": "^28.3.0",
    "jest": "^29.7.0"
  }
}
```

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p src/characters overlay settings preload tests
```

- [ ] **Step 3: Create stub main.js**

```js
const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 400, height: 300 })
  win.loadURL('data:text/html,<h1>Flow State loading...</h1>')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 4: Create jest.config.js**

```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js']
}
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Verify app launches**

```bash
npm start
```

Expected: Electron window appears with "Flow State loading..." text. Quit with Cmd+Q.

- [ ] **Step 7: Commit**

```bash
git init
git add package.json main.js jest.config.js .gitignore
git commit -m "chore: project scaffold"
```

Note: Create `.gitignore` first:
```
node_modules/
dist/
*.mp3
.DS_Store
```

---

### Task 2: Store Module

**Files:**
- Create: `src/store.js`
- Create: `tests/store.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/store.test.js`:
```js
const mockStore = { get: jest.fn(), set: jest.fn() }
jest.mock('electron-store', () => jest.fn(() => mockStore))

const { getApiKeys, setApiKey, getSettings, setSetting, getOverlayPosition, setOverlayPosition } = require('../src/store')

describe('store', () => {
  beforeEach(() => jest.clearAllMocks())

  test('getApiKeys returns both keys', () => {
    mockStore.get.mockReturnValueOnce('ant-key').mockReturnValueOnce('el-key')
    expect(getApiKeys()).toEqual({ anthropic: 'ant-key', elevenlabs: 'el-key' })
    expect(mockStore.get).toHaveBeenCalledWith('anthropicKey', '')
    expect(mockStore.get).toHaveBeenCalledWith('elevenlabsKey', '')
  })

  test('setApiKey stores anthropic key', () => {
    setApiKey('anthropic', 'new-key')
    expect(mockStore.set).toHaveBeenCalledWith('anthropicKey', 'new-key')
  })

  test('setApiKey stores elevenlabs key', () => {
    setApiKey('elevenlabs', 'el-new')
    expect(mockStore.set).toHaveBeenCalledWith('elevenlabsKey', 'el-new')
  })

  test('getSettings returns defaults', () => {
    mockStore.get.mockImplementation((key, def) => def)
    expect(getSettings()).toEqual({
      character: 'drill-sergeant',
      interval: 20,
      paused: false,
      taskDescription: ''
    })
  })

  test('setSetting stores key-value', () => {
    setSetting('interval', 30)
    expect(mockStore.set).toHaveBeenCalledWith('interval', 30)
  })

  test('getOverlayPosition returns stored or null defaults', () => {
    mockStore.get.mockImplementation((key, def) => def)
    expect(getOverlayPosition()).toEqual({ x: null, y: null })
  })

  test('setOverlayPosition stores x and y', () => {
    setOverlayPosition(100, 200)
    expect(mockStore.set).toHaveBeenCalledWith('overlayX', 100)
    expect(mockStore.set).toHaveBeenCalledWith('overlayY', 200)
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest tests/store.test.js
```

Expected: FAIL — `Cannot find module '../src/store'`

- [ ] **Step 3: Implement src/store.js**

```js
const Store = require('electron-store')

const store = new Store()

function getApiKeys() {
  return {
    anthropic: store.get('anthropicKey', ''),
    elevenlabs: store.get('elevenlabsKey', '')
  }
}

function setApiKey(provider, value) {
  store.set(provider === 'anthropic' ? 'anthropicKey' : 'elevenlabsKey', value)
}

function getSettings() {
  return {
    character: store.get('character', 'drill-sergeant'),
    interval: store.get('interval', 20),
    paused: store.get('paused', false),
    taskDescription: store.get('taskDescription', '')
  }
}

function setSetting(key, value) {
  store.set(key, value)
}

function getOverlayPosition() {
  return {
    x: store.get('overlayX', null),
    y: store.get('overlayY', null)
  }
}

function setOverlayPosition(x, y) {
  store.set('overlayX', x)
  store.set('overlayY', y)
}

module.exports = { getApiKeys, setApiKey, getSettings, setSetting, getOverlayPosition, setOverlayPosition }
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest tests/store.test.js
```

Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/store.js tests/store.test.js
git commit -m "feat: store module with electron-store wrapper"
```

---

### Task 3: Session Memory Module

**Files:**
- Create: `src/memory.js`
- Create: `tests/memory.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/memory.test.js`:
```js
const memory = require('../src/memory')

describe('memory', () => {
  beforeEach(() => memory.clear())

  test('starts empty', () => {
    expect(memory.getRecent(10)).toEqual([])
  })

  test('addEvent stores an event with timestamp', () => {
    memory.addEvent({ onTask: true, activity: 'reading textbook' })
    const events = memory.getRecent(10)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ onTask: true, activity: 'reading textbook' })
    expect(events[0].time).toMatch(/^\d{2}:\d{2}$/)
  })

  test('getRecent returns at most N events', () => {
    for (let i = 0; i < 15; i++) memory.addEvent({ onTask: true, activity: `activity ${i}` })
    expect(memory.getRecent(10)).toHaveLength(10)
  })

  test('getRecent returns most recent events', () => {
    for (let i = 0; i < 15; i++) memory.addEvent({ onTask: true, activity: `activity ${i}` })
    const recent = memory.getRecent(10)
    expect(recent[9].activity).toBe('activity 14')
  })

  test('clear empties the log', () => {
    memory.addEvent({ onTask: false, activity: 'watching youtube' })
    memory.clear()
    expect(memory.getRecent(10)).toEqual([])
  })

  test('formatForPrompt returns readable string', () => {
    memory.addEvent({ onTask: false, activity: 'watching League of Legends gameplay' })
    memory.addEvent({ onTask: true, activity: 'reading math notes' })
    const formatted = memory.formatForPrompt()
    expect(formatted).toContain('watching League of Legends gameplay')
    expect(formatted).toContain('reading math notes')
    expect(formatted).toContain('OFF-TASK')
    expect(formatted).toContain('ON-TASK')
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest tests/memory.test.js
```

Expected: FAIL — `Cannot find module '../src/memory'`

- [ ] **Step 3: Implement src/memory.js**

```js
const events = []

function addEvent({ onTask, activity }) {
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  events.push({ time, onTask, activity })
}

function getRecent(n) {
  return events.slice(-n)
}

function clear() {
  events.length = 0
}

function formatForPrompt() {
  return getRecent(10)
    .map(e => `[${e.time}] ${e.onTask ? 'ON-TASK' : 'OFF-TASK'}: ${e.activity}`)
    .join('\n')
}

module.exports = { addEvent, getRecent, clear, formatForPrompt }
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest tests/memory.test.js
```

Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/memory.js tests/memory.test.js
git commit -m "feat: session memory module"
```

---

### Task 4: Character Configs

**Files:**
- Create: `src/characters/index.js`

No unit tests needed — this is pure static data.

- [ ] **Step 1: Create character configs**

Create `src/characters/index.js`:
```js
const characters = [
  {
    id: 'drill-sergeant',
    name: 'Drill Sergeant',
    personalityPrompt: `You are a strict military drill sergeant who takes productivity extremely seriously. You call the user "soldier" or "recruit". You use military language and bark commands. When they're off-task you are furious and disappointed. When they're on-task you are briefly impressed but immediately set a higher bar. You are never soft. Keep reactions short and punchy.`,
    elevenLabsVoiceId: 'pNInz6obpgDQGcFmaJgB',
    avatarColor: '#8B0000',
    avatarInitial: 'DS'
  },
  {
    id: 'disappointed-mom',
    name: 'Disappointed Mom',
    personalityPrompt: `You are a loving but deeply disappointed mother. You sigh often. You mention sacrifices you made and how you raised them better than this. When they're off-task you are heartbroken but not angry — just let down. When they're on-task you are tearfully proud and tell them you always knew they could do it. You are warm, guilt-inducing, and genuine.`,
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    avatarColor: '#8B4513',
    avatarInitial: 'DM'
  },
  {
    id: 'anime-rival',
    name: 'Anime Rival',
    personalityPrompt: `You are the user's dramatic anime rival. You find their failures personally offensive — not because you hate them, but because you respect them and this is beneath them. When they're off-task you call them pathetic, hopeless, or a disappointment to your rivalry. When they're on-task you grudgingly acknowledge it while insisting you are still superior. You are theatrical, passionate, and weirdly affectionate. Use exclamation points freely.`,
    elevenLabsVoiceId: 'ErXwobaYiN019PkySvjV',
    avatarColor: '#4B0082',
    avatarInitial: 'AR'
  }
]

function getCharacter(id) {
  return characters.find(c => c.id === id) || characters[0]
}

function getAllCharacters() {
  return characters
}

module.exports = { getCharacter, getAllCharacters }
```

- [ ] **Step 2: Verify it loads**

```bash
node -e "const c = require('./src/characters'); console.log(c.getAllCharacters().map(x => x.name))"
```

Expected: `[ 'Drill Sergeant', 'Disappointed Mom', 'Anime Rival' ]`

- [ ] **Step 3: Commit**

```bash
git add src/characters/index.js
git commit -m "feat: preset character configs"
```

---

### Task 5: Capture Module

**Files:**
- Create: `src/capture.js`
- Create: `tests/capture.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/capture.test.js`:
```js
const mockBuffer = Buffer.from('fake-png-data')
jest.mock('screenshot-desktop', () => jest.fn().mockResolvedValue(mockBuffer))

const { captureScreen } = require('../src/capture')

describe('capture', () => {
  test('returns base64 string', async () => {
    const result = await captureScreen()
    expect(typeof result).toBe('string')
    expect(result).toBe(mockBuffer.toString('base64'))
  })

  test('requests PNG format', async () => {
    const screenshotDesktop = require('screenshot-desktop')
    await captureScreen()
    expect(screenshotDesktop).toHaveBeenCalledWith({ format: 'png' })
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest tests/capture.test.js
```

Expected: FAIL — `Cannot find module '../src/capture'`

- [ ] **Step 3: Implement src/capture.js**

```js
const screenshotDesktop = require('screenshot-desktop')

async function captureScreen() {
  const buffer = await screenshotDesktop({ format: 'png' })
  return buffer.toString('base64')
}

module.exports = { captureScreen }
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest tests/capture.test.js
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/capture.js tests/capture.test.js
git commit -m "feat: screen capture module"
```

---

### Task 6: Analyzer Module

**Files:**
- Create: `src/analyzer.js`
- Create: `tests/analyzer.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/analyzer.test.js`:
```js
global.fetch = jest.fn()

const { analyzeScreen } = require('../src/analyzer')

const validResponse = { onTask: false, activity: 'watching YouTube', confidence: 0.95 }

function mockFetchSuccess(json) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      content: [{ text: JSON.stringify(json) }]
    })
  })
}

describe('analyzeScreen', () => {
  beforeEach(() => jest.clearAllMocks())

  test('calls Claude API with base64 image and task', async () => {
    mockFetchSuccess(validResponse)
    await analyzeScreen('base64data', 'study for exam', 'ant-key')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'ant-key' })
      })
    )
  })

  test('returns parsed verdict object', async () => {
    mockFetchSuccess(validResponse)
    const result = await analyzeScreen('base64data', 'study for exam', 'ant-key')
    expect(result).toEqual(validResponse)
  })

  test('handles JSON wrapped in markdown code block', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ text: '```json\n' + JSON.stringify(validResponse) + '\n```' }]
      })
    })
    const result = await analyzeScreen('base64data', 'study for exam', 'ant-key')
    expect(result.onTask).toBe(false)
  })

  test('throws on API error', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    await expect(analyzeScreen('base64', 'task', 'bad-key')).rejects.toThrow('Claude API error: 401')
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest tests/analyzer.test.js
```

Expected: FAIL — `Cannot find module '../src/analyzer'`

- [ ] **Step 3: Implement src/analyzer.js**

```js
const VISION_PROMPT = (taskDescription) => `The user is trying to: ${taskDescription}

Look at this screenshot and return ONLY valid JSON with no markdown:
{ "onTask": boolean, "activity": "one sentence describing what's on screen", "confidence": 0.0-1.0 }

Be strict. YouTube videos, games, social media, and chat apps are distractions unless the task explicitly involves them.`

async function analyzeScreen(base64Image, taskDescription, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64Image }
          },
          { type: 'text', text: VISION_PROMPT(taskDescription) }
        ]
      }]
    })
  })

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`)

  const data = await response.json()
  const text = data.content[0].text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(text)
}

module.exports = { analyzeScreen }
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest tests/analyzer.test.js
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/analyzer.js tests/analyzer.test.js
git commit -m "feat: Claude Vision analyzer module"
```

---

### Task 7: Character Dialogue Module

**Files:**
- Create: `src/character.js`
- Create: `tests/character.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/character.test.js`:
```js
global.fetch = jest.fn()

const { generateDialogue } = require('../src/character')

function mockFetchSuccess(text) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ content: [{ text }] })
  })
}

const characterConfig = {
  name: 'Drill Sergeant',
  personalityPrompt: 'You are a strict drill sergeant.',
  elevenLabsVoiceId: 'abc123'
}

describe('generateDialogue', () => {
  beforeEach(() => jest.clearAllMocks())

  test('calls Claude API with character and verdict info', async () => {
    mockFetchSuccess('Get back to work, soldier!')
    await generateDialogue(
      { onTask: false, activity: 'watching YouTube' },
      'formatted memory string',
      characterConfig,
      'study for exam',
      'ant-key'
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.messages[0].content).toContain('Drill Sergeant')
    expect(body.messages[0].content).toContain('watching YouTube')
    expect(body.messages[0].content).toContain('study for exam')
  })

  test('returns dialogue string from API', async () => {
    mockFetchSuccess('Pathetic, soldier!')
    const result = await generateDialogue(
      { onTask: false, activity: 'playing games' },
      '',
      characterConfig,
      'study',
      'ant-key'
    )
    expect(result).toBe('Pathetic, soldier!')
  })

  test('includes memory in prompt when provided', async () => {
    mockFetchSuccess('Again with the YouTube?')
    await generateDialogue(
      { onTask: false, activity: 'watching YouTube' },
      '[10:03] OFF-TASK: watching YouTube',
      characterConfig,
      'study',
      'ant-key'
    )
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.messages[0].content).toContain('[10:03] OFF-TASK: watching YouTube')
  })

  test('throws on API error', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
    await expect(generateDialogue({}, '', characterConfig, 'task', 'key')).rejects.toThrow('Claude API error: 429')
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest tests/character.test.js
```

Expected: FAIL — `Cannot find module '../src/character'`

- [ ] **Step 3: Implement src/character.js**

```js
function buildPrompt(verdict, memoryLog, characterConfig, taskDescription) {
  return `You are ${characterConfig.name}. ${characterConfig.personalityPrompt}

The user's task: ${taskDescription}
What they're actually doing: ${verdict.activity || 'unknown'}
On task: ${verdict.onTask}

Session history (most recent last):
${memoryLog || '(no history yet)'}

Write 1-3 sentences of spoken dialogue reacting to what they're doing. Reference the history if there's a clear pattern. Stay in character. Be specific about what you saw. No stage directions.`
}

async function generateDialogue(verdict, memoryLog, characterConfig, taskDescription, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: buildPrompt(verdict, memoryLog, characterConfig, taskDescription)
      }]
    })
  })

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`)

  const data = await response.json()
  return data.content[0].text.trim()
}

module.exports = { generateDialogue }
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest tests/character.test.js
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/character.js tests/character.test.js
git commit -m "feat: character dialogue module"
```

---

### Task 8: TTS Module

**Files:**
- Create: `src/tts.js`
- Create: `tests/tts.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/tts.test.js`:
```js
global.fetch = jest.fn()

const mockExec = jest.fn((cmd, cb) => cb(null))
const mockWriteFileSync = jest.fn()
const mockUnlinkSync = jest.fn()

jest.mock('child_process', () => ({ exec: mockExec }))
jest.mock('fs', () => ({ writeFileSync: mockWriteFileSync, unlinkSync: mockUnlinkSync }))
jest.mock('os', () => ({ tmpdir: () => '/tmp' }))
jest.mock('path', () => ({ join: (...args) => args.join('/') }))

const { speak } = require('../src/tts')

describe('speak', () => {
  beforeEach(() => jest.clearAllMocks())

  test('calls ElevenLabs API with correct params', async () => {
    const fakeAudio = Buffer.from('mp3data')
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeAudio.buffer
    })
    await speak('Hello soldier', 'voice123', 'el-key')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-speech/voice123',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'xi-api-key': 'el-key' })
      })
    )
  })

  test('writes MP3 to temp file and plays it', async () => {
    const fakeAudio = Buffer.from('mp3data')
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeAudio.buffer
    })
    await speak('Hello', 'v1', 'key')
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/\.mp3$/),
      expect.any(Buffer)
    )
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('afplay'),
      expect.any(Function)
    )
  })

  test('deletes temp file after playback', async () => {
    const fakeAudio = Buffer.from('mp3data')
    global.fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeAudio.buffer
    })
    await speak('Hello', 'v1', 'key')
    const tmpPath = mockWriteFileSync.mock.calls[0][0]
    expect(mockUnlinkSync).toHaveBeenCalledWith(tmpPath)
  })

  test('throws on ElevenLabs API error', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(speak('text', 'v1', 'bad-key')).rejects.toThrow('ElevenLabs API error: 401')
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest tests/tts.test.js
```

Expected: FAIL — `Cannot find module '../src/tts'`

- [ ] **Step 3: Implement src/tts.js**

```js
const { exec } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

async function speak(text, voiceId, apiKey) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  })

  if (!response.ok) throw new Error(`ElevenLabs API error: ${response.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  const tmpFile = path.join(os.tmpdir(), `flow-state-${Date.now()}.mp3`)
  fs.writeFileSync(tmpFile, buffer)

  return new Promise((resolve) => {
    exec(`afplay "${tmpFile}"`, () => {
      fs.unlinkSync(tmpFile)
      resolve()
    })
  })
}

module.exports = { speak }
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest tests/tts.test.js
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/tts.js tests/tts.test.js
git commit -m "feat: ElevenLabs TTS module"
```

---

### Task 9: Core Loop Module

**Files:**
- Create: `src/loop.js`
- Create: `tests/loop.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/loop.test.js`:
```js
jest.mock('../src/capture', () => ({ captureScreen: jest.fn().mockResolvedValue('base64img') }))
jest.mock('../src/analyzer', () => ({ analyzeScreen: jest.fn().mockResolvedValue({ onTask: false, activity: 'watching YouTube', confidence: 0.9 }) }))
jest.mock('../src/character', () => ({ generateDialogue: jest.fn().mockResolvedValue('Get back to work!') }))
jest.mock('../src/tts', () => ({ speak: jest.fn().mockResolvedValue(undefined) }))
jest.mock('../src/memory', () => ({
  addEvent: jest.fn(),
  formatForPrompt: jest.fn().mockReturnValue('memory string'),
  clear: jest.fn(),
  getRecent: jest.fn().mockReturnValue([])
}))

const { createLoop } = require('../src/loop')
const capture = require('../src/capture')
const analyzer = require('../src/analyzer')
const character = require('../src/character')
const tts = require('../src/tts')
const memory = require('../src/memory')

describe('loop tick', () => {
  let loop
  const config = {
    getApiKeys: () => ({ anthropic: 'ant-key', elevenlabs: 'el-key' }),
    getSettings: () => ({ taskDescription: 'study for exam', character: 'drill-sergeant', interval: 20, paused: false }),
    getCharacter: (id) => ({ id, name: 'Drill Sergeant', personalityPrompt: '...', elevenLabsVoiceId: 'v1' }),
    onReaction: jest.fn(),
    getIdleTime: jest.fn().mockReturnValue(0)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    loop = createLoop(config)
  })

  test('tick calls capture, analyze, generate, speak in order', async () => {
    const order = []
    capture.captureScreen.mockImplementation(async () => { order.push('capture'); return 'b64' })
    analyzer.analyzeScreen.mockImplementation(async () => { order.push('analyze'); return { onTask: false, activity: 'YouTube', confidence: 0.9 } })
    character.generateDialogue.mockImplementation(async () => { order.push('generate'); return 'line' })
    tts.speak.mockImplementation(async () => { order.push('speak') })

    await loop.tick()
    expect(order).toEqual(['capture', 'analyze', 'generate', 'speak'])
  })

  test('tick adds event to memory', async () => {
    await loop.tick()
    expect(memory.addEvent).toHaveBeenCalledWith(expect.objectContaining({ onTask: false, activity: 'watching YouTube' }))
  })

  test('tick calls onReaction callback', async () => {
    await loop.tick()
    expect(config.onReaction).toHaveBeenCalledWith(expect.objectContaining({ dialogue: 'Get back to work!' }))
  })

  test('tick skips when paused', async () => {
    config.getSettings = () => ({ taskDescription: 'study', character: 'drill-sergeant', interval: 20, paused: true })
    loop = createLoop(config)
    await loop.tick()
    expect(capture.captureScreen).not.toHaveBeenCalled()
  })

  test('tick skips when no task description', async () => {
    config.getSettings = () => ({ taskDescription: '', character: 'drill-sergeant', interval: 20, paused: false })
    loop = createLoop(config)
    await loop.tick()
    expect(capture.captureScreen).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify fail**

```bash
npx jest tests/loop.test.js
```

Expected: FAIL — `Cannot find module '../src/loop'`

- [ ] **Step 3: Implement src/loop.js**

```js
const { captureScreen } = require('./capture')
const { analyzeScreen } = require('./analyzer')
const { generateDialogue } = require('./character')
const { speak } = require('./tts')
const memory = require('./memory')

const IDLE_THRESHOLD_SECONDS = 30
const IDLE_REACTION_COOLDOWN_MS = 60000

function createLoop({ getApiKeys, getSettings, getCharacter, onReaction, getIdleTime }) {
  let mainInterval = null
  let idleInterval = null
  let lastIdleReactionAt = 0
  let wasIdle = false

  async function tick() {
    const settings = getSettings()
    if (settings.paused || !settings.taskDescription) return

    const { anthropic, elevenlabs } = getApiKeys()
    const character = getCharacter(settings.character)

    try {
      const base64 = await captureScreen()
      const verdict = await analyzeScreen(base64, settings.taskDescription, anthropic)
      memory.addEvent({ onTask: verdict.onTask, activity: verdict.activity })

      const memoryLog = memory.formatForPrompt()
      const dialogue = await generateDialogue(verdict, memoryLog, character, settings.taskDescription, anthropic)
      await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)
      onReaction({ verdict, dialogue, character })
    } catch (err) {
      console.error('[loop] tick error:', err.message)
    }
  }

  async function checkIdle() {
    const settings = getSettings()
    if (settings.paused || !settings.taskDescription) return

    const idleSeconds = getIdleTime()
    const now = Date.now()

    if (idleSeconds >= IDLE_THRESHOLD_SECONDS && !wasIdle && (now - lastIdleReactionAt) > IDLE_REACTION_COOLDOWN_MS) {
      wasIdle = true
      lastIdleReactionAt = now
      const { anthropic, elevenlabs } = getApiKeys()
      const character = getCharacter(settings.character)
      const idleVerdict = { onTask: false, activity: `idle for ${Math.round(idleSeconds)} seconds` }
      memory.addEvent(idleVerdict)
      try {
        const memoryLog = memory.formatForPrompt()
        const dialogue = await generateDialogue(idleVerdict, memoryLog, character, settings.taskDescription, anthropic)
        await speak(dialogue, character.elevenLabsVoiceId, elevenlabs)
        onReaction({ verdict: idleVerdict, dialogue, character, isIdle: true })
      } catch (err) {
        console.error('[loop] idle error:', err.message)
      }
    } else if (idleSeconds < IDLE_THRESHOLD_SECONDS) {
      wasIdle = false
    }
  }

  function start(intervalSeconds) {
    stop()
    mainInterval = setInterval(tick, intervalSeconds * 1000)
    idleInterval = setInterval(checkIdle, 5000)
  }

  function stop() {
    if (mainInterval) { clearInterval(mainInterval); mainInterval = null }
    if (idleInterval) { clearInterval(idleInterval); idleInterval = null }
    memory.clear()
  }

  return { tick, start, stop }
}

module.exports = { createLoop }
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest tests/loop.test.js
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Run all tests to ensure nothing broken**

```bash
npx jest
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/loop.js tests/loop.test.js
git commit -m "feat: core loop with idle detection"
```

---

### Task 10: Overlay Window

**Files:**
- Create: `preload/overlay-preload.js`
- Create: `overlay/index.html`
- Create: `overlay/overlay.js`

- [ ] **Step 1: Create overlay preload**

Create `preload/overlay-preload.js`:
```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('overlayAPI', {
  onCharacterSet: (cb) => ipcRenderer.on('character:set', (_, data) => cb(data)),
  onReaction: (cb) => ipcRenderer.on('reaction:fire', (_, data) => cb(data)),
  reportMove: (x, y) => ipcRenderer.send('overlay:moved', { x, y })
})
```

- [ ] **Step 2: Create overlay HTML and renderer**

Create `overlay/index.html`:
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
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: white;
      cursor: grab;
      background-color: #8B0000;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
      transition: transform 0.1s ease;
      -webkit-app-region: no-drag;
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
<body>
  <div id="character">DS</div>
  <script src="overlay.js"></script>
</body>
</html>
```

Create `overlay/overlay.js`:
```js
const el = document.getElementById('character')
let isDragging = false
let dragOffsetX = 0
let dragOffsetY = 0

// Set character appearance from config
window.overlayAPI.onCharacterSet((data) => {
  el.style.backgroundColor = data.avatarColor
  el.textContent = data.avatarInitial
})

// Bounce animation on reaction
window.overlayAPI.onReaction(() => {
  el.classList.remove('bouncing')
  void el.offsetWidth // force reflow to restart animation
  el.classList.add('bouncing')
  el.addEventListener('animationend', () => el.classList.remove('bouncing'), { once: true })
})

// Drag to reposition: hold Option key to enter drag mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') el.style.cursor = 'grab'
})
document.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') el.style.cursor = 'default'
})

el.addEventListener('mousedown', (e) => {
  if (!e.altKey) return
  isDragging = true
  dragOffsetX = e.clientX
  dragOffsetY = e.clientY
  el.style.cursor = 'grabbing'
})

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  const dx = e.clientX - dragOffsetX
  const dy = e.clientY - dragOffsetY
  dragOffsetX = e.clientX
  dragOffsetY = e.clientY
  window.overlayAPI.reportMove(dx, dy)
})

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false
    el.style.cursor = 'grab'
  }
})
```

- [ ] **Step 3: Verify overlay HTML is valid**

```bash
node -e "const fs = require('fs'); const html = fs.readFileSync('overlay/index.html', 'utf8'); console.log('HTML length:', html.length, 'chars — OK')"
```

Expected: prints HTML length without errors.

- [ ] **Step 4: Commit**

```bash
git add preload/overlay-preload.js overlay/index.html overlay/overlay.js
git commit -m "feat: overlay window with draggable character placeholder"
```

---

### Task 11: Settings Window

**Files:**
- Create: `preload/settings-preload.js`
- Create: `settings/index.html`
- Create: `settings/settings.js`

- [ ] **Step 1: Create settings preload**

Create `preload/settings-preload.js`:
```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('settingsAPI', {
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  startSession: (taskDescription) => ipcRenderer.invoke('session:start', taskDescription),
  pauseSession: () => ipcRenderer.invoke('session:pause'),
  resumeSession: () => ipcRenderer.invoke('session:resume'),
  onLogUpdate: (cb) => ipcRenderer.on('session:log-update', (_, events) => cb(events)),
  getCharacters: () => ipcRenderer.invoke('characters:get')
})
```

- [ ] **Step 2: Create settings HTML**

Create `settings/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Flow State — Settings</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      background: #1e1e1e;
      color: #e0e0e0;
      padding: 20px;
    }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #fff; }
    h2 { font-size: 13px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; margin-top: 20px; }
    input[type="text"], input[type="password"], select, textarea {
      width: 100%;
      padding: 8px 10px;
      background: #2d2d2d;
      border: 1px solid #3d3d3d;
      border-radius: 6px;
      color: #e0e0e0;
      font-size: 13px;
    }
    input[type="range"] { width: 100%; }
    .interval-label { font-size: 12px; color: #888; margin-top: 4px; }
    button {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      font-size: 13px;
      cursor: pointer;
      font-weight: 600;
    }
    #btn-start { background: #2ea44f; color: white; }
    #btn-pause { background: #e3a117; color: white; display: none; }
    #btn-resume { background: #2ea44f; color: white; display: none; }
    .btn-row { display: flex; gap: 8px; margin-top: 8px; }
    #session-log {
      height: 120px;
      overflow-y: auto;
      background: #111;
      border: 1px solid #333;
      border-radius: 6px;
      padding: 8px;
      font-size: 11px;
      font-family: monospace;
      color: #aaa;
    }
    .log-entry { margin-bottom: 4px; }
    .log-on { color: #2ea44f; }
    .log-off { color: #e85353; }
    #status { font-size: 12px; color: #888; margin-top: 8px; min-height: 16px; }
  </style>
</head>
<body>
  <h1>Flow State</h1>

  <h2>Current Task</h2>
  <input type="text" id="task" placeholder="What are you working on?" />
  <div class="btn-row">
    <button id="btn-start">Start Session</button>
    <button id="btn-pause">Pause</button>
    <button id="btn-resume">Resume</button>
  </div>
  <div id="status"></div>

  <h2>Character</h2>
  <select id="character"></select>

  <h2>Check Interval</h2>
  <input type="range" id="interval" min="10" max="60" step="5" value="20" />
  <div class="interval-label" id="interval-label">Check every 20 seconds</div>

  <h2>API Keys</h2>
  <input type="password" id="anthropic-key" placeholder="Anthropic API Key" style="margin-bottom: 8px;" />
  <input type="password" id="elevenlabs-key" placeholder="ElevenLabs API Key" />

  <h2>Session Log</h2>
  <div id="session-log"><div style="color:#555">No events yet.</div></div>

  <script src="settings.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create settings renderer**

Create `settings/settings.js`:
```js
let sessionActive = false

async function init() {
  const [settings, characters] = await Promise.all([
    window.settingsAPI.loadSettings(),
    window.settingsAPI.getCharacters()
  ])

  // Populate character dropdown
  const charSelect = document.getElementById('character')
  characters.forEach(c => {
    const opt = document.createElement('option')
    opt.value = c.id
    opt.textContent = c.name
    if (c.id === settings.character) opt.selected = true
    charSelect.appendChild(opt)
  })

  // Populate fields
  document.getElementById('task').value = settings.taskDescription || ''
  document.getElementById('interval').value = settings.interval
  document.getElementById('interval-label').textContent = `Check every ${settings.interval} seconds`
  document.getElementById('anthropic-key').value = settings.anthropicKey || ''
  document.getElementById('elevenlabs-key').value = settings.elevenlabsKey || ''

  if (settings.paused) showPaused()
  else if (settings.taskDescription) showActive()
}

function showActive() {
  sessionActive = true
  document.getElementById('btn-start').style.display = 'none'
  document.getElementById('btn-pause').style.display = 'inline-block'
  document.getElementById('btn-resume').style.display = 'none'
  document.getElementById('status').textContent = `Session active`
}

function showPaused() {
  document.getElementById('btn-start').style.display = 'none'
  document.getElementById('btn-pause').style.display = 'none'
  document.getElementById('btn-resume').style.display = 'inline-block'
  document.getElementById('status').textContent = 'Session paused'
}

function showIdle() {
  sessionActive = false
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
  if (!task) { document.getElementById('status').textContent = 'Enter a task first.'; return }
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

// Auto-save on change
document.getElementById('character').addEventListener('change', saveCurrentSettings)
document.getElementById('anthropic-key').addEventListener('change', saveCurrentSettings)
document.getElementById('elevenlabs-key').addEventListener('change', saveCurrentSettings)

window.settingsAPI.onLogUpdate((events) => {
  const log = document.getElementById('session-log')
  if (!events.length) { log.innerHTML = '<div style="color:#555">No events yet.</div>'; return }
  log.innerHTML = events.map(e => `
    <div class="log-entry">
      <span style="color:#555">[${e.time}]</span>
      <span class="${e.onTask ? 'log-on' : 'log-off'}">${e.onTask ? '✓' : '✗'}</span>
      ${e.activity}
    </div>
  `).join('')
  log.scrollTop = log.scrollHeight
})

init()
```

- [ ] **Step 4: Commit**

```bash
git add preload/settings-preload.js settings/index.html settings/settings.js
git commit -m "feat: settings window UI"
```

---

### Task 12: Main Process Integration

**Files:**
- Rewrite: `main.js`

This task wires everything together: creates both windows, sets up the tray, registers IPC handlers, starts the loop, handles screen recording permission.

- [ ] **Step 1: Rewrite main.js**

```js
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
  if (status === 'granted') return true

  dialog.showMessageBox({
    type: 'warning',
    title: 'Screen Recording Required',
    message: 'Flow State needs Screen Recording permission to watch your screen.',
    detail: 'Go to System Preferences → Privacy & Security → Screen Recording and enable Flow State. Then relaunch the app.',
    buttons: ['Open System Preferences', 'Quit']
  }).then(({ response }) => {
    if (response === 0) {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    }
    app.quit()
  })
  return false
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
      preload: path.join(__dirname, 'preload', 'overlay-preload.js')
    }
  })

  overlayWin.setIgnoreMouseEvents(true, { forward: true })
  overlayWin.loadFile(path.join(__dirname, 'overlay', 'index.html'))

  overlayWin.webContents.on('did-finish-load', () => {
    const settings = store.getSettings()
    const character = getCharacter(settings.character)
    overlayWin.webContents.send('character:set', { avatarColor: character.avatarColor, avatarInitial: character.avatarInitial })
  })
}

// ── Settings Window ──────────────────────────────────────────────────────────

function createSettingsWindow() {
  if (settingsWin) { settingsWin.focus(); return }

  settingsWin = new BrowserWindow({
    width: 380,
    height: 620,
    title: 'Flow State',
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload', 'settings-preload.js')
    }
  })

  settingsWin.loadFile(path.join(__dirname, 'settings', 'index.html'))
  settingsWin.on('closed', () => { settingsWin = null })
}

// ── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  // Use a simple template image (16x16 white square as placeholder)
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABKSURBVDiNY/z//z8DJYCJgUIw+A0YNWDUgFEDRg0YNWDUgFEDRg0YNQAHGBkZGSj1ASMjI8OoAaMGjBowasCoAaMGjBowasCAAQDM7w19BsrVKwAAAABJRU5ErkJggg=='
  )
  tray = new Tray(icon)
  updateTrayMenu()
}

function updateTrayMenu() {
  const settings = store.getSettings()
  const menu = Menu.buildFromTemplate([
    { label: 'Open Settings', click: createSettingsWindow },
    { type: 'separator' },
    {
      label: settings.paused ? 'Resume Session' : 'Pause Session',
      enabled: !!settings.taskDescription,
      click: () => {
        store.setSetting('paused', !settings.paused)
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

function registerIPC() {
  ipcMain.handle('settings:load', () => {
    const settings = store.getSettings()
    const keys = store.getApiKeys()
    return { ...settings, anthropicKey: keys.anthropic, elevenlabsKey: keys.elevenlabs }
  })

  ipcMain.handle('settings:save', (_, { character, interval, anthropicKey, elevenlabsKey }) => {
    store.setSetting('character', character)
    store.setSetting('interval', interval)
    store.setApiKey('anthropic', anthropicKey)
    store.setApiKey('elevenlabs', elevenlabsKey)

    // Update overlay character if changed
    if (overlayWin) {
      const char = getCharacter(character)
      overlayWin.webContents.send('character:set', { avatarColor: char.avatarColor, avatarInitial: char.avatarInitial })
    }

    // Restart loop with new interval
    const settings = store.getSettings()
    if (!settings.paused && settings.taskDescription) {
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

  ipcMain.on('overlay:moved', (_, { x: dx, y: dy }) => {
    if (!overlayWin) return
    const [cx, cy] = overlayWin.getPosition()
    const nx = cx + dx
    const ny = cy + dy
    overlayWin.setPosition(nx, ny)
    store.setOverlayPosition(nx, ny)
  })
}

// ── Loop Setup ───────────────────────────────────────────────────────────────

function pushLogUpdate() {
  if (!settingsWin) return
  settingsWin.webContents.send('session:log-update', memory.getRecent(50))
}

function setupLoop() {
  const { powerMonitor } = require('electron')

  loop = createLoop({
    getApiKeys: () => store.getApiKeys(),
    getSettings: () => store.getSettings(),
    getCharacter: (id) => getCharacter(id),
    getIdleTime: () => powerMonitor.getSystemIdleTime(),
    onReaction: ({ verdict, dialogue, character, isIdle }) => {
      if (overlayWin) overlayWin.webContents.send('reaction:fire', { dialogue })
      pushLogUpdate()
    }
  })

  // Resume loop if a session was active when app last quit
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
  e.preventDefault() // keep app alive when settings window closes
})

app.on('before-quit', () => {
  if (loop) loop.stop()
})
```

- [ ] **Step 2: Verify app launches without errors**

```bash
npm start
```

Expected:
- No dock icon appears
- Tray icon appears in menu bar
- Circular character placeholder appears in bottom-right corner of screen
- Clicking tray → "Open Settings" opens the settings window

- [ ] **Step 3: Test settings window**

In the running app:
1. Click tray → Open Settings
2. Enter an Anthropic API key and ElevenLabs API key and click Save
3. Enter a task ("testing the app") and click Start Session
4. Wait 20 seconds — character should bounce and audio should play

Expected: character bounces, audio plays, session log updates with an event.

- [ ] **Step 4: Test idle detection**

1. Start a session
2. Stop touching the mouse/keyboard for 35 seconds

Expected: character bounces and audio plays without a scheduled check triggering.

- [ ] **Step 5: Test drag**

1. Hold Option key
2. Click and drag the character to a new position
3. Quit and relaunch

Expected: character appears at saved position after relaunch.

- [ ] **Step 6: Run full test suite one final time**

```bash
npx jest
```

Expected: All tests pass.

- [ ] **Step 7: Final commit**

```bash
git add main.js
git commit -m "feat: main process integration — full app wired up"
```

---

## Self-Review

**Spec coverage check:**

| Spec Requirement | Covered By |
|---|---|
| Periodic screenshot | Task 5 (capture.js), Task 9 (loop.js) |
| Claude Vision analysis | Task 6 (analyzer.js) |
| Character dialogue generation | Task 7 (character.js) |
| ElevenLabs TTS + audio playback | Task 8 (tts.js) |
| Session memory (last 10 events) | Task 3 (memory.js) |
| Contextual pattern references | Task 7 (memory passed to prompt) |
| Idle detection (30s) | Task 9 (loop.js idle check) |
| Character overlay (bottom-right, draggable) | Task 10 (overlay window) |
| Bounce animation on reaction | Task 10 (overlay.js CSS animation) |
| Position persistence | Task 12 (store + IPC overlay:moved) |
| 3 preset characters | Task 4 (characters/index.js) |
| Settings window | Task 11 |
| Task input, character picker, interval slider | Task 11 (settings.html) |
| API key storage | Task 2 (store.js), Task 12 (IPC save) |
| Session log in settings | Task 11, Task 12 (pushLogUpdate) |
| Pause/resume | Task 11, Task 12 (IPC handlers) |
| Tray menu | Task 12 |
| macOS Screen Recording permission check | Task 12 (checkScreenPermission) |
