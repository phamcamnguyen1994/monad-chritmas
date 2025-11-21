import { useEffect } from 'react'
import { useQuestStore } from '../store/questStore'

const audioState = {
  ctx: null,
  windGain: null,
  crunchGain: null,
  windLFO: null,
  ready: false,
}

function createNoiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function ensureContext() {
  if (audioState.ctx) return audioState.ctx
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null
  const ctx = new AudioContext()
  const noiseBuffer = createNoiseBuffer(ctx)

  const windSource = ctx.createBufferSource()
  windSource.buffer = noiseBuffer
  windSource.loop = true

  const crunchSource = ctx.createBufferSource()
  crunchSource.buffer = noiseBuffer
  crunchSource.loop = true

  const windFilter = ctx.createBiquadFilter()
  windFilter.type = 'lowpass'
  windFilter.frequency.value = 720

  const crunchFilter = ctx.createBiquadFilter()
  crunchFilter.type = 'bandpass'
  crunchFilter.frequency.value = 220
  crunchFilter.Q.value = 1.2

  const windGain = ctx.createGain()
  windGain.gain.value = 0

  const crunchGain = ctx.createGain()
  crunchGain.gain.value = 0

  windSource.connect(windFilter).connect(windGain).connect(ctx.destination)
  crunchSource.connect(crunchFilter).connect(crunchGain).connect(ctx.destination)

  windSource.start(0)
  crunchSource.start(0)

  audioState.ctx = ctx
  audioState.windGain = windGain
  audioState.crunchGain = crunchGain
  audioState.ready = true
  return ctx
}

function resumeContext() {
  const ctx = ensureContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
}

export function playGiftChime() {
  const ctx = ensureContext()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.25)
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.7)
}

export default function AmbientAudio() {
  const playerSpeed = useQuestStore((state) => state.playerSpeed)

  useEffect(() => {
    const resume = () => resumeContext()
    window.addEventListener('pointerdown', resume, { once: true })
    window.addEventListener('keydown', resume, { once: true })
    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [])

  useEffect(() => {
    if (!audioState.ready || !audioState.ctx) return
    const ctx = audioState.ctx
    const time = ctx.currentTime + 0.05
    const windIntensity = Math.min(playerSpeed / 12, 1)
    const baseWind = 0.18 + windIntensity * 0.35
    audioState.windGain.gain.setTargetAtTime(baseWind, time, 0.6)

    const crunchLevel = Math.max(Math.min(playerSpeed / 6, 1) - 0.2, 0)
    audioState.crunchGain.gain.setTargetAtTime(crunchLevel * 0.12, time, 0.15)
  }, [playerSpeed])

  return null
}

