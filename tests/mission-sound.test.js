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
    this.gains = [];
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() {
    const node = {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 },
      connect(target) { this.output = target; return target; },
      disconnect() {},
    };
    this.gains.push(node);
    return node;
  }
  createMediaElementSource(media) {
    this.mediaSource = { media, connect(target) { this.output = target; return target; } };
    return this.mediaSource;
  }
  createOscillator() {
    const node = { frequency: { value: 0 }, connect(target) { return target; }, disconnect() {}, stop() {} };
    node.start = time => this.notes.push({ time, pitch: node.frequency.value });
    return node;
  }
}

class FakeAudio {
  static last;
  constructor(src) { FakeAudio.last = this; this.src = src; this.currentTime = 3; this.playCount = 0; }
  play() { this.playCount += 1; return Promise.resolve(); }
}

test('mission call is prompt, pickup dings, and charge boops rise then stop', () => {
  const sound = createMissionSound(FakeAudioContext, FakeAudio);
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

test('mission completion uses the selected short trumpet fanfare at 75% volume from the beginning', () => {
  const sound = createMissionSound(FakeAudioContext, FakeAudio);
  sound.playMissionComplete();
  assert.match(FakeAudio.last.src, /assets\/audio\/mission-complete-fanfare\.mp3$/);
  const context = FakeAudioContext.last;
  const { media, output: fanfareGain } = context.mediaSource;
  const master = fanfareGain.output;
  assert.equal(media, FakeAudio.last);
  assert.equal(FakeAudio.last.volume, 1);
  assert.equal(fanfareGain.gain.value, .75);
  assert.equal(master.output, context.destination);
  assert.equal(FakeAudio.last.currentTime, 0);
  assert.equal(FakeAudio.last.playCount, 1);
});

test('SFX volume applies to mission cues and an already playing fanfare', () => {
  const sound = createMissionSound(FakeAudioContext, FakeAudio);
  sound.setVolume(.4);
  sound.playCall();
  sound.playMissionComplete();
  const context = FakeAudioContext.last;
  const master = context.mediaSource.output.output;
  assert.equal(master.gain.value, .4);
  assert.ok(context.gains.slice(1).every(node => node.output === master));
  sound.setVolume(0);
  assert.equal(master.gain.value, 0);
  assert.equal(FakeAudio.last.playCount, 1);
});

test('fanfare respects SFX volume in the media-only fallback', () => {
  const sound = createMissionSound(null, FakeAudio);
  sound.setVolume(.4);
  sound.playMissionComplete();
  assert.equal(FakeAudio.last.volume, .75 * .4);
});
