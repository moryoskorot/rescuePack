import { windowFireStrength } from './building-fire.js';

// The sheet keeps its crisp GLB stills and draws moving particles between
// each model image and the red window-ID overlay.
function flameSprite(hue) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(48, 48, 5, 48, 48, 47);
  glow.addColorStop(0, `rgba(255,${hue},9,.45)`);
  glow.addColorStop(.48, `rgba(255,${hue},5,.2)`);
  glow.addColorStop(1, 'rgba(255,86,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 96, 96);
  ctx.shadowColor = '#ff8a00';
  ctx.shadowBlur = 9;
  ctx.fillStyle = `rgb(255,${hue},7)`;
  ctx.fillRect(28, 28, 40, 40);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,220,55,.5)';
  ctx.fillRect(36, 38, 21, 21);
  return canvas;
}

function smokeSprite(variation) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const lobes = variation ? [[39, 47, 31], [57, 45, 27], [48, 34, 28]]
    : [[42, 46, 30], [56, 51, 29], [47, 35, 27]];
  for (const [x, y, radius] of lobes) {
    const grad = ctx.createRadialGradient(x, y, radius * .08, x, y, radius);
    grad.addColorStop(0, 'rgba(49,53,56,.39)');
    grad.addColorStop(.48, 'rgba(66,70,72,.31)');
    grad.addColorStop(1, 'rgba(91,95,96,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

export function createBuildingFirePreview(views) {
  let percent = 0, frameId = 0, previous = 0;
  const flames = [flameSprite(91), flameSprite(130), flameSprite(172)];
  const smokes = [smokeSprite(0), smokeSprite(1)];
  for (const view of views) {
    view.context = view.canvas.getContext('2d');
    view.particles = [];
    view.anchors = view.anchors.map(anchor => ({ ...anchor, flameCarry: Math.random(), smokeCarry: Math.random() }));
  }

  function spawn(view, anchor, kind, strength) {
    if (view.particles.length >= 480) return;
    const flame = kind === 'flame';
    const random = Math.random;
    const scale = Math.max(.55, Math.min(2.5, Math.sqrt(anchor.width * anchor.height) / 18));
    const ember = flame && random() < .16;
    const life = flame ? [.0, .4, .7, 1.05][strength] + random() * [.0, .28, .46, .65][strength]
      : 1.4 + random() * (strength === 3 ? 1.55 : 1.0);
    const size = (flame ? (5.5 + strength * 2.7) * (ember ? .37 : 1) : 15 + strength * 3.5)
      * scale * (.73 + random() * .53);
    view.particles.push({
      kind, age: 0, life, size, baseSize: size, ember,
      x: anchor.x + (random() - .5) * anchor.width * (flame ? .56 : .75),
      y: anchor.y + (random() - .5) * anchor.height * .32 - (flame ? 0 : anchor.height * .23),
      vx: (random() - .5) * (flame ? 12 : 20),
      vy: -(flame ? (ember ? 36 : 23) + strength * 8 : 12) * (.7 + random() * .6),
      rotation: (random() - .5) * .85, spin: (random() - .5) * 1.2,
      sprite: flame ? Math.floor(random() * flames.length) : Math.floor(random() * smokes.length),
    });
  }

  function draw(view, dt) {
    const { canvas, context, anchors, particles } = view;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const bounds = canvas.getBoundingClientRect();
    if (bounds.bottom < -100 || bounds.top > innerHeight + 100) {
      particles.length = 0;
      return;
    }
    let spawned = 0;
    for (const anchor of anchors) {
      const strength = windowFireStrength(percent, anchor.third);
      if (strength < 0) continue;
      const sizeFactor = Math.max(.5, Math.min(2.5, Math.sqrt(anchor.width * anchor.height) / 20));
      anchor.flameCarry += [0, 4.5, 6.8, 10.2][strength] * sizeFactor * dt;
      anchor.smokeCarry += [2.8, 1.7, 3.1, 5.2][strength] * sizeFactor * dt;
      while (anchor.flameCarry >= 1 && spawned < 110) {
        spawn(view, anchor, 'flame', strength); anchor.flameCarry--; spawned++;
      }
      while (anchor.smokeCarry >= 1 && spawned < 110) {
        spawn(view, anchor, 'smoke', strength); anchor.smokeCarry--; spawned++;
      }
      anchor.flameCarry = Math.min(anchor.flameCarry, 2);
      anchor.smokeCarry = Math.min(anchor.smokeCarry, 2);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.age += dt;
      if (particle.age >= particle.life) {
        if (particle.kind === 'flame' && !particle.ember && Math.random() < .55 && particles.length < 480) {
          particles.push({ ...particle, kind: 'smoke', age: 0,
            life: 1.4 + Math.random() * 1.2, vy: particle.vy * .45,
            size: particle.baseSize * 1.8, baseSize: particle.baseSize * 1.8,
            sprite: Math.floor(Math.random() * smokes.length) });
        }
        particles.splice(i, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.spin * dt;
    }
    // Smoke sits behind the hotter, sharper flame blocks.
    for (const kind of ['smoke', 'flame']) for (const particle of particles) {
      if (particle.kind !== kind) continue;
      const progress = particle.age / particle.life;
      const size = particle.baseSize * (kind === 'smoke' ? 1 + progress * 1.1
        : 1 - progress * (particle.ember ? .48 : .6));
      const fade = 1 - progress;
      context.globalAlpha = kind === 'smoke' ? Math.min(1, particle.age * 2.2) * Math.min(1, fade * 1.7) * .8
        : Math.min(1, fade * 2) * (particle.ember ? .82 : .98);
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      const sprite = kind === 'smoke' ? smokes[particle.sprite] : flames[particle.sprite];
      const extent = kind === 'smoke' ? size : size * 2.4;
      context.drawImage(sprite, -extent / 2, -extent / 2, extent, extent);
      context.restore();
    }
    context.globalAlpha = 1;
  }

  function frame(now) {
    if (percent === 0) { frameId = 0; return; }
    const dt = Math.min((now - previous) / 1000, .05);
    previous = now;
    for (const view of views) draw(view, dt);
    frameId = requestAnimationFrame(frame);
  }

  return {
    setPercent(value) {
      percent = Math.max(0, Math.min(100, Number(value) || 0));
      if (percent > 0 && !frameId) {
        previous = performance.now();
        frameId = requestAnimationFrame(frame);
      } else if (percent === 0) {
        cancelAnimationFrame(frameId);
        frameId = 0;
        for (const view of views) {
          view.particles.length = 0;
          view.context.clearRect(0, 0, view.canvas.width, view.canvas.height);
        }
      }
    },
    stop() {
      percent = 0;
      cancelAnimationFrame(frameId);
      frameId = 0;
    },
  };
}
