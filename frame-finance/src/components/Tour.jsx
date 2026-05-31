import { useState, useEffect, useRef, useCallback } from "react";
import { TOUR_STEPS, setTourDone, getTourRepeat, setTourRepeat } from "../lib/onboarding";
import { useIsMobile } from "../lib/useIsMobile";

function getTargetRect(targetId) {
  if (!targetId) return null;
  const el = document.getElementById(targetId);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function Spotlight({ rect, padding = 8 }) {
  if (!rect) return null;
  const x = rect.left - padding;
  const y = rect.top - padding;
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;
  return (
    <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 1001, pointerEvents: "none" }}>
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={12} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,.7)" mask="url(#spotlight-mask)" />
      <rect x={x} y={y} width={w} height={h} rx={12} fill="none"
        stroke="var(--accent)" strokeWidth="2.5" opacity="0.9" />
    </svg>
  );
}

function MobileTour({ step, total, current, onNext, onPrev, onSkip, repeatTour, onRepeatChange }) {
  const isFirst = current === 0;
  const isLast  = current === total - 1;
  const pct     = Math.round(((current + 1) / total) * 100);

  return (
    <>
      {/* Sheet fixa na parte de baixo — acima da bottom bar */}
      <div style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 1003,
        background: "var(--surface)",
        borderRadius: "20px 20px 0 0",
        padding: "20px 20px 32px",
        boxShadow: "0 -8px 40px rgba(0,0,0,.25)",
        border: "1px solid var(--border)",
        maxHeight: "55vh",
        overflowY: "auto",
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border)", margin: "0 auto 18px" }} />

        {/* Progress + fechar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 99 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 99, transition: "width .3s" }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
            {current + 1} de {total}
          </span>
          <button onClick={onSkip} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", fontSize: 22, lineHeight: 1, padding: "0 4px",
          }}>×</button>
        </div>

        {/* Título */}
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", marginBottom: 8, lineHeight: 1.2 }}>
          {step.title}
        </div>

        {/* Descrição */}
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.65, marginBottom: 20 }}>
          {step.desc}
        </p>

        {/* Checkbox no último passo */}
        {isLast && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 18, cursor: "pointer" }}>
            <input type="checkbox" checked={repeatTour} onChange={e => onRepeatChange(e.target.checked)}
              style={{ accentColor: "var(--accent)", width: 18, height: 18, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Quero ver este tour de novo na próxima vez que abrir o app
            </span>
          </label>
        )}

        {/* Botões */}
        <div style={{ display: "flex", gap: 10 }}>
          {!isFirst && (
            <button onClick={onPrev} style={{
              flex: 1, padding: "13px 0", borderRadius: 12, border: "1px solid var(--border)",
              background: "var(--bg)", color: "var(--muted)", fontWeight: 600, fontSize: 15, cursor: "pointer",
            }}>Voltar</button>
          )}
          <button onClick={onNext} style={{
            flex: 2, padding: "13px 0", borderRadius: 12, border: "none",
            background: isLast ? "var(--green)" : "var(--accent)",
            color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}>
            {isLast ? "Concluir" : "Próximo"}
          </button>
        </div>

        {!isLast && (
          <button onClick={onSkip} style={{
            display: "block", width: "100%", marginTop: 12,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, color: "var(--muted)", textAlign: "center",
          }}>Pular o tour</button>
        )}
      </div>
    </>
  );
}

