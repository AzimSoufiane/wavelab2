import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, SegmentedControl } from 'glisse';
import { DualProbeState, MaterialPreset, WallGeometry, WaveConfig } from '../types';
import {
  calculateElectromagneticParameters,
  calculateStandingWaveEnvelope,
  calculateFresnelCurve,
  calculateProbePhaseDelta,
} from '../physics/waveEngine';
import { Activity, ArrowRightLeft } from 'lucide-react';

interface OscilloscopeProps {
  probe: DualProbeState;
  wave: WaveConfig;
  wall: WallGeometry;
  material: MaterialPreset;
  onProbePreset: (probeId: 1 | 2, zone: 'incident' | 'inside' | 'transmitted') => void;
  onIncidenceAngleChange?: (angleDeg: number) => void;
}

type ScopeMode = 'time' | 'spatial' | 'fresnel' | 'energy';

function readScopeTokens() {
  if (typeof window === 'undefined') {
    return {
      bg: '#060a12',
      grid: '#151f32',
      axis: '#334155',
      label: '#64748b',
      s1: '#22d3ee',
      s2: '#f59e0b',
      nominal: '#34d399',
      critical: '#fb7185',
      indigo: '#818cf8',
      fontMono: 'monospace',
    };
  }
  const styles = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    bg: pick('--scope-bg', '#060a12'),
    grid: pick('--scope-grid', '#151f32'),
    axis: pick('--scope-axis', '#334155'),
    label: pick('--scope-label', '#64748b'),
    s1: pick('--probe-s1', '#22d3ee'),
    s2: pick('--probe-s2', '#f59e0b'),
    nominal: pick('--status-nominal', '#34d399'),
    critical: pick('--status-critical', '#fb7185'),
    indigo: pick('--curve-indigo', '#818cf8'),
    fontMono: pick('--font-mono', 'monospace'),
  };
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  probe,
  wave,
  wall,
  material,
  onProbePreset,
  onIncidenceAngleChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('time');
  const params = useMemo(
    () => calculateElectromagneticParameters(wave, material, wall),
    [wave, material, wall]
  );
  const fresnelCurve = useMemo(
    () => calculateFresnelCurve(wave, material),
    [wave.frequency, wave.medium1EpsilonR, material]
  );
  const deltaX = Math.abs(probe.x2 - probe.x1);
  const { deltaPhiRad: liveDeltaPhiRad, deltaPhiDeg: liveDeltaPhiDeg } = useMemo(
    () =>
      calculateProbePhaseDelta(wave, params.n1, params.n2, params.fcRatio, params.isCutoff, deltaX),
    [wave, params.n1, params.n2, params.fcRatio, params.isCutoff, deltaX]
  );

  const halfThickness = wall.thickness / 2;
  const getZoneLabel = (x: number) => {
    if (x < wall.posX - halfThickness) return 'Milieu 1 (Incident)';
    if (x <= wall.posX + halfThickness) return 'Intérieur Paroi';
    return 'Milieu 2 (Transmis)';
  };
  const zone1 = getZoneLabel(probe.x1);
  const zone2 = getZoneLabel(probe.x2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tk = readScopeTokens();
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    ctx.fillStyle = tk.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = tk.grid;
    ctx.lineWidth = 1;
    for (let y = 18; y < height; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let x = 28; x < width; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    if (scopeMode === 'time') {
      ctx.strokeStyle = tk.axis;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      const scale = (height * 0.34) / Math.max(0.2, wave.amplitude * (1 + params.gammaMag));

      const drawTrace = (hist: number[], color: string) => {
        if (hist.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const step = width / (hist.length - 1);
        for (let i = 0; i < hist.length; i++) {
          const x = i * step;
          const y = midY - hist[i] * scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        const lastX = width - 4;
        const lastY = midY - hist[hist.length - 1] * scale;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 3.2, 0, Math.PI * 2);
        ctx.fill();
      };

      drawTrace(probe.history1, tk.s1);
      drawTrace(probe.history2, tk.s2);
    } else if (scopeMode === 'spatial') {
      const xMin = -14;
      const xMax = 14;
      const { points, xFront, xBack } = calculateStandingWaveEnvelope(
        wave,
        wall,
        material,
        xMin,
        xMax,
        160
      );
      const mapX = (x: number) => ((x - xMin) / (xMax - xMin)) * width;
      const maxVal = Math.max(0.5, wave.amplitude * (1 + params.gammaMag) * 1.15);
      const mapY = (val: number) => height - 12 - (val / maxVal) * (height - 26);

      const xfPx = mapX(xFront);
      const xbPx = mapX(xBack);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.fillRect(xfPx, 0, Math.max(2, xbPx - xfPx), height);

      ctx.strokeStyle = tk.s2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((pt, idx) => {
        const px = mapX(pt.x);
        const py = mapY(pt.envAbs);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      for (const [pxVal, col] of [
        [probe.x1, tk.s1],
        [probe.x2, tk.s2],
      ] as const) {
        const sx = mapX(pxVal);
        ctx.strokeStyle = col;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(sx, 8);
        ctx.lineTo(sx, height - 6);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      const curve = fresnelCurve;
      const padL = 28;
      const padR = 10;
      const padT = 12;
      const padB = 16;
      const plotW = width - padL - padR;
      const plotH = height - padT - padB;
      const mapX = (deg: number) => padL + (Math.min(88, Math.max(0, deg)) / 88) * plotW;
      const mapY = (v: number) => padT + (1 - Math.min(1, Math.max(0, v))) * plotH;

      ctx.font = `9.5px ${tk.fontMono}`;
      ctx.fillStyle = tk.label;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(scopeMode === 'energy' ? '100%' : '1.0', padL - 4, mapY(1));
      ctx.fillText(scopeMode === 'energy' ? '50%' : '0.5', padL - 4, mapY(0.5));
      ctx.fillText(scopeMode === 'energy' ? '0%' : '0', padL - 4, mapY(0));

      ctx.textBaseline = 'bottom';
      for (const deg of [0, 30, 60, 88]) {
        ctx.textAlign = deg === 0 ? 'left' : deg === 88 ? 'right' : 'center';
        ctx.fillText(`${deg}°`, mapX(deg), height - 2);
      }
      ctx.textAlign = 'center';

      if (params.brewsterDeg !== null && params.brewsterDeg <= 88) {
        const bx = mapX(params.brewsterDeg);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.38)';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(bx, padT);
        ctx.lineTo(bx, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = tk.s2;
        ctx.fillText('θB', bx, padT + 9);
      }
      if (params.thetaLimitDeg !== null && params.thetaLimitDeg <= 88) {
        const lx = mapX(params.thetaLimitDeg);
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.38)';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(lx, padT);
        ctx.lineTo(lx, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = tk.critical;
        ctx.fillText('θl', lx, padT + 9);
      }

      const drawCurve = (
        getVal: (pt: (typeof curve)[number]) => number,
        color: string,
        dashed = false,
        lineWidth = 2
      ) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        if (dashed) ctx.setLineDash([4, 3]);
        ctx.beginPath();
        curve.forEach((c, idx) => {
          const px = mapX(c.angleDeg);
          const py = mapY(getVal(c));
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        if (dashed) ctx.setLineDash([]);
      };

      if (scopeMode === 'fresnel') {
        drawCurve((c) => c.gammaTE, tk.s1, false, 2);
        drawCurve((c) => c.gammaTM, tk.s2, false, 2);
        drawCurve((c) => c.tPrimeTM, tk.nominal, true, 1.6);
      } else {
        drawCurve((c) => c.rTE, tk.s1, false, 2);
        drawCurve((c) => c.rTM, tk.s2, false, 2);
        drawCurve((c) => c.tPrimeTE, tk.indigo, true, 1.7);
        drawCurve((c) => c.tPrimeTM, tk.nominal, true, 2);
      }

      const curX = mapX(wave.incidenceAngleDeg);
      ctx.strokeStyle = tk.critical;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX, padT);
      ctx.lineTo(curX, padT + plotH);
      ctx.stroke();

      if (scopeMode === 'energy') {
        const dotParams = calculateElectromagneticParameters(
          { ...wave, boundaryModel: 'dioptre_semi_infini' },
          material
        );
        const curRY = mapY(dotParams.reflectionR);
        const curTY = mapY(dotParams.transmissionT);
        ctx.fillStyle = wave.guidedMode === 'TE' ? tk.s1 : tk.s2;
        ctx.beginPath();
        ctx.arc(curX, curRY, 3.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = wave.guidedMode === 'TE' ? tk.indigo : tk.nominal;
        ctx.beginPath();
        ctx.arc(curX, curTY, 3.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [
    scopeMode === 'time' ? probe.history1 : null,
    scopeMode === 'time' ? probe.history2 : null,
    probe.x1,
    probe.x2,
    wave,
    wall,
    material,
    fresnelCurve,
    params.gammaMag,
    params.reflectionR,
    params.transmissionT,
    params.brewsterDeg,
    params.thetaLimitDeg,
    scopeMode,
  ]);

  return (
    <section
      aria-label="Oscilloscope bifaisceau et analyseur d'onde stationnaire"
      className="w-full flex flex-col lg:flex-row items-stretch lg:items-center gap-4 text-xs select-none"
    >
      {/* Télémétrie comparative & Sondes S1 / S2 sur grille hairline sans cartes imbriquées */}
      <div className="flex flex-col space-y-2.5 lg:min-w-[360px]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
            <Activity className="w-4 h-4 text-[var(--app-accent)] shrink-0" />
            <span>Oscilloscope &amp; Stationnarité</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--text-secondary)] tabular-nums">
            <span data-testid="tos-readout">
              TOS=<b className="text-[var(--app-accent)]">{params.tos.toFixed(2)}</b>
            </span>
            <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>
            <span data-testid="ros-readout">
              ROS=<b className="text-[var(--text-primary)]">{Number.isFinite(params.ros) ? params.ros.toFixed(2) : '∞'}</b>
            </span>
            <span className="text-[var(--text-muted)]" aria-hidden="true">·</span>
            <span className="flex items-center gap-1 text-[var(--text-secondary)]">
              <ArrowRightLeft className="w-3 h-3 text-[var(--app-accent)]" />
              Δφ={liveDeltaPhiRad.toFixed(2)} rad
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 border-y border-[var(--hairline-subtle)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--hairline-subtle)] text-[11px] font-mono tabular-nums">
          <div className="py-2 sm:pr-3 space-y-1.5 min-w-0">
            <div className="text-[var(--probe-s1)] font-semibold flex items-center justify-between gap-2">
              <span className="truncate">S1 (x₁={probe.x1.toFixed(1)}m)</span>
              <span className="text-[10px] font-sans text-[var(--text-muted)] font-normal truncate">{zone1}</span>
            </div>
            <div className="text-[var(--text-secondary)] flex justify-between gap-2">
              <span>
                E: <b className="text-[var(--probe-s1)]">{probe.val1.toFixed(2)}</b>
              </span>
              <span>
                RMS: <b className="text-[var(--text-primary)]">{probe.rms1.toFixed(2)}</b>
              </span>
            </div>
            <div className="flex gap-1 pt-0.5 font-sans">
              {(['incident', 'inside', 'transmitted'] as const).map((z) => (
                <Button
                  key={z}
                  onClick={() => onProbePreset(1, z)}
                  className="flex-1 lg-btn-compact truncate"
                >
                  {z === 'incident' ? 'Incident' : z === 'inside' ? 'Paroi' : 'Transmis'}
                </Button>
              ))}
            </div>
          </div>

          <div className="py-2 sm:pl-3 space-y-1.5 min-w-0">
            <div className="text-[var(--probe-s2)] font-semibold flex items-center justify-between gap-2">
              <span className="truncate">S2 (x₂={probe.x2.toFixed(1)}m)</span>
              <span className="text-[10px] font-sans text-[var(--text-muted)] font-normal truncate">{zone2}</span>
            </div>
            <div className="text-[var(--text-secondary)] flex justify-between gap-2">
              <span>
                E: <b className="text-[var(--probe-s2)]">{probe.val2.toFixed(2)}</b>
              </span>
              <span>
                RMS: <b className="text-[var(--text-primary)]">{probe.rms2.toFixed(2)}</b>
              </span>
            </div>
            <div className="flex gap-1 pt-0.5 font-sans">
              {(['incident', 'inside', 'transmitted'] as const).map((z) => (
                <Button
                  key={z}
                  onClick={() => onProbePreset(2, z)}
                  className="flex-1 lg-btn-compact truncate"
                >
                  {z === 'incident' ? 'Incident' : z === 'inside' ? 'Paroi' : 'Transmis'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Écran oscilloscope / Espace |E(x)| / Courbes de Fresnel */}
      <div className="flex-1 w-full flex flex-col gap-2 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <SegmentedControl
            aria-label="Mode d'affichage oscilloscope"
            value={scopeMode}
            onValueChange={(val) => setScopeMode(val as ScopeMode)}
            style={{ '--lg-tab-width': '72px' } as React.CSSProperties}
            items={[
              { value: 'time', label: 'E(t)' },
              { value: 'spatial', label: '|E(x)|' },
              { value: 'fresnel', label: 'Fresnel' },
              { value: 'energy', label: "R & T'" },
            ]}
          />

          <div className="font-mono text-[10.5px] text-[var(--text-muted)] flex items-center gap-2 flex-wrap tabular-nums">
            {scopeMode === 'time' && (
              <>
                <span className="text-[var(--probe-s1)] font-semibold">CH1 S1</span>
                <span className="text-[var(--probe-s2)] font-semibold">CH2 S2</span>
                <span className="hidden sm:inline text-[var(--text-muted)]">
                  · Emax={params.eMax.toFixed(2)} · Emin={params.eMin.toFixed(2)} V/m
                </span>
              </>
            )}
            {scopeMode === 'spatial' && (
              <>
                <span className="text-[var(--probe-s2)] font-semibold">|E(x)|</span>
                <span>Emax={params.eMax.toFixed(2)}</span>
                <span>Emin={params.eMin.toFixed(2)}</span>
                <span>d₁={params.dFirstMin.toFixed(3)}m</span>
              </>
            )}
            {scopeMode === 'fresnel' && (
              <>
                <span className="text-[var(--probe-s1)] font-semibold">|Γ_TE|</span>
                <span className="text-[var(--probe-s2)] font-semibold">|Γ_TM|</span>
                <span className="text-[var(--status-nominal)] font-semibold">T&apos;_TM</span>
                <span className="text-[var(--status-critical)]">θi={wave.incidenceAngleDeg.toFixed(0)}°</span>
              </>
            )}
            {scopeMode === 'energy' && (
              <>
                <span className="text-[var(--probe-s1)] font-semibold">R_TE</span>
                <span className="text-[var(--probe-s2)] font-semibold">R_TM</span>
                <span className="text-[var(--curve-indigo)] font-semibold">T&apos;_TE</span>
                <span className="text-[var(--status-nominal)] font-semibold">T&apos;_TM</span>
                <span className="text-[var(--text-primary)] font-semibold">
                  · R={(params.reflectionR * 100).toFixed(1)}% · T&apos;={(params.transmissionT * 100).toFixed(1)}%
                </span>
                <span className="text-[var(--status-critical)] font-semibold">
                  · θi={wave.incidenceAngleDeg.toFixed(0)}° ({wave.guidedMode})
                </span>
              </>
            )}
          </div>
        </div>

        <div className="relative h-28 rounded-xl overflow-hidden border border-[var(--hairline-strong)] bg-[var(--scope-bg)]">
          <canvas
            ref={canvasRef}
            width={680}
            height={112}
            onClick={(e) => {
              if ((scopeMode !== 'energy' && scopeMode !== 'fresnel') || !onIncidenceAngleChange) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const padL = (28 / 680) * rect.width;
              const padR = (10 / 680) * rect.width;
              const relX = (e.clientX - rect.left - padL) / Math.max(1, rect.width - padL - padR);
              const deg = Math.round(Math.max(0, Math.min(85, relX * 88)));
              onIncidenceAngleChange(deg);
            }}
            className={`w-full h-full block ${
              (scopeMode === 'energy' || scopeMode === 'fresnel') && onIncidenceAngleChange
                ? 'cursor-crosshair'
                : ''
            }`}
          />
          {(scopeMode === 'time' || scopeMode === 'spatial') && (
            <div className="absolute bottom-1.5 right-2.5 font-mono text-[10px] text-[var(--text-muted)] pointer-events-none flex items-center gap-2 tabular-nums">
              <span>|x₂ - x₁| = {deltaX.toFixed(2)} m</span>
              <span className="opacity-45" aria-hidden="true">|</span>
              <span className="text-[var(--app-accent)] font-semibold">
                Δφ = {liveDeltaPhiRad.toFixed(2)} rad ({(liveDeltaPhiDeg % 360).toFixed(1)}°)
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
