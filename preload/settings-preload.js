const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('settingsAPI', {
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  startSession: (taskDescription) => ipcRenderer.invoke('session:start', taskDescription),
  pauseSession: () => ipcRenderer.invoke('session:pause'),
  resumeSession: () => ipcRenderer.invoke('session:resume'),
  resetPomodoroTimer: () => ipcRenderer.invoke('pomodoro:reset'),
  onSessionStateUpdate: (cb) => ipcRenderer.on('session:state-update', (_, state) => cb(state)),
  getCharacters: () => ipcRenderer.invoke('characters:get')
})
