import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import library from '../docs/rescue-pack-missions.json' with { type: 'json' };
import { dialogueBeats } from '../src/mission-dialogue.js';

test('every mission dialogue sprite points to an existing image', () => {
  for (const mission of library.missions) {
    for (const phase of ['start', 'success', 'failure']) {
      for (const line of mission.dialogue[phase]) {
        const sprites = [line.sprite, ...Object.values(line.sprite_by_playable_character_id ?? {})];
        for (const sprite of sprites.filter(Boolean)) {
          assert.ok(existsSync(new URL(`../${sprite}`, import.meta.url)), `${mission.id} ${phase}: missing ${sprite}`);
        }
      }
    }
  }
});

test('every mission has portrait dialogue with a Bunny reply in each phase', () => {
  for (const mission of library.missions) {
    for (const phase of ['start', 'success', 'failure']) {
      const beats = dialogueBeats(mission, phase);
      assert.ok(beats.length > 0, `${mission.id} ${phase} is empty`);
      for (const beat of beats) {
        assert.notEqual(beat.speaker, 'Dispatcher', `${mission.id} ${phase} shows dispatcher`);
        assert.ok(beat.sprite?.startsWith('visuals/processed/'), `${mission.id} ${phase} has no portrait`);
        assert.ok(beat.text && beat.reply, `${mission.id} ${phase} needs a message and reply`);
      }
    }
  }
});

test('start calls end with Bunny accepting the job, before any thank-you', () => {
  for (const mission of library.missions) {
    assert.equal(mission.dialogue.start.length, 1, `${mission.id} has extra start lines`);
    const beats = dialogueBeats(mission, 'start');
    assert.equal(beats.length, 1, `${mission.id} has extra start beats`);
    assert.doesNotMatch(beats[0].text, /thank|no problem/i, `${mission.id} thanks before completion`);
  }
  const mission = library.missions.find(item => item.id === 'hawk_01');
  const beats = dialogueBeats(mission, 'start');
  assert.equal(beats[0].speaker, 'Hawk');
  assert.match(beats[0].reply, /hang tight/i);
});
