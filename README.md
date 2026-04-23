# Flow State

A macOS background focus coach that watches your screen, determines if you're on-task, and has a voiced character react in real-time using ElevenLabs TTS.

## What it does

- **Screenshots your screen** every N seconds (configurable)
- **Asks Claude Vision** if you're working on your stated task
- **Generates voiced reactions** via a character you choose — praise when on-task, scolding when not
- **Remembers your session** — characters reference past behavior ("Back to League again?")
- **Detects idle time** — reacts if you've been inactive for 30+ seconds
- **Sits in your corner** — a small draggable character lives in the bottom-right of your screen

## Characters

| Character | Vibe |
|---|---|
| Drill Sergeant | Harsh military tough love |
| Disappointed Mom | Loving but deeply let down |
| Anime Rival | Dramatic, competitive, affectionate cringe |

## Setup

### Prerequisites

- macOS (Windows support planned)
- Node.js 18+
- [Anthropic API key](https://console.anthropic.com/)
- [ElevenLabs API key](https://elevenlabs.io/)

### Install

```bash
git clone https://github.com/rsxing/flow-state.git
cd flow-state
npm install
```

### Run

```bash
npm start
```

On first launch:
1. Grant **Screen Recording** permission when prompted (System Preferences → Privacy & Security → Screen Recording)
2. Click the tray icon → **Open Settings**
3. Enter your Anthropic and ElevenLabs API keys
4. Set your current task
5. Click **Start Session**

### Finding ElevenLabs Voice IDs

1. Go to [elevenlabs.io/voice-lab](https://elevenlabs.io/voice-lab)
2. Browse voices and click one you like
3. The voice ID is in the URL: `elevenlabs.io/voice-lab/share/{VOICE_ID}`

The app ships with default voice IDs — swap them in `src/characters/index.js` if you want different voices.

## Development

```bash
# Run app
npm start

# Run tests
npm test
```

## Tech Stack

- **Electron 28** — desktop app framework
- **Claude Vision** (`claude-sonnet-4-6`) — screen analysis
- **Claude Text** (`claude-sonnet-4-6`) — character dialogue generation
- **ElevenLabs** — text-to-speech
- **electron-store** — settings persistence
- **screenshot-desktop** — screen capture
- **Jest** — unit testing

## License

MIT
