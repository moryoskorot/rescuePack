// Lightweight, generated vehicle audio. The AudioContext is created on the
// start-button gesture so the game can play in browsers with autoplay limits.
export function soundLevels({speed = 0, throttle = 0, braking = false, handbrake = false, boost = false}) {
  const pace = Math.min(Math.max(speed, 0) / 36, 1);
  const pedal = Math.min(Math.abs(throttle), 1);
  const brake = speed > 2.5 && (braking || handbrake) ? Math.min(speed / 14, 1) : 0;
  return {
    enginePitch: 59 + pace * 104 + pedal * 38,
    engineGain: .045 + pace * .085 + pedal * .037,
    brakeGain: brake * .16,
    boostGain: boost ? .21 : 0,
  };
}

export function createVehicleSound(AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext) {
  let context, master, engine, engineBody, engineGain, bodyGain;
  let brakeScrubGain, brakeGrindGain, boostGain, boostFilter;
  let pauseTimer, audible = false;

  function ramp(param, value, seconds = .09) {
    param.setTargetAtTime(value, context.currentTime, seconds);
  }

  function makeOscillator(type, frequency, gain, destination) {
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    volume.gain.value = gain;
    oscillator.connect(volume).connect(destination);
    oscillator.start();
    return {oscillator, volume};
  }

  function makeNoiseBuffer() {
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 71337;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = seed / 2147483648 - 1;
    }
    return buffer;
  }

  function makeNoise(buffer, type, frequency, q, gain) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const volume = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    volume.gain.value = gain;
    source.connect(filter).connect(volume).connect(master);
    source.start();
    return {source, filter, volume};
  }

  function build() {
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineFilter.Q.value = .8;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(engineFilter).connect(master);
    engine = makeOscillator('sawtooth', 59, 1, engineGain).oscillator;
    bodyGain = context.createGain();
    bodyGain.gain.value = 0;
    bodyGain.connect(master);
    engineBody = makeOscillator('sine', 29.5, 1, bodyGain).oscillator;

    const noise = makeNoiseBuffer();
    // Broad tire scrub and a quieter, rough lower layer. A pitched oscillator
    // here sounded like the truck's siren when braking speed changed.
    brakeScrubGain = makeNoise(noise, 'bandpass', 2100, .55, 0).volume;
    brakeGrindGain = makeNoise(noise, 'bandpass', 520, .5, 0).volume;
    const water = makeNoise(noise, 'bandpass', 900, .38, 0);
    boostGain = water.volume;
    boostFilter = water.filter;
  }

  return {
    start() {
      if (!AudioContextClass) return;
      if (audible && context?.state === 'running') return;
      if (!context) build();
      audible = true;
      clearTimeout(pauseTimer);
      context.resume().catch(() => {});
      ramp(master.gain, .58, .11);
    },
    update(input) {
      if (!context || !audible) return;
      const levels = soundLevels(input);
      ramp(engine.frequency, levels.enginePitch, .12);
      ramp(engineBody.frequency, levels.enginePitch / 2, .12);
      ramp(engineGain.gain, levels.engineGain, .1);
      ramp(bodyGain.gain, levels.engineGain * .55, .1);
      ramp(brakeScrubGain.gain, levels.brakeGain, .035);
      ramp(brakeGrindGain.gain, levels.brakeGain * .36, .055);
      ramp(boostGain.gain, levels.boostGain, input.boost ? .16 : .08);
      ramp(boostFilter.frequency, input.boost ? 1150 : 700, .16);
    },
    pause() {
      if (!context) return;
      audible = false;
      clearTimeout(pauseTimer);
      ramp(master.gain, 0, .035);
      pauseTimer = setTimeout(() => {
        if (!audible) context.suspend().catch(() => {});
      }, 170);
    },
  };
}
