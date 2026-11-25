export function createThemeMusic(url) {
  const storageKey = 'rescue-pack-music-volume';
  const track = new Audio();
  track.preload = 'none';
  track.loop = true;
  track.src = url;

  let volume = .25;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null && saved !== '' && Number.isFinite(Number(saved))) {
      volume = Math.min(1, Math.max(0, Number(saved)));
    }
  } catch {
    // The slider still works when storage is blocked.
  }

  // Use Web Audio gain for browsers that ignore media-element volume on mobile.
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  let context;
  let gain;

  return {
    get volume() { return volume; },
    setVolume(value) {
      volume = value;
      if (gain) gain.gain.value = volume;
      if (!AudioContextClass) track.volume = volume;
      try {
        localStorage.setItem(storageKey, String(volume));
      } catch {
        // Keep using the new volume for this session.
      }
    },
    play() {
      if (AudioContextClass) {
        if (!context) {
          context = new AudioContextClass();
          gain = context.createGain();
          gain.gain.value = volume;
          context.createMediaElementSource(track).connect(gain).connect(context.destination);
        }
        if (context.state !== 'running') context.resume().catch(() => {});
      } else {
        track.volume = volume;
      }
      track.play().catch(() => {});
    },
    pause() { track.pause(); },
  };
}
