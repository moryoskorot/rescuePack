import { context, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';

// Browser telemetry is deliberately opt-in: add ?otel=1 when running locally.
// This keeps the public game from attempting requests to a player's localhost.
const OTEL_PARAM = 'otel';
const ENDPOINT_PARAM = 'otelEndpoint';
const DEFAULT_ENDPOINT = 'http://127.0.0.1:4318';

const noOp = Object.freeze({
  enabled: false,
  startMission() {},
  update() {},
  missionProgress() {},
  hoseHit() {},
  collision() {},
  endMission() {},
  flush() { return Promise.resolve(); },
});

function endpoint(path) {
  const configured = new URLSearchParams(location.search).get(ENDPOINT_PARAM) || DEFAULT_ENDPOINT;
  return `${configured.replace(/\/$/, '')}${path}`;
}

export function createGameTelemetry() {
  if (new URLSearchParams(location.search).get(OTEL_PARAM) !== '1') return noOp;

  const resource = resourceFromAttributes({
    'service.name': 'rescue-pack-game',
    'service.version': 'otel-learning',
    'deployment.environment.name': 'local',
  });
  const tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: endpoint('/v1/traces') }))],
  });
  tracerProvider.register();

  const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: endpoint('/v1/metrics') }),
    exportIntervalMillis: 5_000,
  });
  const meterProvider = new MeterProvider({ resource, readers: [metricReader] });

  const loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor(new OTLPLogExporter({ url: endpoint('/v1/logs') }))],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  const tracer = trace.getTracer('rescue-pack-game', '1.0.0');
  const meter = meterProvider.getMeter('rescue-pack-game', '1.0.0');
  const logger = logs.getLogger('rescue-pack-game', '1.0.0');
  const missionStarts = meter.createCounter('game.mission.started', { description: 'Missions started by the player' });
  const missionCompletions = meter.createCounter('game.mission.completed', { description: 'Missions completed by the player' });
  const hoseHits = meter.createCounter('game.hose.hit', { description: 'Water-projectile hits on burning buildings' });
  const collisions = meter.createCounter('game.vehicle.collision', { description: 'Vehicle movement blocked by an obstacle' });
  const speed = meter.createHistogram('game.vehicle.speed', { unit: 'm/s', description: 'Firetruck speed sampled during play' });

  const snapshot = { speed: 0, waterCharge: 100, activeFires: 0, missionProgress: 0 };
  meter.createObservableGauge('game.vehicle.speed.current', { unit: 'm/s' }).addCallback(result => result.observe(snapshot.speed));
  meter.createObservableGauge('game.water.charge', { unit: '%' }).addCallback(result => result.observe(snapshot.waterCharge));
  meter.createObservableGauge('game.fire.active', { unit: '{fire}' }).addCallback(result => result.observe(snapshot.activeFires));
  meter.createObservableGauge('game.mission.progress', { unit: '1' }).addCallback(result => result.observe(snapshot.missionProgress));

  let missionSpan = null;
  let lastSpeedSample = 0;
  let collisionActive = false;
  const log = (severityText, body, attributes = {}) => logger.emit({
    severityText,
    body,
    attributes,
    context: missionSpan ? trace.setSpan(context.active(), missionSpan) : context.active(),
  });

  function startMission(mission) {
    missionSpan?.end();
    missionSpan = tracer.startSpan('game.mission.run', {
      attributes: { 'game.mission.id': mission.id, 'game.mission.type': mission.type, 'game.mission.title': mission.title },
    });
    missionStarts.add(1, { 'game.mission.type': mission.type });
    missionSpan.addEvent('game.mission.started');
    log('INFO', 'Mission started', { 'game.mission.id': mission.id, 'game.mission.type': mission.type });
  }

  return {
    enabled: true,
    startMission,
    update({ vehicleSpeed = 0, waterCharge = 100, activeFires = 0, missionProgress = 0, now = performance.now() }) {
      snapshot.speed = vehicleSpeed;
      snapshot.waterCharge = waterCharge;
      snapshot.activeFires = activeFires;
      snapshot.missionProgress = missionProgress;
      if (now - lastSpeedSample >= 1_000) {
        speed.record(vehicleSpeed);
        lastSpeedSample = now;
      }
    },
    missionProgress({ stage, collectedCount, holdProgress, missionType }) {
      missionSpan?.addEvent('game.mission.progress', {
        'game.mission.stage': stage,
        'game.mission.items_collected': collectedCount,
        'game.mission.hold_progress': holdProgress,
      });
      log('INFO', 'Mission progress changed', { 'game.mission.stage': stage, 'game.mission.type': missionType, 'game.mission.items_collected': collectedCount });
    },
    hoseHit(buildingId, windowId) {
      hoseHits.add(1);
      missionSpan?.addEvent('game.hose.hit', { 'game.fire.building.id': buildingId, 'game.window.id': windowId });
    },
    collision(blocked) {
      if (blocked && !collisionActive) {
        collisions.add(1);
        missionSpan?.addEvent('game.vehicle.collision');
        log('WARN', 'Vehicle blocked by an obstacle');
      }
      collisionActive = blocked;
    },
    endMission(mission, success) {
      if (!missionSpan) return;
      missionSpan.setAttribute('game.mission.outcome', success ? 'completed' : 'paused');
      missionSpan.addEvent(success ? 'game.mission.completed' : 'game.mission.paused');
      if (success) missionCompletions.add(1, { 'game.mission.type': mission.type });
      log(success ? 'INFO' : 'WARN', success ? 'Mission completed' : 'Mission paused', { 'game.mission.id': mission.id });
      missionSpan.end();
      missionSpan = null;
      return Promise.all([tracerProvider.forceFlush(), meterProvider.forceFlush(), loggerProvider.forceFlush()]);
    },
    flush() { return Promise.all([tracerProvider.forceFlush(), meterProvider.forceFlush(), loggerProvider.forceFlush()]); },
  };
}
