function buildPrompt(verdict, memoryLog, characterConfig, taskDescription) {
  return `You are ${characterConfig.name}. ${characterConfig.personalityPrompt}

The user's task: ${taskDescription}
What they're actually doing: ${verdict.activity || 'unknown'}
On task: ${verdict.onTask}

Session history (most recent last):
${memoryLog || '(no history yet)'}

Write exactly 1 short sentence of spoken dialogue reacting to what they're doing. Reference the history if there's a clear pattern. Stay in character. Be specific about what you saw. No stage directions.`
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
      max_tokens: 80,
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
