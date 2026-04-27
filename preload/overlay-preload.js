const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('overlayAPI', {
  onCharacterSet: (cb) => ipcRenderer.on('character:set', (_, data) => cb(data)),
  onReaction: (cb) => ipcRenderer.on('reaction:fire', (_, data) => cb(data)),
  reportMove: (dx, dy) => ipcRenderer.send('overlay:moved', { dx, dy }),
  setClickThrough: (enabled) => ipcRenderer.send('overlay:click-through', enabled),
  sendTransition: (payload) => ipcRenderer.invoke('pomodoro:transition', payload),
  sendPause: (payload) => ipcRenderer.invoke('pomodoro:pause', payload),
  setPomodoroRunning: (active) => ipcRenderer.send('pomodoro:running', { active }),
  openSettings: () => ipcRenderer.send('settings:open')
})
