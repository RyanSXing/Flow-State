# Pomodoro Timer — Design Spec
Date: 2026-04-26

## Overview

Add a Pomodoro timer to the Flow-State Electron overlay. A glowing pill progress bar renders centered below the character avatar, always visible. The timer drives the classic 25/5/5/5/5/15 Pomodoro cycle and triggers full character reactions (bounce + AI voice line) on every phase transition.

---

## Architecture

The timer state machine runs entirely in `overlay.js` (renderer process). Main process is not involved in ticking — it only responds to transition/pause events via IPC.

State held in overlay renderer:
- `phase`: `'work' | 'short-break' | 'long-break'`
- `secondsLeft`: integer countdown
- `pomodoroCount`: 1–4 (resets after long break)
- `running`: boolean

A `setInterval` at 1000ms drives the countdown. When `secondsLeft` hits 0, the overlay advances the phase and fires `pomodoro:transition` IPC to main. Main generates a transition-aware AI dialogue line, speaks it via ElevenLabs TTS, then fires `overlay:reaction` back to trigger the bounce animation.

No changes to `loop.js`, `store.js`, or settings window.

---

## Phase Sequence

```
work(25m) → short-break(5m) → work(25m) → short-break(5m)
         → work(25m) → short-break(5m) → work(25m) → long-break(15m) → repeat
```

`pomodoroCount` increments on each work phase completion (1→4). After the long break, `pomodoroCount` resets to 0 and the cycle repeats.

---

## UI & Visuals

Layout: flex column — character avatar (80x80px circle) on top, `#timer-bar` container centered below with 8px gap. Overlay window height increases by ~50px to accommodate.

Timer bar (160px wide) contains, top to bottom:
1. **Phase label + countdown** — monospace, letter-spaced. Work: `WORK · 24:13` in warm red-orange (`#ff7a5c`). Break: `BREAK · 04:58` in teal (`#43e0c0`). Long break: `LONG BREAK · 14:45` in teal.
2. **Glowing pill progress bar** — 8px tall, rounded. Work fill: `linear-gradient(90deg, #ff6b6b, #ff8e53)` with `box-shadow: 0 0 10px #ff6b6b88`. Break fill: `linear-gradient(90deg, #43b89c, #4facfe)` with teal glow. Track: `rgba(255,255,255,0.08)`. Fills left-to-right as time elapses.
3. **4 dot indicators** — 6px circles, gap 5px. Filled + glowing = completed pomodoro. Dimmed (opacity 0.2) = remaining. Work dots use red, break dots use teal.
4. **Pause button** — appears on hover over the timer area. Circular, 28px, `rgba(0,0,0,0.7)` background, backdrop blur, `⏸` icon. Click toggles `running`. When paused, the pill bar pulses opacity (CSS keyframe animation).

**Idle state** (no task set / session not started): entire timer renders at opacity 0.3, label shows `-- · --:--`, bar is empty, all dots dimmed.

---

## IPC Channels

### `pomodoro:transition` (renderer → main)
Fired when a phase ends and a new phase begins.

Payload:
```json
{ "from": "work", "to": "short-break", "pomodoroCount": 1 }
```

Main handler:
1. Calls `generateTransitionDialogue(from, to, pomodoroCount, character, task, anthropic)` in `src/character.js`
2. Calls `speak(dialogue, voiceId, elevenlabs)`
3. Fires `overlay:reaction` to trigger bounce animation

### `pomodoro:pause` (renderer → main)
Fired when user clicks the pause button.

Payload: `{ "paused": true | false }`

Main handler: calls `generateTransitionDialogue` with a pause/resume context, speaks, bounces.

---

## New Function: `generateTransitionDialogue`

Added to `src/character.js`.

```js
generateTransitionDialogue(from, to, pomodoroCount, character, task, anthropic)
```

Prompt context: character persona, current task, `from`/`to` phase, pomodoro count. One sentence, max 80 tokens. Examples of expected output:
- work → short-break: "Great focus — take a breather, you've earned it."
- short-break → work: "Break's over, back to it!"
- work → long-break (4th pomodoro): "Four down — enjoy your long break, you crushed it."
- pause: "Pausing the clock — don't take too long."

---

## Files Changed

| File | Change |
|------|--------|
| `overlay/index.html` | Add `#timer-bar` container below `#character`; expand body/window height |
| `overlay/overlay.js` | Add pomodoro state machine, DOM updates, hover pause button, IPC calls |
| `preload/overlay-preload.js` | Expose `overlayAPI.sendTransition(payload)` and `overlayAPI.sendPause(paused)` |
| `main.js` | Add `ipcMain.handle('pomodoro:transition', ...)` and `ipcMain.handle('pomodoro:pause', ...)` |
| `src/character.js` | Add `generateTransitionDialogue` function |

No new files. No changes to `loop.js`, `store.js`, `settings/`, or `devtools/`.

---

## Error Handling

- If TTS or Claude API fails on transition, log the error and still fire `overlay:reaction` (visual bounce only — don't block the timer).
- If overlay IPC is unavailable (overlay not open), main handler is a no-op.

---

## Out of Scope

- Settings UI for customizing pomodoro durations (use hardcoded defaults: 25/5/15)
- Skip-phase button (not requested)
- Pomodoro history / stats
- Sound effects beyond ElevenLabs TTS
