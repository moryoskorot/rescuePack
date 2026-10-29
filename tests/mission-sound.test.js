import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionSound } from '../src/mission-sound.js';

class FakeAudioContext {
  static last;
  constructor() {
    FakeAudioContext.last = this;
    this.currentTime = 1;
    this.sampleRate = 8000;
    this.state = 'running';
    this.destination = {};
    this.notes = [];
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 }, connect() { return this; }, disconnect() {} }; }
  createOscillator() {
    const node = { frequency: { value: 0 }, connect() { return this; }, disconnect() {}, stop() {} };
    node.start = time => this.notes.push({ time, pitch: node.frequency.value });
    return node;
  }
}

test('mission call is prompt, pickup dings, and charge boops rise then stop', () => {
  const sound = createMissionSound(FakeAudioContext);
  sound.unlock();
  const context = FakeAudioContext.last;
  sound.playCall();
  assert.equal(context.notes.length, 2);
  assert.ok(context.notes[0].time - context.currentTime < .02);
  sound.playCollect();
  assert.equal(context.notes.length, 4);
  sound.updateCharge(true, 0);
  assert.equal(context.notes.length, 5);
  const firstPitch = context.notes.at(-1).pitch;
  context.currentTime += .2;
  sound.updateCharge(true, .5);
  assert.equal(context.notes.length, 5, 'boops do not stack every frame');
  context.currentTime += .3;
  sound.updateCharge(true, .75);
  assert.ok(context.notes.at(-1).pitch > firstPitch);
  sound.stopCharge();
  context.currentTime += 1;
  sound.updateCharge(false, 1);
  assert.equal(context.notes.length, 6);
});
