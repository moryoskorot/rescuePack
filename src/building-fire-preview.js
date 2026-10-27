import { windowFireStrength } from './building-fire.js';

// The sheet keeps its crisp GLB stills and draws moving particles in a canvas
// between each model image and the red window-ID overlay.
export function createBuildingFirePreview(views) {
  let percent = 0, frameId = 0, previous = 0;
  for (const view of views) {
    view.context = view.canvas.getContext('2d');
    view.particles = [];
    view.anchors = view.anchors.map(anchor => ({ ...anchor, flameCarry: Math.random(), smokeCarry: Math.random() }));
  }

  function spawn(view, anchor, kind, strength) {
    if (view.particles.length >= 420) return;
    const flame = kind === 'flame';
    const scale = Math.max(.6, Math.min(2.4, Math.sqrt(anchor.width * anchor.height) / 18));
    const life = flame ? [.0, .35, .65, .95][strength] + Math.random() * [.0, .3, .5, .8][strength]
      : 1 + Math.random() * (strength === 3 ? 1.5 : .9);
    view.particles.push({
      kind, age: 0, life,
      x: anchor.x + (Math.random() - .5) * anchor.width * .8,
      y: anchor.y + (Math.random() - .35) * anchor.height * .5,
      vx: (Math.random() - .5) * (flame ? 16 : 24),
      vy: -(flame ? 22 + strength * 9 : 13) * (.7 + Math.random() * .7),
      radius: (flame ? 2.8 + strength * 1.1 : 4.5 + strength * 1.2) * scale * (.7 + Math.random() * .6),
      color: flame ? (Math.random() < .4 ? '255,193,37' : '255,98,18') : '62,68,70',
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
      anchor.flameCarry += [0, 2.3, 4.2, 6.4][strength] * sizeFactor * dt;
      anchor.smokeCarry += [2.4, 1.3, 2.7, 5.2][strength] * sizeFactor * dt;
      while (anchor.flameCarry >= 1 && spawned < 80) {
        spawn(view, anchor, 'flame', strength); anchor.flameCarry--; spawned++;
      }
      while (anchor.smokeCarry >= 1 && spawned < 80) {
        spawn(view, anchor, 'smoke', strength); anchor.smokeCarry--; spawned++;
      }
      anchor.flameCarry = Math.min(anchor.flameCarry, 2);
      anchor.smokeCarry = Math.min(anchor.smokeCarry, 2);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.age += dt;
      if (particle.age >= particle.life) {
        if (particle.kind === 'flame' && particles.length < 420) {
          particles.push({ ...particle, kind: 'smoke', age: 0,
            life: 1.1 + Math.random() * .9, vy: particle.vy * .55,
            radius: particle.radius * 1.3, color: '62,68,70' });
        }
        particles.splice(i, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.kind === 'smoke') particle.radius += dt * 2.6;
      const fade = 1 - particle.age / particle.life;
      const alpha = particle.kind === 'flame' ? fade * .92 : Math.min(1, particle.age * 3) * fade * .55;
      context.fillStyle = `rgba(${particle.color},${alpha})`;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
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
