import test from 'node:test';
import assert from 'node:assert/strict';
import library from '../docs/rescue-pack-missions.json' with { type: 'json' };
import { dialogueBeats } from '../src/mission-dialogue.js';

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

test('start calls answer the requester and keep the closing exchange', () => {
  const mission = library.missions.find(item => item.id === 'hawk_01');
  const beats = dialogueBeats(mission, 'start');
  assert.equal(beats.length, 2);
  assert.equal(beats[0].speaker, 'Hawk');
  assert.match(beats[0].reply, /hang tight/i);
  assert.equal(beats[1].text, 'Thank you, Rescue Pack!');
});
