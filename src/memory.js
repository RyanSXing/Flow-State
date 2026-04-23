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
