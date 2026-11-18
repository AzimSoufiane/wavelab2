import React, { useEffect, useRef, useState } from 'react';
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
  const params = calculateElectromagneticParameters(wave, material, wall);
  const deltaX = Math.abs(probe.x2 - probe.x1);
  const { deltaPhiRad: liveDeltaPhiRad, deltaPhiDeg: liveDeltaPhiDeg } =
    calculateProbePhaseDelta(wave, params.n1, params.n2, params.fcRatio, params.isCutoff, deltaX);

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

    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#151f32';
    ctx.lineWidth = 1;
    for (let y = 16; y < height; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let x = 24; x < width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    if (scopeMode === 'time') {
      ctx.strokeStyle = '#334155';
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

        const lastX = width - 3;
        const lastY = midY - hist[hist.length - 1] * scale;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
        ctx.fill();
      };

      drawTrace(probe.history1, '#22d3ee');
      drawTrace(probe.history2, '#f59e0b');
    } else if (scopeMode === 'spatial') {
      // Chapitre 3 : Enveloppe spatiale |E(x)| sur [-14, 14]
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
      const mapY = (val: number) => height - 10 - (val / maxVal) * (height - 24);

      // Zone paroi ombrée
      const xfPx = mapX(xFront);
      const xbPx = mapX(xBack);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.fillRect(xfPx, 0, Math.max(2, xbPx - xfPx), height);

      // Courbe |E(x)|
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((pt, idx) => {
        const px = mapX(pt.x);
        const py = mapY(pt.envAbs);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Marqueurs S1 et S2
      for (const [pxVal, col] of [
        [probe.x1, '#22d3ee'],
        [probe.x2, '#f59e0b'],
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
      // Chapitre 1 (§1.7.6) : Courbes de Fresnel |Γ|(θi) ou énergie R(θi) & T'(θi)
      const curve = calculateFresnelCurve(wave, material);
      const padL = 26;
      const padR = 8;
      const padT = 10;
      const padB = 14;
      const plotW = width - padL - padR;
      const plotH = height - padT - padB;
      const mapX = (deg: number) => padL + (Math.min(88, Math.max(0, deg)) / 88) * plotW;
      const mapY = (v: number) => padT + (1 - Math.min(1, Math.max(0, v))) * plotH;

      // Repères horizontaux (0%, 50%, 100%) & graduations angles
      ctx.font = '9px monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(scopeMode === 'energy' ? '100%' : '1.0', padL - 4, mapY(1));
      ctx.fillText(scopeMode === 'energy' ? '50%' : '0.5', padL - 4, mapY(0.5));
      ctx.fillText(scopeMode === 'energy' ? '0%' : '0', padL - 4, mapY(0));

      ctx.textBaseline = 'bottom';
      for (const deg of [0, 30, 60, 88]) {
        ctx.textAlign = deg === 0 ? 'left' : deg === 88 ? 'right' : 'center';
        ctx.fillText(`${deg}°`, mapX(deg), height - 1);
      }
      ctx.textAlign = 'center';

      // Ligne Brewster θB et angle critique θl
      if (params.brewsterDeg !== null && params.brewsterDeg <= 88) {
        const bx = mapX(params.brewsterDeg);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(bx, padT);
        ctx.lineTo(bx, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('θB', bx, padT + 9);
      }
      if (params.thetaLimitDeg !== null && params.thetaLimitDeg <= 88) {
        const lx = mapX(params.thetaLimitDeg);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(lx, padT);
        ctx.lineTo(lx, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fb7185';
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
        drawCurve((c) => c.gammaTE, '#22d3ee', false, 2);
        drawCurve((c) => c.gammaTM, '#f59e0b', false, 2);
        drawCurve((c) => c.tPrimeTM, '#34d399', true, 1.6);
      } else {
        // Mode 'energy' : Courbes complètes R(θi) et T'(θi) pour TE et TM
        drawCurve((c) => c.rTE, '#22d3ee', false, 2);
        drawCurve((c) => c.rTM, '#f59e0b', false, 2);
        drawCurve((c) => c.tPrimeTE, '#818cf8', true, 1.7);
        drawCurve((c) => c.tPrimeTM, '#34d399', true, 2);
      }

      // Curseur θi courant + points actifs R et T'
      const curX = mapX(wave.incidenceAngleDeg);
      ctx.strokeStyle = '#f43f5e';
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
        ctx.fillStyle = wave.guidedMode === 'TE' ? '#22d3ee' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(curX, curRY, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = wave.guidedMode === 'TE' ? '#818cf8' : '#34d399';
        ctx.beginPath();
        ctx.arc(curX, curTY, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [
    probe.history1,
    probe.history2,
    probe.x1,
    probe.x2,
    wave,
    wall,
    material,
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
      className="w-full bg-[#080d18] border-t border-slate-800 px-3 py-2.5 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 text-xs select-none shrink-0"
    >
      {/* Télémétrie comparative & Ch. 3 */}
      <div className="flex flex-col space-y-2 lg:min-w-[400px]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-slate-100 font-semibold">
            <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Oscilloscope &amp; Stationnarité</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
            <span data-testid="tos-readout">
              TOS=<b className="text-cyan-300">{params.tos.toFixed(2)}</b>
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span data-testid="ros-readout">
              ROS=<b className="text-amber-300">{Number.isFinite(params.ros) ? params.ros.toFixed(2) : '∞'}</b>
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="flex items-center gap-1 text-indigo-300">
              <ArrowRightLeft className="w-3 h-3" />
              Δφ={liveDeltaPhiRad.toFixed(2)} rad
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 min-w-0">
            <div className="text-cyan-300 font-semibold flex items-center justify-between gap-2">
              <span className="truncate">S1 (x₁={probe.x1.toFixed(1)}m)</span>
              <span className="text-[10px] text-slate-400 font-normal truncate">{zone1}</span>
            </div>
            <div className="text-slate-300 flex justify-between gap-2">
              <span>
                E: <b className="text-cyan-300">{probe.val1.toFixed(2)}</b>
              </span>
              <span>
                RMS: <b className="text-slate-100">{probe.rms1.toFixed(2)}</b>
              </span>
            </div>
            <div className="flex gap-1">
              {(['incident', 'inside', 'transmitted'] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => onProbePreset(1, z)}
                  className="flex-1 px-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] rounded text-slate-300 transition-colors truncate"
                >
                  {z === 'incident' ? 'Incident' : z === 'inside' ? 'Paroi' : 'Transmis'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 min-w-0">
            <div className="text-amber-300 font-semibold flex items-center justify-between gap-2">
              <span className="truncate">S2 (x₂={probe.x2.toFixed(1)}m)</span>
              <span className="text-[10px] text-slate-400 font-normal truncate">{zone2}</span>
            </div>
            <div className="text-slate-300 flex justify-between gap-2">
              <span>
                E: <b className="text-amber-300">{probe.val2.toFixed(2)}</b>
              </span>
              <span>
                RMS: <b className="text-slate-100">{probe.rms2.toFixed(2)}</b>
              </span>
            </div>
            <div className="flex gap-1">
              {(['incident', 'inside', 'transmitted'] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => onProbePreset(2, z)}
                  className="flex-1 px-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] rounded text-slate-300 transition-colors truncate"
                >
                  {z === 'incident' ? 'Incident' : z === 'inside' ? 'Paroi' : 'Transmis'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Écran oscilloscope / Espace |E(x)| / Courbes de Fresnel */}
      <div className="flex-1 w-full flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex flex-wrap max-w-full bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px] font-mono">
            {(
              [
                { id: 'time', label: 'Temps E(t)' },
                { id: 'spatial', label: 'Espace |E(x)|' },
                { id: 'fresnel', label: 'Fresnel |Γ|' },
                { id: 'energy', label: "R & T' (θi)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScopeMode(tab.id)}
                className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                  scopeMode === tab.id
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="font-mono text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
            {scopeMode === 'time' && (
              <>
                <span className="text-cyan-400 font-semibold">CH1 S1</span>
                <span className="text-amber-400 font-semibold">CH2 S2</span>
                <span className="hidden sm:inline text-slate-500">
                  · Emax={params.eMax.toFixed(2)} · Emin={params.eMin.toFixed(2)} V/m
                </span>
              </>
            )}
            {scopeMode === 'spatial' && (
              <>
                <span className="text-amber-300 font-semibold">|E(x)|</span>
                <span>Emax={params.eMax.toFixed(2)}</span>
                <span>Emin={params.eMin.toFixed(2)}</span>
                <span>d₁={params.dFirstMin.toFixed(3)}m</span>
              </>
            )}
            {scopeMode === 'fresnel' && (
              <>
                <span className="text-cyan-400 font-semibold">|Γ_TE|</span>
                <span className="text-amber-400 font-semibold">|Γ_TM|</span>
                <span className="text-emerald-400 font-semibold">T&apos;_TM</span>
                <span className="text-rose-400">θi={wave.incidenceAngleDeg.toFixed(0)}°</span>
              </>
            )}
            {scopeMode === 'energy' && (
              <>
                <span className="text-cyan-400 font-semibold">R_TE</span>
                <span className="text-amber-400 font-semibold">R_TM</span>
                <span className="text-indigo-300 font-semibold">T&apos;_TE</span>
                <span className="text-emerald-400 font-semibold">T&apos;_TM</span>
                <span className="text-slate-200 font-semibold">
                  · R={(params.reflectionR * 100).toFixed(1)}% · T&apos;={(params.transmissionT * 100).toFixed(1)}%
                </span>
                <span className="text-rose-300 font-semibold">
                  · θi={wave.incidenceAngleDeg.toFixed(0)}° ({wave.guidedMode})
                </span>
              </>
            )}
          </div>
        </div>

        <div className="relative h-24 rounded-lg overflow-hidden border border-slate-800 bg-[#060a12]">
          <canvas
            ref={canvasRef}
            width={680}
            height={96}
            onClick={(e) => {
              if ((scopeMode !== 'energy' && scopeMode !== 'fresnel') || !onIncidenceAngleChange) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const padL = (26 / 680) * rect.width;
              const padR = (8 / 680) * rect.width;
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
            <div className="absolute bottom-1.5 right-2.5 font-mono text-[10px] text-slate-400 pointer-events-none flex items-center gap-2">
              <span>|x₂ - x₁| = {deltaX.toFixed(2)} m</span>
              <span className="text-slate-600" aria-hidden="true">|</span>
              <span className="text-indigo-300 font-semibold">
                Δφ = {liveDeltaPhiRad.toFixed(2)} rad ({(liveDeltaPhiDeg % 360).toFixed(1)}°)
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
