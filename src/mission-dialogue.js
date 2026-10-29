const firstReplies = {
  fire: "Hang tight! I'll put it out!",
  fix: "Hang tight! I'll fix it!",
  rescue: "I'm on my way!",
  collect: "I'll find them and bring them back!",
  race: "Ready! Let's go!",
};

// The mission document includes dispatcher directions for the original phone
// layout. In a face-to-face call, the objective and map carry those directions
// while Bunny answers the person who called.
export function dialogueBeats(mission, phase) {
  const lines = mission.dialogue[phase] ?? [];
  const callerLines = lines.filter(line => line.speaker !== 'Dispatcher' && line.speaker !== 'Player');
  const fallbackSprite = mission.dialogue.start.find(line => line.sprite)?.sprite;
  const playableReply = lines.find(line => line.speaker === 'Player')?.text;

  if (phase === 'start') {
    return callerLines.slice(0, 1).map(line => ({
      ...line,
      reply: firstReplies[mission.type] ?? "I'm on my way!",
    }));
  }

  const caller = callerLines.at(-1) ?? {
    speaker: mission.character_id === 'cheetah' ? 'Granny Cheetah' :
      mission.character_id[0].toUpperCase() + mission.character_id.slice(1),
    text: lines.find(line => line.speaker === 'Dispatcher')?.text ?? 'Thanks for helping!',
    sprite: fallbackSprite,
  };
  return [{
    ...caller,
    sprite: caller.sprite ?? fallbackSprite,
    reply: playableReply ?? (phase === 'success' ? 'Happy to help!' : "We'll try again together!"),
  }];
}
