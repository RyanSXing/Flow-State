const { getCharacter, getAllCharacters } = require('../src/characters')

describe('characters', () => {
  test('includes bibilabu animated sprite character', () => {
    const character = getCharacter('bibilabu')

    expect(character.name).toBe('Bibilabu')
    expect(character.avatarImage).toBe('assets/bibilabu-sprite-sheet.png')
    expect(character.avatarSprite.sheetWidth).toBe(2040)
    expect(character.avatarSprite.sheetHeight).toBe(2835)
    expect(character.avatarSprite.states.swing).toEqual({
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
    })
    expect(character.avatarSprite.states.talking).toMatchObject({
      image: 'assets/bibilabu-sprite-sheet.png',
      frameWidth: 405,
      frameHeight: 405,
      frameCount: 12,
      columns: 4,
      fps: 10,
      loop: true,
      offsetX: 0,
      offsetY: 8
    })
    expect(character.avatarSprite.states.talking.frames).toHaveLength(12)
    expect(character.avatarSprite.states.talking.frames[1]).toEqual({ x: 1072, y: 2025, width: 405, height: 405 })
    expect(character.avatarSprite.states.talking.frames[8]).toEqual({ x: 1072, y: 1620, width: 405, height: 405 })
    expect(character.avatarSprite.states.idle).toMatchObject({
      image: 'assets/bibilabu-sprite-sheet.png',
      frameWidth: 409,
      frameHeight: 404,
      frameCount: 12,
      columns: 4,
      fps: 6,
      loop: true,
      offsetX: 0,
      offsetY: 8
    })
    expect(character.avatarSprite.states.idle.frames).toHaveLength(12)
    expect(character.avatarSprite.states.idle.frames[2]).toEqual({ x: 50, y: 1215, width: 409, height: 404 })
    expect(character.avatarSprite.states.idle.frames[6]).toEqual({ x: 560, y: 405, width: 409, height: 404 })
    expect(getAllCharacters().map(c => c.id)).toContain('bibilabu')
  })
})
