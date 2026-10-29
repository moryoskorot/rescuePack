// Two recorded engine loops are blended as the truck accelerates. Playback
// rate follows a smoothed virtual RPM; load briefly raises it before road
// speed catches up, so pressing the pedal sounds responsive at low speed.
export function soundLevels({speed = 0, throttle = 0, braking = false, handbrake = false, boost = false}) {
  const pace = Math.min(Math.max(speed, 0) / 36, 1);
  const pedal = Math.min(Math.abs(throttle), 1);
  const brake = speed > 2.5 && (braking || handbrake) ? Math.min(speed / 14, 1) : 0;
  const blend = Math.min(1, pace * .84 + pedal * .18);
  return {
    enginePitch: 72 + pace * 98 + pedal * 36,
    engineGain: .10 + pace * .05 + pedal * .025,
    idleGain: (.11 + pedal * .015) * Math.cos(blend * Math.PI / 2),
    fastGain: (.11 + pedal * .025) * Math.sin(blend * Math.PI / 2),
    playbackRate: .76 + pace * .62 + pedal * .16,
    brakeGain: brake * .48,
    boostGain: boost ? .14 : 0,
  };
}

export function createVehicleSound(AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext, skidUrl = 'assets/tire-skid.mp3') {
  let context, master, fallback, fallbackGain, skidGain, skidBuffer, skidSource;
  let boostGain, boostFilter, engineFilter, nextBubbleTime = 0;
  let idleLoop, fastLoop, pauseTimer, audible = false;
  let lastInput = {};
  const assetBase = skidUrl.slice(0, skidUrl.lastIndexOf('/') + 1);

  function ramp(param, value, seconds = .09) {
    param.setTargetAtTime(value, context.currentTime, seconds);
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

  function makeEngineLoop(buffer) {
    const source = context.createBufferSource();
    const volume = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    volume.gain.value = 0;
    source.connect(volume).connect(engineFilter);
    source.start();
    return {source,volume};
  }

  function bubble(time, pitch) {
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(pitch, time);
    tone.frequency.exponentialRampToValueAtTime(pitch * .42, time + .13);
    volume.gain.setValueAtTime(.001, time);
    volume.gain.exponentialRampToValueAtTime(.65, time + .015);
    volume.gain.exponentialRampToValueAtTime(.001, time + .15);
    tone.connect(volume).connect(boostGain);
    tone.start(time);
    tone.stop(time + .16);
    tone.onended = () => { tone.disconnect(); volume.disconnect(); };
  }

  async function loadEngine(url, kind) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Engine audio returned ${response.status}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const loop = makeEngineLoop(buffer);
      if (kind === 'idle') idleLoop = loop;
      else fastLoop = loop;
      ramp(fallbackGain.gain, 0, .12);
      applyEngine(soundLevels(lastInput));
    } catch (error) {
      console.warn(`Could not load ${kind} engine loop:`, error);
    }
  }

  function applyEngine(levels) {
    const ready = Boolean(idleLoop || fastLoop);
    ramp(fallbackGain.gain, ready ? 0 : levels.engineGain * .5, .12);
    ramp(fallback.frequency, levels.enginePitch, .13);
    ramp(engineFilter.frequency, 470 + levels.playbackRate * 600, .18);
    if (idleLoop) {
      ramp(idleLoop.volume.gain, levels.idleGain, .13);
      ramp(idleLoop.source.playbackRate, Math.min(1.4, levels.playbackRate), .17);
    }
    if (fastLoop) {
      ramp(fastLoop.volume.gain, levels.fastGain, .13);
      ramp(fastLoop.source.playbackRate, Math.max(.7,levels.playbackRate * .88), .17);
    }
  }

  function build() {
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 900;
    engineFilter.Q.value = .6;
    engineFilter.connect(master);
    fallbackGain = context.createGain();
    fallbackGain.gain.value = 0;
    fallbackGain.connect(engineFilter);
    fallback = context.createOscillator();
    fallback.type = 'triangle';
    fallback.frequency.value = 72;
    fallback.connect(fallbackGain);
    fallback.start();
    loadEngine(`${assetBase}engine-idle.wav`, 'idle');
    loadEngine(`${assetBase}engine-fast.wav`, 'fast');

    const noise = context.createBufferSource();
    noise.buffer = makeNoiseBuffer();
    noise.loop = true;
    boostFilter = context.createBiquadFilter();
    boostFilter.type = 'bandpass';
    boostFilter.frequency.value = 540;
    boostFilter.Q.value = .7;
    boostGain = context.createGain();
    boostGain.gain.value = 0;
    noise.connect(boostFilter).connect(boostGain).connect(master);
    noise.start();

    skidGain = context.createGain();
    skidGain.gain.value = 0;
    skidGain.connect(master);
    fetch(skidUrl).then(response => {
      if (!response.ok) throw new Error(`Skid audio returned ${response.status}`);
      return response.arrayBuffer();
    }).then(data => context.decodeAudioData(data)).then(buffer => {
      skidBuffer = buffer;
    }).catch(error => console.warn('Could not load tire-skid sound:', error));
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
      lastInput = input;
      const levels = soundLevels(input);
      applyEngine(levels);
      if (levels.brakeGain > 0 && skidBuffer && !skidSource) {
        skidSource = context.createBufferSource();
        skidSource.buffer = skidBuffer;
        skidSource.loop = true;
        skidSource.connect(skidGain);
        skidSource.start();
      }
      ramp(skidGain.gain, levels.brakeGain, .04);
      if (levels.brakeGain === 0 && skidSource) {
        skidSource.stop(context.currentTime + .18);
        skidSource = null;
      }
      ramp(boostGain.gain, levels.boostGain, input.boost ? .08 : .05);
      ramp(boostFilter.frequency, input.boost ? 650 : 440, .12);
      if (input.boost && context.currentTime >= nextBubbleTime) {
        // A changing cluster of descending water notes gives the jet a playful texture.
        const time = context.currentTime;
        bubble(time, 370 + Math.random() * 260);
        nextBubbleTime = time + .11 + Math.random() * .08;
      }
      if (!input.boost) nextBubbleTime = 0;
    },
    pause() {
      if (!context) return;
      audible = false;
      nextBubbleTime = 0;
      if (skidSource) { skidSource.stop(); skidSource = null; }
      clearTimeout(pauseTimer);
      ramp(master.gain, 0, .035);
      pauseTimer = setTimeout(() => { if (!audible) context.suspend().catch(() => {}); }, 170);
    },
  };
}
