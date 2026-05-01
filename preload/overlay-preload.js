const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('overlayAPI', {
  onCharacterSet: (cb) => ipcRenderer.on('character:set', (_, data) => cb(data)),
  onReaction: (cb) => ipcRenderer.on('reaction:fire', (_, data) => cb(data)),
  onAvatarTalking: (cb) => ipcRenderer.on('avatar:talking', (_, data) => cb(data)),
  onSetRunning: (cb) => ipcRenderer.on('pomodoro:set-running', (_, data) => cb(data)),
  onPomodoroSettingsUpdate: (cb) => ipcRenderer.on('pomodoro:settings-update', (_, data) => cb(data)),
  onPomodoroReset: (cb) => ipcRenderer.on('pomodoro:reset', () => cb()),
  reportMove: (dx, dy) => ipcRenderer.send('overlay:moved', { dx, dy }),
  setClickThrough: (enabled) => ipcRenderer.send('overlay:click-through', enabled),
  sendTransition: (payload) => ipcRenderer.invoke('pomodoro:transition', payload),
  sendPause: (payload) => ipcRenderer.invoke('pomodoro:pause', payload),
  setPomodoroRunning: (active) => ipcRenderer.send('pomodoro:running', { active }),
  openSettings: () => ipcRenderer.send('settings:open')
})
