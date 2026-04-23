const logEl = document.getElementById('log')
const autoscrollEl = document.getElementById('autoscroll')

window.devtoolsAPI.onLog((entry) => {
  const line = document.createElement('div')
  line.className = 'entry'
  line.innerHTML = `<span class="time">[${entry.time}]</span> <span class="type-${entry.type}">[${entry.type}]</span> ${escapeHtml(entry.message)}`
  logEl.appendChild(line)
  if (autoscrollEl.checked) logEl.scrollTop = logEl.scrollHeight
})

document.getElementById('btn-clear').addEventListener('click', () => {
  logEl.innerHTML = ''
  window.devtoolsAPI.clearLog()
})

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
