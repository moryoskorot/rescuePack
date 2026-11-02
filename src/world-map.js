import {
  BOARDWALK_BOUNDS, LAND_BOUNDS, PIER_BOUNDS, ROAD_CURVES, ROAD_ROUND_ENDS,
  ROAD_HALF_WIDTH, SIDEWALK_OUTER, createRoadSurfaceRects,
} from './world-layout.js';
import { BUILDING_SITES, CIVIC_ENVELOPES, NEIGHBORHOOD_PARKS, SUBURBAN_MODEL_FOOTPRINTS } from './city-plan.js';
import { NEW_DISTRICTS, districtAt } from './districts.js';

const MAP_BOUNDS = Object.freeze({
  minX: LAND_BOUNDS.minX, maxX: LAND_BOUNDS.maxX,
  minZ: LAND_BOUNDS.minZ, maxZ: PIER_BOUNDS.maxZ,
});

// All permanent features come from the same data that builds the 3D world.
export function worldMapFeatures() {
  const districtCenters = new Map();
  for (let z = LAND_BOUNDS.minZ + 12; z < LAND_BOUNDS.maxZ; z += 18) {
    for (let x = LAND_BOUNDS.minX + 12; x < LAND_BOUNDS.maxX; x += 18) {
      const name = districtAt({ x, z });
      if (!name) continue;
      const center = districtCenters.get(name) ?? { name, x: 0, z: 0, count: 0 };
      center.x += x; center.z += z; center.count++;
      districtCenters.set(name, center);
    }
  }
  for (const district of NEW_DISTRICTS) districtCenters.set(district.name, {
    name: district.name, x: district.center[0], z: district.center[1], count: 1,
  });
  return {
    bounds: MAP_BOUNDS,
    roads: createRoadSurfaceRects(),
    roadCurves: ROAD_CURVES,
    roadRoundEnds: ROAD_ROUND_ENDS,
    buildings: BUILDING_SITES,
    civic: CIVIC_ENVELOPES,
    parks: NEIGHBORHOOD_PARKS,
    districts: [...districtCenters.values()].map(center => ({
      name: center.name, x: center.x / center.count, z: center.z / center.count,
    })),
    boardwalk: BOARDWALK_BOUNDS,
    pier: PIER_BOUNDS,
  };
}

export function mapFrame(bounds, width, height, padding = 18) {
  const scale = Math.min((width - padding * 2) / (bounds.maxX - bounds.minX),
    (height - padding * 2) / (bounds.maxZ - bounds.minZ));
  return {
    scale,
    left: (width - (bounds.maxX - bounds.minX) * scale) / 2,
    top: (height - (bounds.maxZ - bounds.minZ) * scale) / 2,
  };
}

export function worldToMap({ x, z }, bounds, frame) {
  return { x: frame.left + (x - bounds.minX) * frame.scale,
    y: frame.top + (z - bounds.minZ) * frame.scale };
}

