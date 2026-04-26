function buildPrompt(verdict, memoryLog, characterConfig, taskDescription) {
  return `You are ${characterConfig.name}. ${characterConfig.personalityPrompt}

The user's task: ${taskDescription}
What they're actually doing: ${verdict.activity || 'unknown'}
On task: ${verdict.onTask}

Session history (most recent last):
${memoryLog || '(no history yet)'}

Write exactly 1 sentence of dialogue, 100 characters max. Stay in character. No stage directions.`
}

function buildTransitionPrompt(from, to, pomodoroCount, characterConfig, taskDescription) {
  const labels = { work: 'work session', 'short-break': 'short break', 'long-break': 'long break' }
  const countNote = from === 'work' ? ' (pomodoro ' + pomodoroCount + ' of 4 complete)' : ''
  return 'You are ' + characterConfig.name + '. ' + characterConfig.personalityPrompt + '\n\nThe user task: ' + (taskDescription || 'focused work') + '\nTimer transition: ' + (labels[from] || from) + countNote + ' to ' + (labels[to] || to) + '\n\nWrite exactly 1 sentence acknowledging this transition, 100 characters max. Stay in character. No stage directions.'
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
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: buildPrompt(verdict, memoryLog, characterConfig, taskDescription)
      }]
    })
  })

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`)

  const data = await response.json()
  return data.content[0].text.trim().slice(0, 100)
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
  if (!response.ok) throw new Error('Claude API error: ' + response.status)
  const data = await response.json()
  return data.content[0].text.trim().slice(0, 100)
}

module.exports = { generateDialogue, generateTransitionDialogue }
