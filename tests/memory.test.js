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
