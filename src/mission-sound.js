// Short mission cues made with Web Audio, so they are available offline.
export function chargeCueShape(progress) {
  const amount = Math.min(1, Math.max(0, progress));
  return { pitch: 350 + amount * 480, interval: .43 - amount * .23 };
}

export function createMissionSound(AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext) {
  let context;
  let charging = false;
  let nextBoopAt = 0;

  function ready() {
    if (!AudioContextClass) return null;
    context ??= new AudioContextClass();
    if (context.state !== 'running') context.resume().catch(() => {});
    return context;
  }

  function note(time, pitch, duration, volume, type = 'sine') {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = pitch;
    gain.gain.setValueAtTime(.001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + .012);
    gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  return {
    unlock() { ready(); },
    playCall() {
      if (!ready()) return;
      const time = context.currentTime + .01;
      note(time, 660, .19, .18, 'triangle');
      note(time + .23, 880, .22, .19, 'triangle');
    },
    playCollect() {
      if (!ready()) return;
      const time = context.currentTime + .005;
      note(time, 1047, .4, .15);
      note(time + .015, 1568, .32, .07);
    },
    updateCharge(active, progress = 0) {
      if (!active) { charging = false; nextBoopAt = 0; return; }
      if (!ready()) return;
      if (!charging) { charging = true; nextBoopAt = context.currentTime; }
      if (context.currentTime < nextBoopAt) return;
      const { pitch, interval } = chargeCueShape(progress);
      note(context.currentTime + .005, pitch, .105, .105, 'sine');
      nextBoopAt = context.currentTime + interval;
    },
    stopCharge() { charging = false; nextBoopAt = 0; },
  };
}
