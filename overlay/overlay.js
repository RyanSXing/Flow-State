const el = document.getElementById('character')
let isDragging = false
let lastX = 0
let lastY = 0

// Update character appearance
window.overlayAPI.onCharacterSet((data) => {
  if (data.avatarImage) el.src = "../" + data.avatarImage
})

// Bounce animation on reaction
window.overlayAPI.onReaction(() => {
  el.classList.remove('bouncing')
  void el.offsetWidth
  el.classList.add('bouncing')
  el.addEventListener('animationend', () => el.classList.remove('bouncing'), { once: true })
})

// Hover over character → disable click-through so mouse events are captured
el.addEventListener('mouseenter', () => {
  window.overlayAPI.setClickThrough(false)
  el.style.cursor = 'grab'
})

el.addEventListener('mouseleave', () => {
  if (!isDragging) {
    window.overlayAPI.setClickThrough(true)
    el.style.cursor = 'default'
  }
})

el.addEventListener('mousedown', (e) => {
  isDragging = true
  lastX = e.screenX
  lastY = e.screenY
  el.style.cursor = 'grabbing'
  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  const dx = e.screenX - lastX
  const dy = e.screenY - lastY
  lastX = e.screenX
  lastY = e.screenY
  if (dx !== 0 || dy !== 0) window.overlayAPI.reportMove(dx, dy)
})

document.addEventListener('mouseup', () => {
  if (!isDragging) return
  isDragging = false
  el.style.cursor = 'grab'
  // Re-enable click-through if mouse is no longer over character
  const rect = el.getBoundingClientRect()
  // mouseleave will fire naturally and handle this
})
