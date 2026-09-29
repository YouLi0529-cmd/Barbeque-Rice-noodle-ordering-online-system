const SAMPLE_RATE = 8000

const SOUND_CONFIG = {
  click: {
    fileName: 'zhangnan-admin-click.wav',
    sampleCount: 360,
    volume: 0.12,
    cooldown: 70
  },
  notification: {
    fileName: 'zhangnan-admin-notification.wav',
    sampleCount: 1440,
    volume: 0.2,
    cooldown: 800
  }
}

const audioCache = {}
const lastPlayedAt = {}

function writeAscii(bytes, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index)
  }
}

function getSample(type, index) {
  const time = index / SAMPLE_RATE
  if (type === 'click') {
    const envelope = Math.exp(-time * 85)
    return Math.sin(2 * Math.PI * 1300 * time) * 0.34 * envelope
  }

  if (index < 420) {
    return Math.sin(2 * Math.PI * 900 * time) * 0.3 * Math.exp(-time * 22)
  }
  if (index >= 650 && index < 1250) {
    const localTime = (index - 650) / SAMPLE_RATE
    return Math.sin(2 * Math.PI * 1250 * localTime) * 0.32 * Math.exp(-localTime * 17)
  }
  return 0
}

function createWavBase64(type) {
  const config = SOUND_CONFIG[type]
  if (!config || !wx.arrayBufferToBase64) return ''

  const buffer = new ArrayBuffer(44 + config.sampleCount)
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  writeAscii(bytes, 0, 'RIFF')
  view.setUint32(4, 36 + config.sampleCount, true)
  writeAscii(bytes, 8, 'WAVE')
  writeAscii(bytes, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  writeAscii(bytes, 36, 'data')
  view.setUint32(40, config.sampleCount, true)

  for (let index = 0; index < config.sampleCount; index += 1) {
    const sample = Math.max(-1, Math.min(1, getSample(type, index)))
    bytes[44 + index] = Math.round(128 + sample * 127)
  }
  return wx.arrayBufferToBase64(buffer)
}

function getAudio(type) {
  if (audioCache[type]) return audioCache[type]
  if (typeof wx === 'undefined' || !wx.getFileSystemManager || !wx.createInnerAudioContext || !wx.env || !wx.env.USER_DATA_PATH) return null

  const config = SOUND_CONFIG[type]
  if (!config) return null
  const filePath = `${wx.env.USER_DATA_PATH}/${config.fileName}`
  try {
    const fs = wx.getFileSystemManager()
    let hasCachedFile = false
    if (typeof fs.accessSync === 'function') {
      try {
        fs.accessSync(filePath)
        hasCachedFile = true
      } catch (err) {}
    }
    if (!hasCachedFile) {
      const soundData = createWavBase64(type)
      if (!soundData) return null
      fs.writeFileSync(filePath, soundData, 'base64')
    }

    const audio = wx.createInnerAudioContext()
    audio.autoplay = false
    audio.loop = false
    audio.obeyMuteSwitch = false
    audio.volume = config.volume
    audio.src = filePath
    audioCache[type] = audio
    return audio
  } catch (err) {
    console.warn('prepare admin sound failed', type, err)
    return null
  }
}

function play(type) {
  const config = SOUND_CONFIG[type]
  if (!config) return
  const now = Date.now()
  if (now - Number(lastPlayedAt[type] || 0) < config.cooldown) return
  lastPlayedAt[type] = now

  const audio = getAudio(type)
  if (!audio) return
  try {
    audio.stop()
    audio.seek(0)
    audio.play()
  } catch (err) {
    console.warn('play admin sound failed', type, err)
  }
}

function playClick(event) {
  const dataset = event && event.target && event.target.dataset || {}
  if (dataset.adminSound === 'off') return
  play('click')
}

function playNotification() {
  play('notification')
}

module.exports = {
  playClick,
  playNotification
}
