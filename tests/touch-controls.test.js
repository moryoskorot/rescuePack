import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchControls } from '../src/touch-controls.js';

class Element extends EventTarget {
  constructor() {
    super();
    this.classes = new Set();
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name),
      contains: name => this.classes.has(name),
    };
    this.styles = new Map();
    this.style = { setProperty: (name, value) => this.styles.set(name, value) };
    this.attributes = new Map();
    this.captures = new Set();
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 144, height: 144 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}

function pointer(target, type, pointerId, clientX = 72, clientY = 72, pointerType = 'touch') {
  const event = Object.assign(new Event(type, { cancelable: true }),
    { pointerId, clientX, clientY, button: 0, pointerType });
  target.dispatchEvent(event);
  return event;
}

function fixture(touchPoints = 5) {
  const root = new Element(), stick = new Element(), knob = new Element(), brake = new Element();
  const coarsePointer = Object.assign(new EventTarget(), { matches: false });
  const win = Object.assign(new EventTarget(), {
    navigator: { maxTouchPoints: touchPoints },
    matchMedia: () => coarsePointer,
  });
  const doc = Object.assign(new EventTarget(), { body: new Element(), hidden: false });
  let playing = true;
  const controls = createTouchControls({ root, stick, knob, brake, isPlaying: () => playing, win, doc });
  return { root, stick, knob, brake, win, doc, controls, setPlaying: value => { playing = value; } };
}

test('a moving thumb can accelerate and steer while another holds B', () => {
  const { stick, knob, brake, controls } = fixture();
  pointer(stick, 'pointerdown', 1, 72, 72);
  pointer(stick, 'pointermove', 1, 102, 42);
  assert.ok(controls.input.throttle > .3);
  assert.ok(controls.input.steer > .3);
  assert.notEqual(knob.styles.get('--stick-x'), '0px');

  pointer(brake, 'pointerdown', 2);
  assert.equal(controls.input.handbrake, true);
  assert.equal(brake.attributes.get('aria-pressed'), 'true');
  pointer(stick, 'pointercancel', 1);
  assert.equal(controls.input.throttle, 0);
  assert.equal(controls.input.steer, 0);
  assert.equal(controls.input.handbrake, true);
  pointer(brake, 'pointerup', 2);
  assert.equal(controls.input.handbrake, false);
});

test('controls are shown for touch capability and reset on lost focus', () => {
  const { root, stick, brake, win, controls } = fixture();
  assert.equal(root.classList.contains('hidden'), false);
  pointer(stick, 'pointerdown', 1, 72, 10);
  pointer(brake, 'pointerdown', 2);
  assert.ok(controls.input.throttle > 0);
  assert.equal(controls.input.handbrake, true);
  win.dispatchEvent(new Event('blur'));
  assert.deepEqual(controls.input, { throttle: 0, steer: 0, handbrake: false });
  assert.equal(stick.captures.size, 0);
  assert.equal(brake.captures.size, 0);
});

test('a later touch reveals controls, while desktop mouse does not', () => {
  const { root, win, stick, controls } = fixture(0);
  assert.equal(root.classList.contains('hidden'), true);
  pointer(win, 'pointerdown', 1, 0, 0, 'mouse');
  assert.equal(root.classList.contains('hidden'), true);
  pointer(win, 'pointerdown', 2);
  assert.equal(root.classList.contains('hidden'), false);
  pointer(stick, 'pointerdown', 3, 72, 10);
  assert.ok(controls.input.throttle > 0);
});
