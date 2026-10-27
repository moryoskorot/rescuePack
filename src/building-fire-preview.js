import { windowFireStrength } from './building-fire.js';
import { chimneyFireStrength } from './industrial-chimneys.js';

const WINDOW_FLAME_RATE = [0, 4.5, 6.8, 10.2];
const WINDOW_SMOKE_RATE = [2.8, 1.7, 3.1, 5.2];
const CHIMNEY_FLAME_RATE = [0, 0, 6.8, 0];
const CHIMNEY_SMOKE_RATE = [4.4, 0, 3.2, 0];

// The sheet keeps its crisp GLB stills and draws moving particles between
// each model image and the red window-ID overlay.
function flameSprite(color) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(8, 8, 48, 48);
  return canvas;
}

function smokeSprite(variation) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const lobes = variation ? [[24, 34, 18], [42, 35, 17], [33, 21, 18]]
    : [[22, 29, 18], [41, 32, 19], [31, 43, 15]];
  for (const [x, y, radius] of lobes) {
    ctx.fillStyle = 'rgba(59,63,65,.55)';
    ctx.beginPath();
    for (let side = 0; side < 8; side++) {
      const angle = side * Math.PI / 4;
      const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
      if (side === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  return canvas;
}

export function createBuildingFirePreview(views) {
  let percent = 0, frameId = 0, previous = 0;
  const flames = [flameSprite('#ff8217'), flameSprite('#ffa31c'), flameSprite('#ffc13b')];
  const smokes = [smokeSprite(0), smokeSprite(1)];
  for (const view of views) {
    view.context = view.canvas.getContext('2d');
    view.context.imageSmoothingEnabled = false;
    view.particles = [];
    view.anchors = view.anchors.map(anchor => ({
      ...anchor,
      mass: anchor.chimney ? Math.max(1, Math.min(2.1, anchor.width / 9))
        : Math.max(.6, Math.min(5.5, Math.pow(anchor.width * anchor.height / 430, .7))),
      flameLane: 0, flameCarry: Math.random(), smokeCarry: Math.random(),
    }));
  }

  function spawn(view, anchor, kind, strength) {
    if (view.particles.length >= 480) return;
    const flame = kind === 'flame';
    const random = Math.random;
    const scale = anchor.chimney ? .75 : Math.max(.65, Math.min(1.55, Math.sqrt(anchor.width * anchor.height) / 24));
    const ember = flame && random() < .16;
    const life = flame ? [.0, .4, .7, 1.05][strength] + random() * [.0, .28, .46, .65][strength]
      : 1.4 + random() * (strength === 3 ? 1.55 : 1.0);
    const size = (flame ? (5.5 + strength * 2.7) * (ember ? .37 : 1) : 15 + strength * 3.5)
      * scale * (.73 + random() * .53);
    const lanes = Math.max(1, Math.min(9, Math.ceil(anchor.width / 11)));
    const lane = flame ? anchor.flameLane++ % lanes : 0;
    view.particles.push({
      kind, age: 0, life, size, baseSize: size, ember,
      x: anchor.x + (anchor.chimney ? (random() - .5) * anchor.width * .65
        : flame ? ((lane + .15 + random() * .7) / lanes - .5) * anchor.width * .96
          : (random() - .5) * anchor.width * .96),
      y: anchor.chimney ? anchor.y : anchor.y + (random() - .5) * anchor.height * .78
        - (flame ? 0 : anchor.height * .2),
      vx: (random() - .5) * (flame ? 12 : 20),
      vy: -(flame ? (ember ? 36 : 23) + strength * 8 : anchor.chimney ? 24 : 12) * (.7 + random() * .6),
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
      const strength = anchor.chimney ? chimneyFireStrength(percent) : windowFireStrength(percent, anchor.third);
      if (strength < 0) continue;
      anchor.flameCarry += (anchor.chimney ? CHIMNEY_FLAME_RATE : WINDOW_FLAME_RATE)[strength] * anchor.mass * dt;
      anchor.smokeCarry += (anchor.chimney ? CHIMNEY_SMOKE_RATE : WINDOW_SMOKE_RATE)[strength] * anchor.mass * dt;
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
      const opening = Math.min(1, progress / .18);
      const grow = opening * opening * (3 - 2 * opening);
      const size = particle.baseSize * (kind === 'smoke' ? 1 + progress * 1.1
        : (.3 + .7 * grow) * (1 - progress * (particle.ember ? .48 : .6)));
      const fade = 1 - progress;
      context.globalAlpha = kind === 'smoke' ? Math.min(1, particle.age * 2.2) * Math.min(1, fade * 1.7) * .8
        : grow * Math.min(1, fade * 2) * (particle.ember ? .82 : .98);
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      const sprite = kind === 'smoke' ? smokes[particle.sprite] : flames[particle.sprite];
      const extent = kind === 'smoke' ? size : size * 1.8;
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
