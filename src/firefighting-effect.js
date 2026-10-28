// Projectiles leave stationary, fading strands. Both meshes live at the world
// scene root, while small droplets fall away under gravity.
export function createFirefightingEffect(THREE, scene) {
  const MAX_LINES = 900, MAX_POINTS = 700;
  const linePositions = new Float32Array(MAX_LINES * 18);
  const lineAlphas = new Float32Array(MAX_LINES * 6);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeometry.setAttribute('alpha', new THREE.BufferAttribute(lineAlphas, 1).setUsage(THREE.DynamicDrawUsage));
  lineGeometry.setDrawRange(0, 0);
  const lineMaterial = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color('#49c9ff') } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'attribute float alpha; varying float vAlpha; void main(){vAlpha=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 color; varying float vAlpha; void main(){gl_FragColor=vec4(color,vAlpha);}',
  });
  const lines = new THREE.Mesh(lineGeometry, lineMaterial);
  lines.frustumCulled = false; lines.renderOrder = 8; scene.add(lines);

  const positions = new Float32Array(MAX_POINTS * 3), sizes = new Float32Array(MAX_POINTS), alphas = new Float32Array(MAX_POINTS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color('#49c9ff') }, projectionScale: { value: 700 } },
    transparent: true, depthWrite: false,
    vertexShader: 'attribute float size; attribute float alpha; uniform float projectionScale; varying float vAlpha; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*projectionScale/max(1.0,-p.z),1.0,80.0);vAlpha=alpha;}',
    fragmentShader: 'uniform vec3 color; varying float vAlpha; void main(){float d=length(gl_PointCoord-vec2(.5));float a=1.0-smoothstep(.34,.5,d);gl_FragColor=vec4(color,vAlpha*a);}',
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; points.renderOrder = 9; scene.add(points);

  let traces = [], droplets = [], lastPositions = new WeakMap(), sampleCounts = new WeakMap();
  function spawnDrop(position, config) {
    const angle = Math.random() * Math.PI * 2;
    const speed = config.trailSpeed * (.35 + Math.random() * .65);
    const spread = config.trailSpread * Math.random();
    droplets.push({ position: position.clone(), velocity: new THREE.Vector3(
      Math.cos(angle) * speed * spread, (Math.random() - .25) * speed,
      Math.sin(angle) * speed * spread), age: 0, lifetime: .3 + Math.random() * .5 });
  }
  function putPoint(index, point, size, opacity) {
    const i = index * 3;
    positions[i] = point.x; positions[i+1] = point.y; positions[i+2] = point.z;
    sizes[index] = size; alphas[index] = opacity;
  }
  return {
    update(shots, dt, config, camera, impacts = []) {
      const duration = config.streamTrailDuration;
      lineMaterial.uniforms.color.value.set(config.waterColor);
      material.uniforms.color.value.set(config.waterColor);
      if (camera) material.uniforms.projectionScale.value = (globalThis.innerHeight || 800) * Math.min(globalThis.devicePixelRatio || 1, 2)
        / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      for (const shot of shots) {
        const previous = lastPositions.get(shot);
        if (previous && duration > 0 && previous.distanceToSquared(shot.position) > .001) {
          traces.push({ a: previous, b: shot.position.clone(), age: 0 });
          const count = (sampleCounts.get(shot) ?? 0) + 1;
          sampleCounts.set(shot, count);
          if (config.trailAmount && !config.lastParticleOnly && count % Math.max(1, Math.round(40 / config.trailAmount)) === 0) {
            for (let n = 0; n < Math.max(1, Math.round(config.trailAmount / 6)); n++) spawnDrop(shot.position, config);
          }
        }
        lastPositions.set(shot, shot.position.clone());
      }
      for (const impact of impacts) for (let i = 0; i < Math.min(18, config.trailAmount + 4); i++) spawnDrop(impact, config);
      traces = traces.filter(trace => (trace.age += dt) < duration).slice(-MAX_LINES);
      let lineCount = 0;
      for (const trace of traces) {
        const i = lineCount * 18, j = lineCount * 6;
        const sideways=trace.b.clone().sub(trace.a).cross(camera.position.clone().sub(trace.a)).normalize().multiplyScalar(config.projectileSize*.5);
        const a1=trace.a.clone().add(sideways),a2=trace.a.clone().sub(sideways);
        const b1=trace.b.clone().add(sideways),b2=trace.b.clone().sub(sideways);
        linePositions.set([a1.x,a1.y,a1.z,a2.x,a2.y,a2.z,b1.x,b1.y,b1.z,
          b1.x,b1.y,b1.z,a2.x,a2.y,a2.z,b2.x,b2.y,b2.z],i);
        const opacity = .62 * (1 - trace.age / Math.max(duration,.001));
        lineAlphas.fill(opacity,j,j+6);
        lineCount++;
      }
      lineGeometry.setDrawRange(0,lineCount*6);
      lineGeometry.attributes.position.needsUpdate=true;lineGeometry.attributes.alpha.needsUpdate=true;
      droplets = droplets.filter(drop => {
        drop.age += dt;
        drop.velocity.y -= config.trailGravity * dt;
        drop.position.addScaledVector(drop.velocity,dt);
        return drop.age < drop.lifetime && drop.position.y > -.2;
      }).slice(-MAX_POINTS + 30);
      let pointCount = 0;
      for (const shot of shots) {
        if (pointCount >= MAX_POINTS) break;
        putPoint(pointCount++,shot.position,config.projectileSize,1);
      }
      for (const drop of droplets) {
        if (pointCount >= MAX_POINTS) break;
        putPoint(pointCount++,drop.position,config.projectileSize * .23,(1-drop.age/drop.lifetime)*.85);
      }
      geometry.setDrawRange(0,pointCount);
      for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate=true;
    },
    reset() { traces=[];droplets=[];lastPositions=new WeakMap();sampleCounts=new WeakMap();lineGeometry.setDrawRange(0,0);geometry.setDrawRange(0,0); },
  };
}
