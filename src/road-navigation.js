import { AVENUE_SEGMENTS, ROAD_CURVES, SIDEWALK_OUTER, STREET_SEGMENTS } from './world-layout.js';

const TAU = Math.PI * 2;
const EPSILON = 1e-6;
const spacing = 5;
const lookAhead = 60;
const fadeTime = .4;
const passClearance = .5;
// A truck can straddle the curb while still following the street.
const trackingWidth = SIDEWALK_OUTER + 1.5;
const markerAlignment = .2;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

function straight(a, b) {
  const length = distance(a, b);
  const dx = (b.x - a.x) / length;
  const dz = (b.z - a.z) / length;
  return {
    length, pointAt: metre => ({ x: a.x + dx * metre, z: a.z + dz * metre, dx, dz }),
    project: point => (point.x - a.x) * dx + (point.z - a.z) * dz,
  };
}

function circular({ x, z, radius, start, end }) {
  const middle = (start + end) / 2;
  return {
    length: (end - start) * radius,
    pointAt(metre) {
      const angle = start + metre / radius;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      return { x: x + radius * cos, z: z + radius * sin, dx: -sin, dz: cos };
    },
    project(point) {
      const delta = Math.atan2(point.z - z, point.x - x) - middle;
      const wrapped = delta - Math.round(delta / TAU) * TAU;
      return (middle + wrapped - start) * radius;
    },
  };
}

function roadGraph() {
  const nodes = new Map();
  const edges = [];
  function nodeAt({ x, z }) {
    // Arc endpoints and their straight tangents coincide to floating-point precision.
    const id = `${x.toFixed(5)},${z.toFixed(5)}`.replaceAll('-0.00000', '0.00000');
    if (!nodes.has(id)) nodes.set(id, { edges: [] });
    return nodes.get(id);
  }
  function addEdge(shape, kind) {
    const a = nodeAt(shape.pointAt(0)), b = nodeAt(shape.pointAt(shape.length));
    const edge = { ...shape, kind, a, b };
    edges.push(edge);
    a.edges.push(edge);
    b.edges.push(edge);
  }
  function addLine(cuts, pointAt) {
    const sorted = [...new Set(cuts)].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      addEdge(straight(pointAt(sorted[i - 1]), pointAt(sorted[i])), 'straight');
    }
  }
  for (const { x, minZ, maxZ } of AVENUE_SEGMENTS) {
    const crosses = STREET_SEGMENTS.filter(road => road.minX <= x && x <= road.maxX
      && minZ <= road.z && road.z <= maxZ);
    addLine([minZ, ...crosses.map(road => road.z), maxZ], z => ({ x, z }));
  }
  for (const { z, minX, maxX } of STREET_SEGMENTS) {
    const crosses = AVENUE_SEGMENTS.filter(road => road.minZ <= z && z <= road.maxZ
      && minX <= road.x && road.x <= maxX);
    addLine([minX, ...crosses.map(road => road.x), maxX], x => ({ x, z }));
  }
  for (const curve of ROAD_CURVES) addEdge(circular(curve), 'curve');
  return { nodes: [...nodes.values()], edges };
}

const graph = roadGraph();

function roadApproaches(point) {
  let closest = Infinity;
  const choices = graph.edges.map(edge => {
    const metre = clamp(edge.project(point), 0, edge.length);
    const offset = distance(point, edge.pointAt(metre));
    closest = Math.min(closest, offset);
    return { edge, metre, offset };
  });
  // At a junction or between two frontages, let route length break near ties.
  return choices.filter(choice => choice.offset < closest + .25);
}

function roadPaths(starts) {
  const paths = new Map();
  const pending = new Set(graph.nodes);
  function relax(node, length, previous, edge, from, to) {
    if (length < (paths.get(node)?.length ?? Infinity)) {
      paths.set(node, { length, previous, edge, from, to });
    }
  }
  for (const { edge, metre, offset } of starts) {
    relax(edge.a, offset + metre, null, edge, metre, 0);
    relax(edge.b, offset + edge.length - metre, null, edge, metre, edge.length);
  }
  while (pending.size) {
    let next, shortest = Infinity;
    for (const node of pending) {
      const length = paths.get(node)?.length ?? Infinity;
      if (length < shortest) { next = node; shortest = length; }
    }
    if (!next) break;
    pending.delete(next);
    const previous = paths.get(next);
    for (const edge of next.edges) {
      const forward = next === edge.a;
      relax(forward ? edge.b : edge.a, shortest + edge.length, previous, edge,
        forward ? 0 : edge.length, forward ? edge.length : 0);
    }
  }
  return paths;
}

