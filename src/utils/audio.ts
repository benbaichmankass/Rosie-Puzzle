/**
 * Web Audio API synthesizer for cozy sound effects.
 * Safe for all mobile and desktop browsers without external audio assets.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public playPop() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio might be blocked until user interaction
    }
  }

  public playRotate() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  public playDogGrumble() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  public playDogGrowl() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      // Modulated growl
      const osc = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.45);

      mod.type = 'sine';
      mod.frequency.setValueAtTime(28, ctx.currentTime); // growl rumble
      modGain.gain.setValueAtTime(25, ctx.currentTime);

      mod.connect(osc.frequency);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      mod.start();
      osc.start();
      mod.stop(ctx.currentTime + 0.52);
      osc.stop(ctx.currentTime + 0.52);
    } catch {}
  }

  public playDogChomp() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      // Quick snap + squeak
      const snap = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snap.type = 'sawtooth';
      snap.frequency.setValueAtTime(180, ctx.currentTime);
      snap.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.08);

      snapGain.gain.setValueAtTime(0.3, ctx.currentTime);
      snapGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);

      snap.connect(snapGain);
      snapGain.connect(ctx.destination);
      snap.start();
      snap.stop(ctx.currentTime + 0.1);

      // Yelping squeak
      const ouch = ctx.createOscillator();
      const ouchGain = ctx.createGain();
      ouch.type = 'sine';
      ouch.frequency.setValueAtTime(620, ctx.currentTime + 0.06);
      ouch.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.24);

      ouchGain.gain.setValueAtTime(0.2, ctx.currentTime + 0.06);
      ouchGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.26);

      ouch.connect(ouchGain);
      ouchGain.connect(ctx.destination);
      ouch.start(ctx.currentTime + 0.06);
      ouch.stop(ctx.currentTime + 0.28);
    } catch {}
  }

  public playDogBark() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }

  public playTreatCrunch() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      [0, 0.07, 0.14].forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(450 + i * 80, ctx.currentTime + t);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + t + 0.04);

        gain.gain.setValueAtTime(0.12, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.06);
      });
    } catch {}
  }

  public playSqueak() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1300, ctx.currentTime + 0.08);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }

  public playWinFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [392.0, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.16, start);
        gain.gain.exponentialRampToValueAtTime(0.005, start + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {}
  }

  public playCrunch() {
    this.playTreatCrunch();
  }

  public playSnore() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  public playCuddleChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [587.33, 659.25, 880.0, 1174.66]; // D5, E5, A5, D6
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.005, start + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch {}
  }

  public playPeeSplash() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      [0, 0.06, 0.14, 0.22].forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650 - i * 110, ctx.currentTime + t);
        osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + t + 0.08);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.1);
      });
    } catch {}
  }
}

export const sound = new SoundEngine();
