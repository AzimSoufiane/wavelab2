import React, { useMemo, useState } from 'react';
import katex from 'katex';
import { MaterialPreset, WaveConfig, WallGeometry } from '../types';
import {
  calculateElectromagneticParameters,
  calculateProbePhaseDelta,
  reconstructUnknownMedium,
} from '../physics/waveEngine';
import { ChevronDown, ChevronUp, Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface KatexEquationsProps {
  wave: WaveConfig;
  wall: WallGeometry;
  material: MaterialPreset;
  probeX1: number;
  probeX2: number;
  activeChapter?: 'ch1' | 'ch2' | 'ch3';
}

function renderTex(latex: string) {
  try {
    return {
      __html: katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      }),
    };
  } catch {
    return { __html: latex };
  }
}

const formatSci = (val: number, digits = 3) => {
  if (!Number.isFinite(val)) return '\\infty';
  if (val === 0) return '0';
  if (Math.abs(val) >= 1e5 || Math.abs(val) < 1e-2) {
    return (
      val.toExponential(digits).replace('e+', '\\times 10^{').replace('e-', '\\times 10^{-') + '}'
    );
  }
  return val.toFixed(digits);
};

export const KatexEquations: React.FC<KatexEquationsProps> = React.memo(({
  wave,
  wall,
  material,
  probeX1,
  probeX2,
  activeChapter,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showInverseTp, setShowInverseTp] = useState(false);
  const deltaX = Math.abs(probeX2 - probeX1);

  const computed = useMemo(() => {
    const params = calculateElectromagneticParameters(wave, material, wall);
    const rec = reconstructUnknownMedium(
      params.eMax,
      params.eMin,
      params.dFirstMin,
      params.lambda1,
      params.eta1
    );
    const { deltaPhiRad: deltaPhiCalcRad, deltaPhiDeg: deltaPhiCalcDeg } =
      calculateProbePhaseDelta(
        wave,
        params.n1,
        params.n2,
        params.fcRatio,
        params.isCutoff,
        deltaX
      );
    const gammaPhaseDeg = (params.gammaPhaseRad * 180) / Math.PI;
    const regimeLabel =
      params.regime === 'pec'
        ? 'Conducteur parfait (PEC)'
        : params.regime === 'bon_conducteur'
        ? 'Bon conducteur'
        : params.regime === 'faibles_pertes'
        ? 'Faibles pertes'
        : 'Sans pertes';

    return {
      params,
      rec,
      deltaPhiCalcRad,
      deltaPhiCalcDeg,
      regimeLabel,
      texCh1V: renderTex(
        `v_\\phi = \\frac{c}{n_2} = ${formatSci(params.vPhase)}\\text{ m/s}, \\quad \\theta_t = ${
          params.isTotalInternalReflection ? '90^\\circ\\text{ (TIR)}' : `${params.thetaTDeg.toFixed(1)}^\\circ`
        }`
      ),
      texCh1G: renderTex(
        `|\\Gamma| = ${params.gammaMag.toFixed(3)}\\angle ${gammaPhaseDeg.toFixed(0)}^\\circ, \\quad R = ${(
          params.reflectionR * 100
        ).toFixed(1)}\\%, \\quad T' = ${(params.transmissionT * 100).toFixed(1)}\\%`
      ),
      texCh2Eta: renderTex(
        `|\\eta_2| = ${
          params.eta > 0 && params.eta < 1 ? formatSci(params.eta, 2) : params.eta.toFixed(1)
        }\\,\\Omega\\angle ${params.etaPhaseDeg.toFixed(1)}^\\circ, \\quad \\delta_s = ${formatSci(
          params.skinDepth,
          2
        )}\\text{ m}`
      ),
      texCh2Alpha: renderTex(
        `\\alpha = ${formatSci(params.alpha, 2)}\\text{ Np/m}, \\quad A_{dB/m} = ${formatSci(
          params.attenuationDbPerM,
          2
        )}\\text{ dB/m}`
      ),
      texCh3Tos: renderTex(
        `\\text{TOS} = |\\Gamma| = ${params.tos.toFixed(3)}, \\quad \\text{ROS} = \\frac{1+|\\Gamma|}{1-|\\Gamma|} = ${
          Number.isFinite(params.ros) ? params.ros.toFixed(2) : '\\infty'
        }`
      ),
      texCh3Min: renderTex(
        `d_{1\\text{er min}} = ${formatSci(params.dFirstMin, 3)}\\text{ m}, \\quad \\frac{\\lambda_1}{2} = ${formatSci(
          params.lambda1 / 2,
          3
        )}\\text{ m}`
      ),
      texCh3Phi: renderTex(
        `\\Delta\\varphi = ${deltaPhiCalcRad.toFixed(2)}\\text{ rad } (${(
          deltaPhiCalcDeg % 360
        ).toFixed(1)}^\\circ)`
      ),
      texGuided: renderTex(
        `f_c = ${(params.fc / 1e9).toFixed(3)}\\text{ GHz}, \\quad ${
          params.isCutoff
            ? `\\alpha = ${formatSci(params.attenuationAlpha, 2)}\\text{ Np/m}`
            : `\\lambda_g = ${formatSci(params.lambdaGuided, 3)}\\text{ m}`
        }`
      ),
    };
  }, [wave, wall, material, deltaX]);

  const { params, rec, regimeLabel } = computed;
  const showCh1 = !activeChapter || activeChapter === 'ch1';
  const showCh2 = !activeChapter || activeChapter === 'ch2';
  const showCh3 = !activeChapter || activeChapter === 'ch3';

  return (
    <div className="shrink-0 bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors border-b border-white/10 text-left"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5 text-[#0a84ff] shrink-0" />
          <span className="text-xs font-semibold text-slate-100">
            Modèle analytique Mod-M115
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="text-[11px] font-mono">
            {collapsed ? 'Développer' : 'Réduire'}
          </span>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </div>
      </button>

      {!collapsed && (
        <div className="p-2.5 space-y-2 text-xs text-slate-200">
          {wave.boundaryModel === 'guide_ondes' && params.isCutoff && (
            <div
              data-testid="cutoff-banner"
              className="flex items-start gap-2 p-2 rounded-lg bg-rose-500/15 border border-rose-400/35 text-rose-100 text-[11px]"
            >
              <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Mode évanescent (f &lt; fc) : </span>
                <span className="font-mono text-white">{wave.frequency.toFixed(2)} GHz</span> &lt;{' '}
                <span className="font-mono text-white">
                  {(params.fc / 1e9).toFixed(3)} GHz
                </span>{' '}
                pour {wave.guidedMode}_{wave.modeM}
                {wave.modeN}. Atténuation exponentielle en e^(-αx).
              </div>
            </div>
          )}

          {wave.boundaryModel === 'guide_ondes' && !params.isCutoff && (
            <div
              data-testid="propagating-banner"
              className="flex items-center gap-2 p-2 rounded-lg bg-[#0a84ff]/15 border border-[#0a84ff]/40 text-slate-100 text-[11px]"
            >
              <CheckCircle2 className="w-4 h-4 text-[#0a84ff] shrink-0" />
              <div>
                <span className="font-semibold">Mode guidé propagatif (f &gt; fc) : </span>
                <span className="font-mono text-white">{(params.fc / 1e9).toFixed(3)} GHz</span>
              </div>
            </div>
          )}

          {wave.boundaryModel !== 'guide_ondes' && params.isTotalInternalReflection && (
            <div
              data-testid="tir-banner"
              className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/15 border border-rose-400/35 text-rose-100 text-[11px]"
            >
              <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Réflexion totale (θi &gt; θl) : </span>
                |Γ| = 1, onde évanescente dans le milieu 2 (T&apos; = 0).
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 font-mono">
            {showCh1 && (
              <div className="bg-black/25 p-2 rounded-lg border border-white/10 space-y-1">
                <div className="text-[11px] text-[#0a84ff] font-semibold flex items-center justify-between gap-2">
                  <span className="truncate">Ch. 1 — Dioptre &amp; Descartes</span>
                  <span className="text-slate-400 font-normal shrink-0">
                    {material.isPEC
                      ? `n₁=${params.n1.toFixed(2)} → PEC`
                      : material.isConductor
                      ? `n₁=${params.n1.toFixed(2)} → Métal`
                      : `n₁=${params.n1.toFixed(2)} → n₂=${params.n2.toFixed(2)}`}
                  </span>
                </div>
                <div
                  className="overflow-x-auto text-[11.5px] py-0.5 text-slate-100"
                  dangerouslySetInnerHTML={computed.texCh1V}
                />
                <div
                  className="overflow-x-auto text-[11.5px] py-0.5 text-slate-200"
                  dangerouslySetInnerHTML={computed.texCh1G}
                />
                {params.brewsterDeg !== null && (
                  <div className="text-[10px] text-slate-400 pt-0.5 flex flex-wrap gap-x-3">
                    <span>θB (TM) = {params.brewsterDeg.toFixed(1)}°</span>
                    {params.thetaLimitDeg !== null && (
                      <span>θl (TIR) = {params.thetaLimitDeg.toFixed(1)}°</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {showCh2 && (
              <div className="bg-black/25 p-2 rounded-lg border border-white/10 space-y-1">
                <div className="text-[11px] text-[#0a84ff] font-semibold flex items-center justify-between">
                  <span>Ch. 2 — Milieu &amp; Pertes</span>
                  <span className="text-slate-400 font-normal">{regimeLabel}</span>
                </div>
                <div
                  className="overflow-x-auto text-[11.5px] py-0.5 text-slate-100"
                  dangerouslySetInnerHTML={computed.texCh2Eta}
                />
                <div
                  className="overflow-x-auto text-[11.5px] py-0.5 text-slate-300"
                  dangerouslySetInnerHTML={computed.texCh2Alpha}
                />
              </div>
            )}

            {showCh3 && (
              <div className="bg-black/25 p-2 rounded-lg border border-white/10 space-y-1">
                <div className="text-[11px] text-[#0a84ff] font-semibold flex items-center justify-between">
                  <span>Ch. 3 — Onde Stationnaire</span>
                  <span className="text-slate-400 font-normal">|x₂ - x₁| = {deltaX.toFixed(2)} m</span>
                </div>
                <div
                  className="overflow-x-auto text-[11.5px] py-0.5 text-slate-100"
                  dangerouslySetInnerHTML={computed.texCh3Tos}
                />
                <div
                  className="overflow-x-auto text-[11.5px] py-0.5 text-slate-300"
                  dangerouslySetInnerHTML={computed.texCh3Min}
                />
                <div
                  className="overflow-x-auto text-[11.5px] py-0.5 text-slate-300"
                  dangerouslySetInnerHTML={computed.texCh3Phi}
                />

                <button
                  type="button"
                  onClick={() => setShowInverseTp((v) => !v)}
                  className="mt-1 text-[11px] text-[#0a84ff] hover:underline underline-offset-2 text-left"
                >
                  {showInverseTp ? 'Masquer TP §3.4.2 (Identifier η₂)' : 'TP §3.4.2 : Identifier η₂ inconnu'}
                </button>

                {showInverseTp && (
                  <div
                    data-testid="inverse-tp-panel"
                    className="mt-1.5 p-2 rounded bg-black/35 border border-[#0a84ff]/35 text-[11px] space-y-1 text-slate-200"
                  >
                    <div>
                      1) ROS = {Number.isFinite(rec.ros) ? rec.ros.toFixed(2) : '∞'} → |Γ| ={' '}
                      {rec.gammaMag.toFixed(3)}
                    </div>
                    <div>
                      2) φ = 4π·d₁/λ₁ − π = {((rec.phiRad * 180) / Math.PI).toFixed(1)}°
                    </div>
                    <div className="text-[#0a84ff] font-semibold">
                      3) η₂ = η₁(1+Γ)/(1−Γ) ≈{' '}
                      {Number.isFinite(rec.eta2Abs) ? `${rec.eta2Abs.toFixed(1)} Ω` : '∞'} ∠{' '}
                      {rec.eta2PhaseDeg.toFixed(1)}°
                    </div>
                  </div>
                )}
              </div>
            )}

            {wave.boundaryModel === 'guide_ondes' && (
              <div className="bg-black/25 p-2 rounded-lg border border-[#0a84ff]/30 space-y-1">
                <div className="text-[11px] text-[#0a84ff] font-semibold flex items-center justify-between">
                  <span>
                    Guide {wave.guidedMode}_{wave.modeM}
                    {wave.modeN}
                  </span>
                  <span className="text-slate-400 font-normal">
                    a={wave.guideA.toFixed(3)}m · b={wave.guideB.toFixed(3)}m
                  </span>
                </div>
                <div
                  className="overflow-x-auto text-[11.5px] py-0.5 text-slate-100"
                  dangerouslySetInnerHTML={computed.texGuided}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
KatexEquations.displayName = 'KatexEquations';
