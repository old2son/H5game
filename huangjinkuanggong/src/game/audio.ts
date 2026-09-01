type Wave = OscillatorType

class SoundKit {
  private ctx: AudioContext | null = null
  muted = false

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return null
        this.ctx = new Ctor()
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  unlock() {
    try {
      this.ensure()
    } catch {
      /* 忽略音频不可用 */
    }
  }

  private tone(freq: number, duration: number, type: Wave = 'square', gain = 0.06, slideTo?: number) {
    if (this.muted) return
    const ctx = this.ensure()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 30), ctx.currentTime + duration)
    amp.gain.setValueAtTime(gain, ctx.currentTime)
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.connect(amp).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration + 0.02)
  }

  private noise(duration: number, gain = 0.2, freq = 700) {
    if (this.muted) return
    const ctx = this.ensure()
    if (!ctx) return
    const frames = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = freq
    const amp = ctx.createGain()
    amp.gain.value = gain
    src.connect(filter).connect(amp).connect(ctx.destination)
    src.start()
  }

  shoot() {
    this.tone(760, 0.12, 'square', 0.05, 240)
  }

  grab() {
    this.tone(320, 0.09, 'triangle', 0.07)
  }

  coin(value: number) {
    const base = value >= 500 ? 880 : value >= 250 ? 760 : 640
    this.tone(base, 0.09, 'square', 0.06)
    window.setTimeout(() => this.tone(base * 1.5, 0.12, 'square', 0.05), 80)
  }

  rock() {
    this.tone(150, 0.16, 'sawtooth', 0.05, 90)
    this.noise(0.16, 0.06, 500)
  }

  boom() {
    this.noise(0.55, 0.32, 900)
    this.tone(110, 0.45, 'sawtooth', 0.09, 40)
  }

  tick() {
    this.tone(1200, 0.05, 'square', 0.03)
  }

  levelUp() {
    ;[523, 659, 784, 1046].forEach((freq, index) => {
      window.setTimeout(() => this.tone(freq, 0.16, 'triangle', 0.07), index * 110)
    })
  }

  fail() {
    ;[440, 370, 294, 220].forEach((freq, index) => {
      window.setTimeout(() => this.tone(freq, 0.24, 'sawtooth', 0.06), index * 150)
    })
  }
}

export const sfx = new SoundKit()
