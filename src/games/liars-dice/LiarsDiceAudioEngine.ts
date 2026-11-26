import { AudioFrameContext, GameAudioEngine } from '../../audio/GameAudioEngine';

/**
 * Tiny zero-asset casino table synthesizer for Liar's Dice.
 * All sounds are generated with the Web Audio API.
 */
export class LiarsDiceAudioEngine implements GameAudioEngine {
  readonly id = 'liars-dice';
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.26;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.26, this.ctx.currentTime, 0.04);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  updateFromController(_ctx: AudioFrameContext): void {
    // No continuous engine sound.
  }

  playRoll(): void {
    for (let i = 0; i < 5; i++) {
      this.click(0.02 + i * 0.045, 420 + Math.random() * 520, 0.035);
    }
  }

  playBid(): void {
    this.tone(440, 0.08, 'triangle', 0.11);
    this.tone(660, 0.12, 'triangle', 0.1, 0.07);
  }

  playChallenge(): void {
    this.tone(320, 0.12, 'sawtooth', 0.13);
    this.tone(190, 0.2, 'sawtooth', 0.12, 0.1);
    this.tone(95, 0.32, 'square', 0.1, 0.22);
  }

  playReveal(bidderLost: boolean): void {
    if (bidderLost) {
      this.tone(180, 0.28, 'square', 0.1);
      this.tone(120, 0.38, 'square', 0.1, 0.2);
    } else {
      this.tone(523.25, 0.12, 'triangle', 0.1);
      this.tone(659.25, 0.12, 'triangle', 0.1, 0.08);
      this.tone(783.99, 0.18, 'triangle', 0.1, 0.16);
    }
  }

  playEliminated(): void {
    this.tone(110, 0.5, 'sawtooth', 0.12);
    this.tone(82, 0.65, 'square', 0.1, 0.28);
  }

  playWin(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      this.tone(freq, 0.22, 'triangle', 0.12, i * 0.12);
    });
  }

  destroy(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
    delay = 0
  ): void {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private click(delay: number, freq: number, gainValue: number): void {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const start = this.ctx.currentTime + delay;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.035);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.5;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(start);
  }
}