function routePieces(end) {
  const pieces = [];
  for (let leg = end; leg; leg = leg.previous) {
    const { edge, from, to } = leg;
    if (Math.abs(to - from) > EPSILON) pieces.push({ edge, from, to });
  }
  pieces.reverse();
  const rounded = [];
  for (let i = 0; i < pieces.length - 1; i++) {
    const entry = pieces[i], exit = pieces[i + 1];
    if (entry.edge.kind !== 'straight' || exit.edge.kind !== 'straight') continue;
    const a = entry.edge.pointAt(entry.to), b = exit.edge.pointAt(exit.from);
    if (Math.abs(a.dx * b.dx + a.dz * b.dz) > .01) continue;
    const cut = Math.min(4, Math.abs(entry.to - entry.from) / 2, Math.abs(exit.to - exit.from) / 2);
    entry.to -= cut * Math.sign(entry.to - entry.from);
    exit.from += cut * Math.sign(exit.to - exit.from);
    // A quadratic fillet stays in the intersection and joins both legs tangentially.
    const start = entry.edge.pointAt(entry.to), finish = exit.edge.pointAt(exit.from);
    let last = start;
    rounded[i] = Array.from({ length: 12 }, (_, index) => {
      const t = (index + 1) / 12;
      const next = lerp(lerp(start, a, t), lerp(a, finish, t), t);
      const edge = straight(last, next);
      last = next;
      return { edge, from: 0, to: edge.length };
    });
  }
  let length = 0;
  const sections = pieces.flatMap((piece, i) => [piece, ...(rounded[i] ?? [])]).map(piece => {
    const size = Math.abs(piece.to - piece.from);
    const section = { ...piece, start: length, end: length + size, direction: Math.sign(piece.to - piece.from) };
    length += size;
    return section;
  });
  return { length, sections };
}

export function findRoadRoute(position, objectives) {
  if (!objectives.length) return null;
  const starts = roadApproaches(position);
  const paths = roadPaths(starts);
  let best;
  function consider(objective, approach, from, previous, length) {
    if (length < (best?.length ?? Infinity)) {
      best = { objective, length, edge: approach.edge, from, to: approach.metre, previous };
    }
  }
  for (const objective of objectives) {
    for (const approach of roadApproaches(objective)) {
      const { edge, metre, offset } = approach;
      for (const start of starts) {
        if (start.edge === edge) {
          consider(objective, approach, start.metre, null, start.offset + Math.abs(start.metre - metre) + offset);
        }
      }
      const a = paths.get(edge.a), b = paths.get(edge.b);
      if (a) consider(objective, approach, 0, a, a.length + metre + offset);
      if (b) consider(objective, approach, edge.length, b, b.length + edge.length - metre + offset);
    }
  }
  if (!best) return null;
  const { length, sections } = routePieces(best);
  return {
    length,
    objective: best.objective,
    endpoint: best.edge.pointAt(best.to),
    pointAt(metre) {
      if (!sections.length) return this.endpoint;
      const s = clamp(metre, 0, length);
      const section = sections.find(section => s <= section.end) ?? sections.at(-1);
      const point = section.edge.pointAt(section.from + (s - section.start) * section.direction);
      return { ...point, dx: point.dx * section.direction, dz: point.dz * section.direction };
    },
    project(point, min = 0, max = length) {
      let nearest = { metre: 0, offset: distance(point, this.endpoint) };
      if (sections.length) nearest.offset = Infinity;
      for (const section of sections) {
        if (section.end < min) continue;
        if (section.start > max) break;
        const projected = section.start + (section.edge.project(point) - section.from) * section.direction;
        const metre = clamp(projected, Math.max(min, section.start), Math.min(max, section.end));
        const offset = distance(point, section.edge.pointAt(section.from + (metre - section.start) * section.direction));
        if (offset < nearest.offset) nearest = { metre, offset };
      }
      return nearest;
    },
  };
}

