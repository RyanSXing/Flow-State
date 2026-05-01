const characters = [
  {
    id: 'drill-sergeant',
    name: 'Drill Sergeant',
    personalityPrompt: `You are a strict military drill sergeant who takes productivity extremely seriously. You call the user "soldier" or "recruit". You use military language and bark commands. When they're off-task you are furious and disappointed. When they're on-task you are briefly impressed but immediately set a higher bar. You are never soft. Keep reactions short and punchy.`,
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    avatarColor: '#8B0000',
    avatarImage: 'assets/character.png',
    avatarInitial: 'DS'
  },
  {
    id: 'disappointed-mom',
    name: 'Disappointed Mom',
    personalityPrompt: `You are a loving but deeply disappointed mother. You sigh often. You mention sacrifices you made and how you raised them better than this. When they're off-task you are heartbroken but not angry — just let down. When they're on-task you are tearfully proud and tell them you always knew they could do it. You are warm, guilt-inducing, and genuine.`,
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    avatarColor: '#8B4513',
    avatarImage: 'assets/character.png',
    avatarInitial: 'DM'
  },
  {
    id: 'anime-rival',
    name: 'Anime Rival',
    personalityPrompt: `You are the user's dramatic anime rival. You find their failures personally offensive — not because you hate them, but because you respect them and this is beneath them. When they're off-task you call them pathetic, hopeless, or a disappointment to your rivalry. When they're on-task you grudgingly acknowledge it while insisting you are still superior. You are theatrical, passionate, and weirdly affectionate. Use exclamation points freely.`,
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    avatarColor: '#4B0082',
    avatarImage: 'assets/character.png',
    avatarInitial: 'AR'
  },
  {
    id: 'bibilabu',
    name: 'Bibilabu',
    personalityPrompt: `You are Bibilabu, a cheerful tiny warrior dog with a sword and shield. You are upbeat, brave, and playfully intense about focus. When the user is off-task, you rally them like a loyal quest companion. When they're on-task, you celebrate quickly and urge them onward. Keep reactions short, cute, and spirited.`,
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    avatarColor: '#D99A3D',
    avatarImage: 'assets/bibilabu-sprite-sheet.png',
    avatarInitial: 'BB',
    avatarSprite: {
      defaultState: 'idle',
      sheetWidth: 2040,
      sheetHeight: 2835,
      states: {
        swing: {
          image: 'assets/bibilabu-sprite-sheet.png',
          frameWidth: 510,
          frameHeight: 381,
          frameCount: 4,
          columns: 4,
          fps: 10,
          loop: false,
          offsetX: 0,
          offsetY: 18,
          frames: [
            { x: 0, y: 12, width: 510, height: 381 },
            { x: 510, y: 12, width: 510, height: 381 },
            { x: 1020, y: 12, width: 510, height: 381 },
            { x: 1530, y: 12, width: 510, height: 381 }
          ]
        },
        talking: {
          image: 'assets/bibilabu-sprite-sheet.png',
          frameWidth: 405,
          frameHeight: 405,
          frameCount: 12,
          columns: 4,
          fps: 10,
          loop: true,
          offsetX: 0,
          offsetY: 8,
          frames: [
            { x: 52, y: 405, width: 405, height: 405 },
            { x: 1072, y: 2025, width: 405, height: 405 },
            { x: 1072, y: 405, width: 405, height: 405 },
            { x: 1580, y: 405, width: 409, height: 404 },
            { x: 52, y: 810, width: 405, height: 405 },
            { x: 562, y: 810, width: 405, height: 405 },
            { x: 1072, y: 810, width: 405, height: 405 },
            { x: 1582, y: 810, width: 405, height: 405 },
            { x: 1072, y: 1620, width: 405, height: 405 },
            { x: 562, y: 1215, width: 405, height: 405 },
            { x: 1070, y: 1215, width: 409, height: 404 },
            { x: 1582, y: 1215, width: 405, height: 405 }
          ]
        },
        idle: {
          image: 'assets/bibilabu-sprite-sheet.png',
          frameWidth: 409,
          frameHeight: 404,
          frameCount: 12,
          columns: 4,
          fps: 6,
          loop: true,
          offsetX: 0,
          offsetY: 8,
          frames: [
            { x: 50, y: 1620, width: 409, height: 404 },
            { x: 560, y: 1620, width: 409, height: 404 },
            { x: 50, y: 1215, width: 409, height: 404 },
            { x: 1580, y: 1620, width: 409, height: 404 },
            { x: 50, y: 2025, width: 409, height: 404 },
            { x: 562, y: 2025, width: 405, height: 405 },
            { x: 560, y: 405, width: 409, height: 404 },
            { x: 1580, y: 2025, width: 409, height: 404 },
            { x: 50, y: 2430, width: 409, height: 404 },
            { x: 560, y: 2430, width: 409, height: 404 },
            { x: 1072, y: 2430, width: 405, height: 405 },
            { x: 1580, y: 2430, width: 409, height: 404 }
          ]
        }
      }
    }
  }
]

function getCharacter(id) {
  return characters.find(c => c.id === id) || characters[0]
}

function getAllCharacters() {
  return characters
}

module.exports = { getCharacter, getAllCharacters }
