// Pointer capture keeps each thumb attached to its own control, even when it
// slides outside the button. Touch input never adds/removes keyboard keys.
export function createTouchControls({ root, stick, knob, brake, isPlaying, win = window, doc = document }) {
  const input = { throttle: 0, steer: 0, handbrake: false };
  const coarsePointer = win.matchMedia('(any-pointer: coarse)');
  const brakePointers = new Set();
  let stickPointer = null;
  let touchSeen = false;

  function showIfTouchDevice() {
    const enabled = touchSeen || win.navigator.maxTouchPoints > 0 || coarsePointer.matches;
    root.classList.toggle('hidden', !enabled);
    doc.body.classList.toggle('has-touch-controls', enabled);
    if (!enabled) reset();
  }

  function releaseCapture(element, pointerId) {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  }

  function resetStick() {
    const pointerId = stickPointer;
    stickPointer = null;
    input.throttle = 0;
    input.steer = 0;
    knob.style.setProperty('--stick-x', '0px');
    knob.style.setProperty('--stick-y', '0px');
    stick.classList.remove('active');
    if (pointerId !== null) releaseCapture(stick, pointerId);
  }

  function renderBrake() {
    input.handbrake = brakePointers.size > 0;
    brake.classList.toggle('active', input.handbrake);
    brake.setAttribute('aria-pressed', String(input.handbrake));
  }

  function reset() {
    resetStick();
    const pointers = [...brakePointers];
    brakePointers.clear();
    renderBrake();
    pointers.forEach(id => releaseCapture(brake, id));
  }

  function moveStick(event) {
    const rect = stick.getBoundingClientRect();
    const radius = rect.width * .3;
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const length = Math.max(radius, Math.hypot(dx, dy));
    const x = dx / length, y = dy / length;
    // A small dead zone lets the player drive straight without thumb jitter.
    const axis = value => Math.sign(value) * Math.max(0, (Math.abs(value) - .16) / .84);
    input.steer = axis(x);
    input.throttle = -axis(y);
    knob.style.setProperty('--stick-x', `${x * radius}px`);
    knob.style.setProperty('--stick-y', `${y * radius}px`);
  }

  stick.addEventListener('pointerdown', event => {
    if (!isPlaying() || event.button !== 0 || stickPointer !== null) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    stick.classList.add('active');
    moveStick(event);
  });
  stick.addEventListener('pointermove', event => {
    if (event.pointerId !== stickPointer) return;
    event.preventDefault();
    moveStick(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(type, event => {
      if (event.pointerId === stickPointer) resetStick();
    });
    brake.addEventListener(type, event => {
      brakePointers.delete(event.pointerId);
      renderBrake();
      releaseCapture(brake, event.pointerId);
    });
  }
  brake.addEventListener('pointerdown', event => {
    if (!isPlaying() || event.button !== 0) return;
    event.preventDefault();
    brakePointers.add(event.pointerId);
    brake.setPointerCapture(event.pointerId);
    renderBrake();
  });
  root.addEventListener('contextmenu', event => event.preventDefault());

  // maxTouchPoints covers tablets and hybrid laptops. Also detect a touch
  // arriving after startup (for example a newly connected touch display).
  win.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && !touchSeen) {
      touchSeen = true;
      showIfTouchDevice();
    }
  }, { passive: true });
  coarsePointer.addEventListener('change', showIfTouchDevice);
  win.addEventListener('blur', reset);
  win.addEventListener('resize', reset);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) reset(); });
  renderBrake();
  showIfTouchDevice();
  return { input, reset };
}
