// Peak-Time & Hypnotic Underground Techno Synthesizer for Open Deck TMA
// 128 BPM • Key: 4A (F Minor)
// Deck A: "Berlin Vault" (Industrial Rumble Kick, Screaming TB-303 Acid Bass, Sizzling 909 Ride, Strobe Claps)
// Deck B: "Dark Matter" (Tight Kick, Hypnotic Modular Hook, Dark Rave Chord Stabs, Chiseled 909 Hats)
//
// Each deck can be started/stopped independently (setDeckActive) and the kick
// can be muted per deck (setKickMuted) so the audio follows the track structure
// drawn in the waveform (e.g. kick-less breakdowns).

export type DeckId = 'A' | 'B';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private deckAGain: GainNode | null = null;
  private deckBGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private filterMaster: BiquadFilterNode | null = null;
  private intervalId: number | null = null;
  private beatStep: number = 0;
  private barCount: number = 0;
  private deckActive: Record<DeckId, boolean> = { A: true, B: true };
  private kickMuted: Record<DeckId, boolean> = { A: false, B: false };
  private cachedNoiseBuffer: AudioBuffer | null = null;

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      this.filterMaster = this.ctx.createBiquadFilter();
      this.filterMaster.type = 'lowpass';
      this.filterMaster.frequency.setValueAtTime(18000, this.ctx.currentTime);

      this.masterGain.connect(this.filterMaster);
      this.filterMaster.connect(this.ctx.destination);

      // Deck A (Left)
      this.deckAGain = this.ctx.createGain();
      this.deckAGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.deckAGain.connect(this.masterGain);

      // Deck B (Right)
      this.deckBGain = this.ctx.createGain();
      this.deckBGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      this.deckBGain.connect(this.masterGain);

      // Предрасчитанный буфер белого шума (2 сек) для устранения GC-троттлинга
      const size = Math.floor(this.ctx.sampleRate * 2.0);
      this.cachedNoiseBuffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
      const data = this.cachedNoiseBuffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setCrossfader(value: number) {
    if (!this.ctx || !this.deckAGain || !this.deckBGain) return;
    const now = this.ctx.currentTime;
    // Equal-power crossfade curve
    const gainA = Math.cos(value * 0.5 * Math.PI);
    const gainB = Math.cos((1.0 - value) * 0.5 * Math.PI);
    this.deckAGain.gain.setTargetAtTime(gainA, now, 0.03);
    this.deckBGain.gain.setTargetAtTime(gainB, now, 0.03);
  }

  /** Start/stop the patterns of a single deck (the sequencer clock keeps running). */
  public setDeckActive(deck: DeckId, active: boolean) {
    this.deckActive[deck] = active;
  }

  /** Mute the kick of a deck (used for breakdown sections). */
  public setKickMuted(deck: DeckId, muted: boolean) {
    this.kickMuted[deck] = muted;
  }

  public startPlayback() {
    this.init();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.beatStep = 0;
    this.barCount = 0;

    // 128 BPM Techno clock: 16th note = (60 / 128 / 4) * 1000 = 117.1875 ms
    const stepTimeMs = (60 / 128 / 4) * 1000;

    this.intervalId = window.setInterval(() => {
      this.triggerStep(this.beatStep, this.barCount);
      this.beatStep = (this.beatStep + 1) % 16;
      if (this.beatStep === 0) {
        this.barCount = (this.barCount + 1) % 8;
      }
    }, stepTimeMs);
  }

  public stopPlayback() {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private triggerStep(step: number, bar: number) {
    if (!this.ctx || !this.deckAGain || !this.deckBGain) return;
    const now = this.ctx.currentTime;

    // ================= DECK A: BERLIN VAULT (PEAK-TIME INDUSTRIAL TECHNO) =================
    if (this.deckActive.A) {
      const out = this.deckAGain;
      const kickOn = !this.kickMuted.A;

      // 1. Industrial Punch Kick + Sub Rumble
      if (kickOn && step % 4 === 0) this.playTechnoKick(now, out, 175);
      if (kickOn && step % 2 === 1) this.playSubRumble(now, 43.65, out); // F0 rumble

      // 2. TB-303 Acid Bassline in F Minor
      const acidNotes = [43.65, 43.65, 51.9, 43.65, 43.65, 58.27, 43.65, 51.9, 43.65, 65.41, 58.27, 51.9, 43.65, 51.9, 43.65, 38.89];
      if (step % 2 === 1 || step === 2 || step === 10 || step === 14) {
        this.playTB303Acid(now, acidNotes[step], out);
      }

      // 3. Sizzling 909 Ride on offbeats
      if (step % 4 === 2) this.playTechnoRide(now, out);

      // 4. Strobe Clap on beats 2 & 4
      if (kickOn && (step === 4 || step === 12)) this.playStrobeClap(now, out);
    }

    // ================= DECK B: DARK MATTER (HYPNOTIC RAW TECHNO) =================
    if (this.deckActive.B) {
      const out = this.deckBGain;
      const kickOn = !this.kickMuted.B;

      // 1. Tight hypnotic kick
      if (kickOn && step % 4 === 0) this.playTechnoKick(now, out, 150);

      // 2. Hypnotic Modular Arp Hook in F Minor
      const modularNotes = [174.61, 207.65, 261.63, 311.13, 349.23, 311.13, 261.63, 207.65];
      this.playModularSynth(now, modularNotes[(step + bar * 2) % modularNotes.length], out);

      // 3. Dark Minor-9th Rave Chord Stabs
      if (step === 0 || step === 6 || step === 10) this.playDarkRaveChord(now, bar, out);

      // 4. Chiseled 909 Open Hat on offbeats
      if (step % 4 === 2) this.playChiseledHat(now, out);

      // 5. Fast 16th-note Metallic Percussion
      this.playMetallicPerc(now, step % 2 === 1 ? 0.22 : 0.1, out);
    }
  }

  // Distorted Industrial Kick Drum
  private playTechnoKick(time: number, target: GainNode, startFreq: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.06);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.22);

    gain.gain.setValueAtTime(1.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    osc.connect(gain);
    gain.connect(target);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  // Sub-Rumble
  private playSubRumble(time: number, freq: number, target: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, time);
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  // Screaming TB-303 Acid Bass
  private playTB303Acid(time: number, freq: number, target: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, time);
    filter.frequency.exponentialRampToValueAtTime(140, time + 0.11);
    filter.Q.setValueAtTime(9.0, time);
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    osc.start(time);
    osc.stop(time + 0.14);
  }

  private noiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.cachedNoiseBuffer) return this.cachedNoiseBuffer;
    const size = Math.floor(this.ctx.sampleRate * Math.max(2.0, seconds));
    this.cachedNoiseBuffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = this.cachedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return this.cachedNoiseBuffer;
  }

  private playNoise(
    time: number,
    target: GainNode,
    seconds: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    vol: number,
  ) {
    if (!this.ctx) return;
    const buffer = this.noiseBuffer(seconds);
    if (!buffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.setValueAtTime(q, time);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + seconds * 0.95);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    noise.start(time);
    noise.stop(time + seconds);
  }

  // Sizzling 909 Ride
  private playTechnoRide(time: number, target: GainNode) {
    this.playNoise(time, target, 0.18, 'bandpass', 9500, 3.0, 0.4);
  }

  // Strobe Clap
  private playStrobeClap(time: number, target: GainNode) {
    this.playNoise(time, target, 0.13, 'bandpass', 1600, 1.8, 0.7);
  }

  // Chiseled Open Hat
  private playChiseledHat(time: number, target: GainNode) {
    this.playNoise(time, target, 0.14, 'highpass', 8000, 0.7, 0.45);
  }

  // Metallic Percussion
  private playMetallicPerc(time: number, vol: number, target: GainNode) {
    this.playNoise(time, target, 0.03, 'bandpass', 9200, 4.0, vol * 0.5);
  }

  // Hypnotic Modular Synth Hook
  private playModularSynth(time: number, freq: number, target: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.8, time);
    filter.Q.setValueAtTime(4.0, time);
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  // Dark Minor-9th Rave Chords (Fm9 -> Db -> Bbm9 -> C7)
  private playDarkRaveChord(time: number, bar: number, target: GainNode) {
    if (!this.ctx) return;
    const chordFm9 = [174.61, 207.65, 261.63, 311.13, 349.23];
    const chordDb = [138.59, 174.61, 207.65, 261.63];
    const chordBbm9 = [116.54, 174.61, 207.65, 233.08];
    const chordC7 = [130.81, 164.81, 196.0, 233.08];
    const chords = [chordFm9, chordFm9, chordDb, chordDb, chordBbm9, chordBbm9, chordC7, chordC7];
    const activeChord = chords[bar % chords.length];

    activeChord.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.detune.setValueAtTime((idx - 1.5) * 12, time);
      osc.frequency.setValueAtTime(freq, time);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, time);
      filter.Q.setValueAtTime(3.0, time);
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(target);
      osc.start(time);
      osc.stop(time + 0.4);
    });
  }

  public playArchetypePreview(archetype: string) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const target = this.masterGain;

    if (archetype === 'driver') {
      // Punch Kick + Acid Bite
      this.playTechnoKick(now, target, 180);
      this.playTB303Acid(now + 0.1, 58.27, target);
      this.playTechnoKick(now + 0.25, target, 175);
      this.playTB303Acid(now + 0.35, 65.41, target);
    } else if (archetype === 'shaman') {
      // Tribal percussions & offbeat ride
      this.playSubRumble(now, 55, target);
      this.playMetallicPerc(now + 0.05, 0.4, target);
      this.playMetallicPerc(now + 0.15, 0.6, target);
      this.playTechnoRide(now + 0.25, target);
      this.playMetallicPerc(now + 0.35, 0.5, target);
    } else if (archetype === 'alchemist') {
      // Lush Super-saw rave chord
      this.playDarkRaveChord(now, 0, target);
      this.playChiseledHat(now + 0.2, target);
    } else {
      // curator: Deep warm chord + soft modular beep
      this.playDarkRaveChord(now, 2, target);
      this.playModularSynth(now + 0.15, 261.63, target);
      this.playModularSynth(now + 0.3, 311.13, target);
    }
  }

  public playCelebrationDrop() {
    // Intentionally silent: celebration is visual only (confetti + flash).
  }
}

export const audioEngine = new AudioEngine();
