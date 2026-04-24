const VISION_PROMPT = (taskDescription) => `The user's goal is: "${taskDescription}"

Look at this screenshot and determine if what's on screen is directly helping the user accomplish their goal.

Return ONLY valid JSON with no markdown:
{ "onTask": boolean, "activity": "brief description of what's on screen", "confidence": 0.0-1.0 }

Judge based ONLY on the user's stated goal — not general productivity assumptions. If there's a reasonable connection between the screen content and the goal, mark onTask true. Only mark onTask false if the content is clearly unrelated to their goal. YouTube, games, and social media may be on-task if the goal involves them.`

async function analyzeScreen(base64Image, taskDescription, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
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
