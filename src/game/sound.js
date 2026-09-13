export class Soundscape {
  constructor() {
    this.context = null;
    this.windGain = null;
  }

  ensure() {
    if (this.context) {
      if (this.context.state === "suspended") this.context.resume();
      return;
    }
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      const length = this.context.sampleRate * 2;
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
      const source = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      this.windGain = this.context.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = 620;
      this.windGain.gain.value = 0;
      source.connect(filter).connect(this.windGain).connect(this.context.destination);
      source.start();
    } catch {
      this.context = null;
    }
  }

  wind(value) {
    if (!this.context || !this.windGain) return;
    this.windGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(.075, value * .075)), this.context.currentTime + .12);
  }

  tone(frequency, duration = .12, endFrequency = frequency, volume = .055) {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  target() { this.tone(720, .12, 930, .045); }
  hit() { this.tone(135, .22, 62, .08); }
  catch() { this.tone(420, .1, 760, .06); }
  reward() {
    this.tone(620, .09, 660, .05);
    setTimeout(() => this.tone(820, .1, 900, .05), 90);
    setTimeout(() => this.tone(1040, .15, 1180, .05), 190);
  }
}
