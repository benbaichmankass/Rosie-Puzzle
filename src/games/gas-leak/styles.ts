/** Styles scoped under .g-gas-leak. */
export const CSS = `
.g-gas-leak { position: fixed; inset: 0; height: 100dvh; overflow: hidden; touch-action: manipulation; user-select: none;
  -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
  background: radial-gradient(120% 80% at 50% 0%, #fff7e6 0%, #f3e3c7 60%, #e6cfa8 100%); color: #3b2f22;
  font-family: 'Fredoka', ui-rounded, system-ui, sans-serif; }
.g-gas-leak .gl-screen { height: 100%; display: flex; flex-direction: column; max-width: 480px; margin: 0 auto; }
.g-gas-leak .gl-top { display: flex; align-items: center; gap: 8px; padding: 10px 12px 6px; min-height: 48px; }
.g-gas-leak .gl-exit { background: #3b2f22; color: #fff7e6; border-color: #3b2f22; border-radius: 8px; }
.g-gas-leak .gl-top-title { flex: 1; text-align: center; font-weight: 700; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-gas-leak .gl-lvl { font-family: 'Bangers', Impact, sans-serif; letter-spacing: 1px; color: #e2574c; font-size: 19px; margin-right: 4px; }
.g-gas-leak .gl-mute { width: 38px; height: 34px; border-radius: 10px; background: #fff; border: 2px solid #3b2f22; font-size: 16px; }
.g-gas-leak .gl-board-wrap { margin-top: auto; position: relative; padding: 0 10px; display: flex; justify-content: center; flex: 0 1 auto; min-height: 0; }
.g-gas-leak .gl-board { width: 100%; max-height: calc(100dvh - 250px); border-radius: 14px; box-shadow: 0 6px 18px rgba(59,47,34,0.25); background: #fff; touch-action: none; }
.g-gas-leak .gl-panel { flex: 0 0 auto; margin-bottom: auto; display: flex; flex-direction: column; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); gap: 10px; }
.g-gas-leak .gl-hint { text-align: center; font-size: 15px; font-weight: 500; padding: 14px 6px; color: #6b5a45; min-height: 92px; display: flex; align-items: center; justify-content: center; }
.g-gas-leak .gl-controls { display: flex; flex-direction: column; gap: 8px; min-height: 92px; }
.g-gas-leak .gl-group { display: flex; align-items: center; gap: 6px; justify-content: center; }
.g-gas-leak .gl-label { width: 54px; font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #8a7558; }
.g-gas-leak .gl-ctl { width: 44px; height: 40px; border-radius: 10px; background: #fff; border: 2px solid #3b2f22; color: #3b2f22; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; box-shadow: 0 3px 0 #3b2f22; }
.g-gas-leak .gl-ctl:active { transform: translateY(2px); box-shadow: 0 1px 0 #3b2f22; }
.g-gas-leak .gl-ctl.on { background: #2f8f9d; color: #fff; }
.g-gas-leak .gl-pow.on { background: #e2574c; }
.g-gas-leak .gl-del { margin-left: 10px; color: #c0392b; }
.g-gas-leak .gl-bottom { display: flex; align-items: center; gap: 8px; }
.g-gas-leak .gl-supply { flex: 1; display: flex; gap: 3px; flex-wrap: wrap; }
.g-gas-leak .gl-fan-dot.used { opacity: 0.22; filter: grayscale(1); }
.g-gas-leak .gl-btn { font-family: 'Bangers', Impact, sans-serif; letter-spacing: 1.5px; font-size: 20px; padding: 8px 16px; border-radius: 12px;
  background: #fff; color: #3b2f22; border: 3px solid #3b2f22; box-shadow: 0 4px 0 #3b2f22; }
.g-gas-leak .gl-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 #3b2f22; }
.g-gas-leak .gl-btn:disabled { opacity: 0.4; }
.g-gas-leak .gl-btn-go { background: #5aa469; color: #fff; }
.g-gas-leak .gl-btn-run { background: #e2574c; color: #fff; font-size: 26px; padding: 8px 22px; }
.g-gas-leak .gl-btn-small { font-size: 16px; padding: 6px 10px; }
.g-gas-leak .gl-btn-big { font-size: 26px; padding: 10px 26px; }
.g-gas-leak .gl-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 0 20px 24px; text-align: center; }
.g-gas-leak .gl-title { font-family: 'Bangers', Impact, sans-serif; font-size: 58px; letter-spacing: 3px; color: #8bc34a; line-height: 1;
  -webkit-text-stroke: 2px #3b2f22; text-shadow: 3px 4px 0 #3b2f22; transform: rotate(-3deg); }
.g-gas-leak .gl-text { font-size: 16px; line-height: 1.35; max-width: 330px; }
.g-gas-leak .gl-small { font-size: 14px; color: #6b5a45; }
.g-gas-leak .gl-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.g-gas-leak .gl-mini { width: 230px; max-width: 70vw; }
.g-gas-leak .gl-levels { display: grid; grid-template-columns: repeat(6, 40px); gap: 8px; }
.g-gas-leak .gl-chip { height: 38px; border-radius: 10px; border: 2px solid #3b2f22; background: #fff; font-weight: 700; font-size: 16px; box-shadow: 0 3px 0 #3b2f22; }
.g-gas-leak .gl-chip:disabled { opacity: 0.45; box-shadow: none; font-size: 13px; }
.g-gas-leak .gl-tip { position: absolute; left: 22px; right: 22px; bottom: 12px; background: rgba(59,47,34,0.88); color: #fff7e6; border-radius: 12px; padding: 8px 12px;
  font-size: 14px; text-align: center; animation: gl-fadein 0.4s ease-out; }
.g-gas-leak .gl-card { position: absolute; left: 24px; right: 24px; top: 50%; transform: translateY(-50%); background: #fffaf0; border: 3px solid #3b2f22;
  border-radius: 16px; padding: 14px; box-shadow: 0 8px 0 #3b2f22; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; animation: gl-pop 0.35s ease-out; }
.g-gas-leak .gl-card-low { top: auto; bottom: 14px; transform: none; animation: gl-fadein 0.5s ease-out 0.6s both; }
.g-gas-leak .gl-card-win { animation: gl-pop 0.35s ease-out both; }
.g-gas-leak .gl-card-title { font-family: 'Bangers', Impact, sans-serif; font-size: 40px; letter-spacing: 2px; line-height: 1; }
.g-gas-leak .gl-good { color: #2f7d32; }
.g-gas-leak .gl-shake { animation: gl-shake 0.5s linear; }
.g-gas-leak .gl-spin { animation: gl-spin 1s linear infinite; }
.g-gas-leak .gl-spin-slow { animation: gl-spin 4s linear infinite; }
.g-gas-leak .gl-pulse { animation: gl-pulse 1s ease-in-out infinite; }
.g-gas-leak .gl-puff > g { animation: gl-puff 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.g-gas-leak .gl-ember { animation: gl-ember 1.2s ease-in-out infinite; }
.g-gas-leak .gl-smoke { animation: gl-smoke 2.4s ease-in-out infinite; }
.g-gas-leak .gl-zzz { animation: gl-zzz 2.6s ease-in-out infinite; }
.g-gas-leak .gl-hiss { animation: gl-hiss 1s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.g-gas-leak .gl-hiss-text { animation: gl-hisst 0.8s steps(2) infinite; }
.g-gas-leak .gl-exitpuff { animation: gl-exitpuff 0.9s ease-out infinite; }
.g-gas-leak .gl-timer { font-weight: 700; font-size: 20px; font-variant-numeric: tabular-nums; background: #fff; border: 3px solid #3b2f22; border-radius: 12px; padding: 6px 12px; box-shadow: 0 4px 0 #3b2f22; min-width: 104px; text-align: center; }
.g-gas-leak .gl-warn { color: #c0392b; font-weight: 700; animation: gl-pulse 0.6s ease-in-out infinite; }
.g-gas-leak .gl-pressure { animation: gl-press 0.35s ease-in-out infinite; filter: hue-rotate(-60deg) saturate(1.6); }
.g-gas-leak .gl-countdown { position: absolute; inset: 0 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; pointer-events: none; }
.g-gas-leak .gl-count { font-family: 'Bangers', Impact, sans-serif; font-size: 96px; line-height: 1; color: #8bc34a; -webkit-text-stroke: 3px #3b2f22; text-shadow: 4px 5px 0 #3b2f22; animation: gl-countpop 1s ease-out both; }
.g-gas-leak .gl-count-tip { background: rgba(59,47,34,0.88); color: #fff7e6; border-radius: 12px; padding: 8px 12px; font-size: 14px; text-align: center; max-width: 300px; }
.g-gas-leak .gl-stars { font-size: 34px; letter-spacing: 4px; color: #d8cbb5; line-height: 1; }
.g-gas-leak .gl-stars .on { color: #f2b705; text-shadow: 0 2px 0 #8a6a00; }
.g-gas-leak .gl-chip { position: relative; }
.g-gas-leak .gl-chip-stars { position: absolute; left: 0; right: 0; bottom: -2px; font-size: 8px; color: #f2b705; line-height: 1; }
.g-gas-leak .gl-nope { animation: gl-nope 1.6s ease-out both; }
.g-gas-leak .gl-boom { animation: gl-boom 0.5s cubic-bezier(.2,1.6,.4,1) both; }
.g-gas-leak .gl-boom > * { transform-box: view-box; }
.g-gas-leak .gl-wind { animation: gl-wind 1.2s linear infinite; }
.g-gas-leak .gl-swirl { animation: gl-spin 6s linear infinite; transform-box: fill-box; transform-origin: center; }
.g-gas-leak .gl-exit-open { animation: gl-nudge 1.2s ease-in-out infinite; }
.g-gas-leak .gl-spin, .g-gas-leak .gl-spin-slow { transform-origin: 0 0; }
@keyframes gl-spin { to { transform: rotate(360deg); } }
@keyframes gl-pulse { 50% { opacity: 0.35; } }
@keyframes gl-puff { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08) rotate(4deg); } }
@keyframes gl-ember { 50% { fill: #ffb347; } }
@keyframes gl-smoke { 0% { opacity: 0; transform: translateY(4px); } 40% { opacity: 0.8; } 100% { opacity: 0; transform: translateY(-6px); } }
@keyframes gl-zzz { 0% { opacity: 0; transform: translate(0, 2px); } 50% { opacity: 1; } 100% { opacity: 0; transform: translate(4px, -6px); } }
@keyframes gl-exitpuff { from { transform: translateX(0) scale(1); opacity: 0.9; } to { transform: translateX(-26px) scale(1.6); opacity: 0; } }
@keyframes gl-press { 50% { transform: scale(1.12); } }
@keyframes gl-countpop { 0% { transform: scale(2.2); opacity: 0; } 25% { transform: scale(1); opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0.2; } }
@keyframes gl-nope { 0% { opacity: 0; } 10% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
@keyframes gl-hisst { 50% { opacity: 0.2; } }
@keyframes gl-hiss { 50% { transform: scale(1.5); opacity: 0.5; } }
@keyframes gl-boom { from { opacity: 0; transform: scale(0.2); } }
@keyframes gl-wind { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
@keyframes gl-nudge { 50% { transform: translateX(-3px); } }
@keyframes gl-shake { 10%,50%,90% { transform: translate(-6px, 2px); } 30%,70% { transform: translate(6px, -2px); } }
@keyframes gl-pop { from { opacity: 0; transform: translateY(20px) scale(0.9); } }
@keyframes gl-fadein { from { opacity: 0; } }
`;