function DesktopBubble({ step, rect, total, current, onNext, onPrev, onSkip, repeatTour, onRepeatChange }) {
  const bubbleRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!bubbleRef.current) return;
    const bh = bubbleRef.current.offsetHeight || 220;
    const bw = bubbleRef.current.offsetWidth  || 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 16;

    if (!rect || step.position === "center") {
      setPos({ top: vh / 2 - bh / 2, left: vw / 2 - bw / 2 });
      return;
    }

    let left = rect.right + pad;
    let top  = rect.top + rect.height / 2 - bh / 2;
    if (left + bw > vw - pad) left = rect.left - bw - pad;
    top = Math.max(pad, Math.min(vh - bh - pad, top));
    setPos({ top, left });
  }, [rect, step]);

  const isFirst = current === 0;
  const isLast  = current === total - 1;
  const pct     = Math.round(((current + 1) / total) * 100);

  return (
    <div ref={bubbleRef} style={{
      position: "fixed",
      top: pos.top, left: pos.left,
      zIndex: 1003,
      width: Math.min(320, window.innerWidth - 32),
      background: "var(--surface)",
      borderRadius: 18, padding: 22,
      boxShadow: "0 8px 40px rgba(0,0,0,.25), 0 0 0 1px var(--border)",
      transition: "top .25s, left .25s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 99, marginRight: 10 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 99, transition: "width .3s" }} />
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
          {current + 1} / {total}
        </span>
        <button onClick={onSkip} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--muted)", fontSize: 18, marginLeft: 10, lineHeight: 1, padding: 0,
        }}>×</button>
      </div>

      <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", marginBottom: 8, lineHeight: 1.2 }}>
        {step.title}
      </div>
      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65, marginBottom: 18 }}>
        {step.desc}
      </p>

      {isLast && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={repeatTour} onChange={e => onRepeatChange(e.target.checked)}
            style={{ accentColor: "var(--accent)", width: 15, height: 15 }} />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Quero ver este tour de novo na próxima vez</span>
        </label>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {!isFirst && (
          <button onClick={onPrev} style={{
            flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid var(--border)",
            background: "var(--bg)", color: "var(--muted)", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>Voltar</button>
        )}
        <button onClick={onNext} style={{
          flex: 2, padding: "9px 0", borderRadius: 10, border: "none",
          background: isLast ? "var(--green)" : "var(--accent)",
          color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>
          {isLast ? "Concluir" : "Próximo"}
        </button>
      </div>

      {!isLast && (
        <button onClick={onSkip} style={{
          display: "block", width: "100%", marginTop: 10,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: "var(--muted)", textAlign: "center",
        }}>Pular o tour</button>
      )}

      {rect && step.position !== "center" && (
        <div style={{
          position: "absolute", left: -8, top: "50%", transform: "translateY(-50%)",
          width: 0, height: 0,
          borderTop: "8px solid transparent",
          borderBottom: "8px solid transparent",
          borderRight: "8px solid var(--surface)",
        }} />
      )}
    </div>
  );
}

export default function Tour({ onNavigate, onEnd }) {
  const isMobile = useIsMobile();
  const [current, setCurrent]           = useState(0);
  const [rect, setRect]                 = useState(null);
  const [repeatTour, setRepeatTourState] = useState(getTourRepeat());

  const step = TOUR_STEPS[current];

  const updateRect = useCallback(() => {
    setRect(getTargetRect(step.target));
  }, [step]);

  useEffect(() => {
    if (step.page) onNavigate(step.page);
    const t = setTimeout(updateRect, 350);
    return () => clearTimeout(t);
  }, [current, step]);

  useEffect(() => {
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [updateRect]);

  const handleNext = () => {
    if (current < TOUR_STEPS.length - 1) setCurrent(c => c + 1);
    else handleEnd();
  };

  const handlePrev = () => { if (current > 0) setCurrent(c => c - 1); };

  const handleRepeatChange = (val) => { setRepeatTourState(val); setTourRepeat(val); };

  const handleEnd = () => { setTourDone(); onEnd(); };

  const sharedProps = {
    step, total: TOUR_STEPS.length, current,
    onNext: handleNext, onPrev: handlePrev, onSkip: handleEnd,
    repeatTour, onRepeatChange: handleRepeatChange,
  };

  return (
    <>
      <div onClick={handleEnd} style={{ position: "fixed", inset: 0, zIndex: 1000, cursor: "default" }} />
      <Spotlight rect={rect} />
      {isMobile
        ? <MobileTour {...sharedProps} />
        : <DesktopBubble {...sharedProps} rect={rect} />
      }
    </>
  );
}
