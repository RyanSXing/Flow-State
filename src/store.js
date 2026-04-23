const Store = require('electron-store')

const store = new Store()

function getApiKeys() {
  return {
    anthropic: store.get('anthropicKey', ''),
    elevenlabs: store.get('elevenlabsKey', '')
  }
}

function setApiKey(provider, value) {
  store.set(provider === 'anthropic' ? 'anthropicKey' : 'elevenlabsKey', value)
}

function getSettings() {
  return {
    character: store.get('character', 'drill-sergeant'),
    interval: store.get('interval', 20),
    paused: store.get('paused', false),
    taskDescription: store.get('taskDescription', '')
  }
}

function setSetting(key, value) {
  store.set(key, value)
}

function getOverlayPosition() {
  return {
    x: store.get('overlayX', null),
    y: store.get('overlayY', null)
  }
}

function setOverlayPosition(x, y) {
  store.set('overlayX', x)
  store.set('overlayY', y)
}

module.exports = { getApiKeys, setApiKey, getSettings, setSetting, getOverlayPosition, setOverlayPosition }
