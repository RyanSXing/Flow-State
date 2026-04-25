const VISION_PROMPT = (taskDescription) => `Goal: "${taskDescription}"

Does this screenshot show the user working toward their goal?
Return ONLY JSON: { "onTask": boolean, "activity": "10 words max", "confidence": 0.0-1.0 }`

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
      max_tokens: 80,
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

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${body}`)
  }

  const data = await response.json()
  const text = data.content[0].text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(text)
}

module.exports = { analyzeScreen }
