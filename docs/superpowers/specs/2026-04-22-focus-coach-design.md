# Focus Coach App — Design Spec
**Date:** 2026-04-22
**Project:** Flow State (working title)
**Platform:** macOS (Windows support deferred)
**Tech Stack:** Electron + Node.js

---

## Overview

A background desktop app that watches your screen, determines if you're on-task, and has a character react in real-time with voiced praise or scolding via ElevenLabs TTS. A persistent on-screen character sits in the bottom-right corner of the screen. Session memory enables contextual callbacks ("Back to League again?").

---

## Architecture

### Three Electron Windows

1. **Overlay window** — always-on-top, transparent, frameless, click-through. Hosts the draggable character sprite and speech bubble. Default position: bottom-right. User can drag to any position; position persists via `electron-store`.

2. **Settings window** — normal Electron window, opened from tray. All user configuration lives here.

3. **Main process (`main.js`)** — no visible window. Owns the core loop, timers, and coordinates all modules.

### File Structure

```
main.js             — main process, tray, loop orchestration
capture.js          — screenshot → base64
analyzer.js         — Claude Vision API call, returns verdict
character.js        — Claude Text API call, generates dialogue
tts.js              — ElevenLabs API call + audio playback
store.js            — electron-store wrapper (persists settings)
overlay/
  index.html        — overlay BrowserWindow UI
  overlay.js        — renderer: character sprite + speech bubble
settings/
  index.html        — settings BrowserWindow UI
  settings.js       — renderer: all settings controls
characters/
  index.js          — preset character configs
  drill-sergeant.png
  disappointed-mom.png
  anime-rival.png
```

### npm Dependencies

```
electron
electron-store
screenshot-desktop
iokit-idle-time     — macOS idle time detection
```

Audio playback via `afplay` (macOS native, no extra dependency).
All API calls via native `fetch` (Node 18+).

---

## Core Loop

Runs every N seconds (default 20s, user-configurable 10s–60s). Only runs when a task is active and session is not paused.

```
screenshot → Claude Vision (on-task?) → Claude Text (generate dialogue) → ElevenLabs TTS → play audio + show speech bubble for 5s
```

### Screenshot & Analysis

`screenshot-desktop` captures the primary display as a PNG, converted to base64. Sent to `claude-sonnet-4-6` vision model.

**Vision prompt:**
```
The user is trying to: {taskDescription}

Look at this screenshot and return ONLY valid JSON:
{ "onTask": boolean, "activity": "one sentence describing what's on screen", "confidence": 0-1 }

Be strict. YouTube, games, social media, and chat apps are distractions unless the task explicitly involves them.
```

### Dialogue Generation

Claude text API receives: verdict + session memory (last 10 events) + character config.

**Dialogue prompt:**
```
You are {characterName}. {personalityPrompt}

The user's task: {taskDescription}
What they're actually doing: {activity}
On task: {onTask}

Session history (most recent last):
{last 10 events as formatted list}

Write 1-3 sentences of spoken dialogue reacting to what they're doing. Reference the history if there's a pattern. Stay in character. Be specific about what you saw. No stage directions.
```

### TTS & Audio

`POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
Headers: `xi-api-key: {key}`
Body: `{ text, model_id: "eleven_monolingual_v1", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }`

Response (MP3 binary) saved to temp file → played via `afplay` → deleted.

---

## Idle Detection

Separate timer polls system idle time via `iokit-idle-time`. If idle >30 seconds while session is active, fires an idle reaction through the same dialogue → TTS pipeline. Idle events are added to session memory like any other event.

---

## Session Memory

In-memory array in main process. Cleared when user starts a new task. Last 10 events passed to every Claude dialogue call.

```js
[
  { time: "10:03", onTask: false, activity: "watching League of Legends gameplay" },
  { time: "10:08", onTask: true,  activity: "reading math textbook PDF" },
  { time: "10:23", onTask: false, activity: "watching League of Legends gameplay" }
]
```

Enables contextual callbacks: *"Back to League again? That's the third time, soldier."*

---

## Characters

Three preset characters shipped with the app. No custom character creation in v1.

| Character | Personality | Tone |
|---|---|---|
| **Drill Sergeant** | Military, harsh, zero tolerance, calls you "soldier" | Aggressive tough love |
| **Disappointed Mom** | Loving but deeply let down, sighs, mentions she raised you better | Guilt-tripping warmth |
| **Anime Rival** | Dramatic, calls you pathetic affectionately, acts like your failure is personally offensive | Competitive cringe |

**Character config shape:**
```js
{
  name: "Drill Sergeant",
  personalityPrompt: "You are a strict military drill sergeant...",
  elevenLabsVoiceId: "...",
  avatarImage: "characters/drill-sergeant.png"
}
```

Avatars are placeholders in v1 (colored circle with character initial). Designed to be swapped with animated sprites in a future version.

---

## Overlay Window

- `transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true, focusable: false`
- `win.setIgnoreMouseEvents(true)` — fully click-through by default
- **Dragging:** holding a modifier key (e.g. Option) temporarily disables click-through, allowing user to drag the character to a new position
- Position (x, y) persisted via `electron-store`, restored on launch
- Character shows a brief visual pulse/bounce animation when a reaction fires (audio plays, no text overlay in v1)
- Placeholder: colored circle with character initial

---

## Settings Window

Opened via tray icon. Five sections:

1. **Current Task** — text input. Starting or changing task resets session memory.
2. **Character** — dropdown with 3 presets, shows avatar + name.
3. **Check Interval** — slider 10s–60s, default 20s.
4. **API Keys** — Anthropic API key + ElevenLabs API key. Stored via `electron-store` with `safeStorage` encryption.
5. **Session Log** — read-only scrollable list of session events (time, on-task status, activity). Clears with session.

---

## Tray Menu

```
Open Settings
──────────────
Pause Session
Resume Session
──────────────
Quit
```

---

## macOS Permissions

Requires **Screen Recording** permission (System Preferences → Privacy & Security → Screen Recording). App requests this on first launch with a clear explanation dialog before attempting any screenshot.

---

## Out of Scope (v1)

- Custom character creation
- Animated sprites (placeholder only)
- Windows / Linux support
- Speech bubble / notification banner UI (character on screen only for now)
- Cloud sync of session history
- Multiple monitor support