export function createWorldMap(canvas) {
  const features = worldMapFeatures();
  const context = canvas.getContext('2d');
  function drawRectangle(rect, frame, color) {
    const start = worldToMap({ x: rect.minX, z: rect.minZ }, features.bounds, frame);
    context.fillStyle = color;
    context.fillRect(start.x, start.y, (rect.maxX - rect.minX) * frame.scale,
      (rect.maxZ - rect.minZ) * frame.scale);
  }
  function dot(point, frame, color, radius, stroke = '#fff') {
    const p = worldToMap(point, features.bounds, frame);
    context.beginPath(); context.arc(p.x, p.y, radius, 0, Math.PI * 2);
    context.fillStyle = color; context.fill();
    context.lineWidth = 2; context.strokeStyle = stroke; context.stroke();
  }
  function curvedRoad(frame, width, color) {
    context.strokeStyle=color; context.lineWidth=width*2*frame.scale;
    context.lineCap='butt';
    for (const curve of features.roadCurves) {
      const center=worldToMap(curve,features.bounds,frame);
      context.beginPath(); context.arc(center.x,center.y,curve.radius*frame.scale,curve.start,curve.end);
      context.stroke();
    }
    for (const end of features.roadRoundEnds) {
      const center=worldToMap(end,features.bounds,frame);
      context.beginPath(); context.arc(center.x,center.y,(end.radius+width-ROAD_HALF_WIDTH)*frame.scale,0,Math.PI*2);
      context.fillStyle=color; context.fill();
    }
  }
  function draw({ player, fires = [], mission = null, elapsed = 0 }) {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth; canvas.height = pixelHeight;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#7ac5db'; context.fillRect(0, 0, width, height);
    const frame = mapFrame(features.bounds, width, height);
    drawRectangle(LAND_BOUNDS, frame, '#a8d49a');
    drawRectangle({ ...LAND_BOUNDS, minZ: 82 }, frame, '#eddbad');
    drawRectangle(features.boardwalk, frame, '#bb8455');
    drawRectangle(features.pier, frame, '#bb8455');
    for (const park of features.parks) {
      const center = worldToMap(park, features.bounds, frame);
      context.beginPath(); context.arc(center.x, center.y, park.radius * frame.scale, 0, Math.PI * 2);
      context.fillStyle = '#75bc77'; context.fill();
    }
    for (const road of features.roads.filter(road => road.kind !== 'road')) {
      drawRectangle(road, frame, road.kind === 'driveway' ? '#b5b9bc' : '#e4ded1');
    }
    curvedRoad(frame,SIDEWALK_OUTER,'#e4ded1');
    for (const road of features.roads.filter(road => road.kind === 'road')) drawRectangle(road, frame, '#708493');
    curvedRoad(frame,ROAD_HALF_WIDTH,'#708493');
    for (const site of features.buildings) {
      const color = site.questName ? '#f7d170' : site.pack === 'suburban' ? '#f5e5bd'
        : site.pack === 'industrial' ? '#9fabb5' : site.pack === 'civic' ? '#acd9e8' : '#e6a88c';
      if (site.pack === 'suburban' && Math.abs(Math.sin(site.rotation)) > .1) {
        const [sourceWidth,sourceDepth]=SUBURBAN_MODEL_FOOTPRINTS[site.name.at(-1)];
        const center=worldToMap(site,features.bounds,frame);
        context.save(); context.translate(center.x,center.y); context.rotate(-site.rotation);
        context.fillStyle=color;
        context.fillRect(-sourceWidth*site.scale*frame.scale/2,-sourceDepth*site.scale*frame.scale/2,
          sourceWidth*site.scale*frame.scale,sourceDepth*site.scale*frame.scale);
        context.restore();
      } else drawRectangle({ minX: site.x - site.width / 2, maxX: site.x + site.width / 2,
        minZ: site.z - site.depth / 2, maxZ: site.z + site.depth / 2 }, frame, color);
    }
    for (const site of features.civic) drawRectangle({ minX: site.x - site.width / 2,
      maxX: site.x + site.width / 2, minZ: site.z - site.depth / 2,
      maxZ: site.z + site.depth / 2 }, frame, '#acd9e8');
    context.textAlign = 'center'; context.textBaseline = 'middle';
    for (const district of features.districts) {
      const p = worldToMap(district, features.bounds, frame);
      context.font = `800 ${Math.max(8, Math.min(11, frame.scale * 10))}px Nunito, Arial, sans-serif`;
      context.lineWidth = 3; context.strokeStyle = '#f6f8d9d9';
      const words = district.name.toUpperCase().split(' ');
      const lines = district.name.length > 10 && words.length > 1 ? words : [words.join(' ')];
      lines.forEach((line, index) => {
        const y = p.y + (index - (lines.length - 1) / 2) * 10;
        context.strokeText(line, p.x, y, 75);
        context.fillStyle = '#245366'; context.fillText(line, p.x, y, 75);
      });
    }
    if (mission) {
      dot(mission, frame, '#ffd044', 7, '#473a1e');
      const p = worldToMap(mission, features.bounds, frame);
      context.font = 'bold 12px Arial'; context.fillStyle = '#302d27';
      context.fillText('★', p.x, p.y + .5);
    }
    for (const fire of fires) {
      dot(fire, frame, '#ed513b', 5.5 + .8 * Math.sin(elapsed * 5), '#fff0c2');
      const p = worldToMap(fire, features.bounds, frame);
      context.font = '11px Arial'; context.fillText('🔥', p.x, p.y - 10);
    }
    if (player) {
      const p = worldToMap(player, features.bounds, frame);
      context.save(); context.translate(p.x, p.y); context.rotate(Math.PI - player.heading);
      context.beginPath(); context.moveTo(0, -11); context.lineTo(-8, 8); context.lineTo(0, 4);
      context.lineTo(8, 8); context.closePath();
      context.fillStyle = '#1366d8'; context.fill();
      context.lineWidth = 2.5; context.strokeStyle = '#fff'; context.stroke();
      context.restore();
    }
  }
  return { draw, features };
}
