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

  function staticBurst(time, duration, volume) {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 45123;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const t = i / context.sampleRate;
      samples[i] = (seed / 2147483648 - 1) * Math.min(1, t * 100) * Math.min(1, (duration - t) * 30);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = .55;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(time);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  return {
    unlock() { ready(); },
    playCall() {
      if (!ready()) return;
      const time = context.currentTime + .01;
      // A clear radio click, two call tones, and a soft tail of static.
      staticBurst(time, .15, .38);
      note(time + .14, 660, .19, .18, 'triangle');
      note(time + .37, 880, .22, .19, 'triangle');
      staticBurst(time + .64, .2, .24);
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
