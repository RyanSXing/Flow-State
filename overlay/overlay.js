const el = document.getElementById('character')
let isDragging = false
let lastX = 0
let lastY = 0

// Update character appearance
window.overlayAPI.onCharacterSet((data) => {
  el.style.backgroundColor = data.avatarColor
  el.textContent = data.avatarInitial
})

// Bounce animation on reaction
window.overlayAPI.onReaction(() => {
  el.classList.remove('bouncing')
  void el.offsetWidth // force reflow to restart animation
  el.classList.add('bouncing')
  el.addEventListener('animationend', () => el.classList.remove('bouncing'), { once: true })
})

// Drag: hold Option (Alt) key to enter drag mode
document.addEventListener('mousedown', (e) => {
  if (!e.altKey) return
  isDragging = true
  lastX = e.screenX
  lastY = e.screenY
  document.body.style.cursor = 'grabbing'
})

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  const dx = e.screenX - lastX
  const dy = e.screenY - lastY
  lastX = e.screenX
  lastY = e.screenY
  if (dx !== 0 || dy !== 0) {
    window.overlayAPI.reportMove(dx, dy)
  }
})

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false
    document.body.style.cursor = 'default'
  }
})