export function navigationObjectives(mission, progress, activeFireIds, burning, fireSitesById) {
  if (!mission || progress.stage === 'complete') return [];
  if (mission.type === 'fire') {
    return [...activeFireIds].flatMap(id => {
      const site = burning.has(id) && fireSitesById.get(id);
      return site ? [{ id, x: site.x, z: site.z, color: 'red' }] : [];
    });
  }
  const blue = (point, key) => point ? [{ ...point, id: `${mission.id}:${key}`, color: 'blue' }] : [];
  if (mission.type === 'collect' && progress.stage === 'collecting') {
    const collected = progress.collected;
    return mission.pickups.flatMap((point, index) => collected.has(index) ? [] : blue(point, index));
  }
  if (mission.type === 'race') return blue(mission.route[progress.checkpoint], progress.checkpoint);
  return blue(mission.target, 'destination');
}

export function createRoadNavigation() {
  let route, objectiveKey, markers, retiring, firstMarker, nextMarker, positionAtPlan, previousPosition;
  let projected, progress, offRouteTime;
  function clear() {
    route = null;
    objectiveKey = '';
    markers = [];
    retiring = [];
  }

  function addVisibleMarkers(fadeIn = false, reusable) {
    if (!route || route.length < 3) return;
    const last = Math.min(progress + lookAhead, route.length - 1.5 + EPSILON);
    for (let metre = firstMarker + spacing * nextMarker; metre <= last; metre = firstMarker + spacing * ++nextMarker) {
      if (metre + passClearance <= progress) continue;
      const marker = reusable?.get(nextMarker) ?? {
        ...route.pointAt(metre), color: route.objective.color, opacity: fadeIn ? 0 : 1, fading: false,
      };
      marker.metre = metre;
      markers.push(marker);
    }
  }

  function plan(position, objectives, key) {
    const previous = markers;
    const rerouting = Boolean(route);
    route = findRoadRoute(position, objectives);
    objectiveKey = key;
    markers = [];
    projected = progress = offRouteTime = 0;
    positionAtPlan = previousPosition = position;
    firstMarker = route ? Math.min(4, route.length - 1.5) : 0;
    nextMarker = 0;

    // Use the old spacing on a shared stretch so its chevrons stay where they were.
    const reusable = new Map();
    if (rerouting && route?.length >= 3) {
      for (const marker of previous) {
        if (marker.fading || marker.color !== route.objective.color) continue;
        const { metre, offset } = route.project(marker);
        if (offset > markerAlignment || metre < 2 || metre > route.length - 1.5) continue;
        const { dx, dz } = route.pointAt(metre);
        if (dx * marker.dx + dz * marker.dz < .995) continue;
        if (!reusable.size) firstMarker = 2 + (metre - 2) % spacing;
        const index = Math.round((metre - firstMarker) / spacing);
        if (index >= 0 && Math.abs(firstMarker + index * spacing - metre) <= markerAlignment) {
          reusable.set(index, marker);
        }
      }
    }
    addVisibleMarkers(rerouting, reusable);
    const kept = new Set(markers);
    for (const marker of previous) {
      if (!kept.has(marker) && marker.opacity > 0) retiring.push({ ...marker, fading: true });
    }
  }

  clear();
  return {
    clear,
    update(position, objectives, dt) {
      if (!objectives.length) {
        clear();
        return markers;
      }
      const opacityStep = dt / fadeTime;
      for (const marker of retiring) marker.opacity = Math.max(0, marker.opacity - opacityStep);
      retiring = retiring.filter(marker => marker.opacity > 0);

      const key = objectives.map(objective => objective.id).join('|');
      if (key !== objectiveKey) plan(position, objectives, key);
      if (route) {
        // Keep the search local to the truck's last match, with room to cut across a turn.
        const window = distance(position, previousPosition) * 2 + 8;
        previousPosition = position;
        const nearest = route.project(position, Math.max(0, projected - window), Math.min(route.length, projected + window));
        if (nearest.offset <= trackingWidth) {
          projected = nearest.metre;
          progress = Math.max(progress, projected);
        }
        offRouteTime = nearest.offset > trackingWidth || progress - projected > 12 ? offRouteTime + dt : 0;
        for (const marker of markers) {
          if (marker.fading) marker.opacity = Math.max(0, marker.opacity - opacityStep);
          else if (progress >= marker.metre + passClearance) marker.fading = true;
          else marker.opacity = Math.min(1, marker.opacity + opacityStep);
        }
        markers = markers.filter(marker => !marker.fading || marker.opacity > 0);
        if (offRouteTime >= .3 && distance(position, positionAtPlan) >= 5) plan(position, objectives, key);
        else addVisibleMarkers(true);
      }
      return [...retiring, ...markers];
    },
  };
}
