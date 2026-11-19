/** Scoped CSS for the game (everything lives under .g-shabbos). */
export const CSS = `
.g-shabbos { font-family: 'Fredoka', 'Trebuchet MS', system-ui, sans-serif; color: #fdf6e7; background: #e7a339; }
.g-shabbos .sh-title { font-family: 'Bowlby One', 'Fredoka', sans-serif; letter-spacing: 0.5px; line-height: 1.02; }
.g-shabbos .sh-small { font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 18px; }
.g-shabbos .sh-tiny { font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 12px; }
.g-shabbos .sh-hud { background: #231c2b; border-bottom: 3px solid #231c2b; }
.g-shabbos .sh-clock { font-family: 'Bowlby One', 'Fredoka', sans-serif; font-size: 30px; line-height: 1; color: #fdf6e7; font-variant-numeric: tabular-nums; }
.g-shabbos .sh-clock.alarm { color: #ff6b5a; animation: sh-blink 0.5s steps(2) infinite; }
.g-shabbos .sh-btn { font-family: 'Bowlby One', 'Fredoka', sans-serif; background: #e2674f; color: #fdf6e7; border: 3px solid #231c2b;
  border-radius: 14px; box-shadow: 0 5px 0 #231c2b; padding: 12px 26px; font-size: 20px; letter-spacing: 0.5px; }
.g-shabbos .sh-btn:active { transform: translateY(4px); box-shadow: 0 1px 0 #231c2b; }
.g-shabbos .sh-btn.alt { background: #6fb3ad; }
.g-shabbos .sh-icon { background: #3d2c55; border: 2px solid #fdf6e7; border-radius: 10px; width: 36px; height: 32px; display: grid; place-items: center; font-size: 16px; }
.g-shabbos .sh-card { background: #3d2c55; border: 3px solid #231c2b; border-radius: 22px; box-shadow: 0 8px 0 #231c2b; }
.g-shabbos .sh-sheet { background: #3d2c55; border: 3px solid #231c2b; border-bottom: 0; border-radius: 26px 26px 0 0;
  box-shadow: 0 -6px 0 rgba(35,28,43,0.35); animation: sh-up 0.22s ease-out; }
.g-shabbos .sh-msg { font-weight: 700; font-size: 16px; min-height: 24px; text-align: center; padding: 2px 12px 6px; color: #fdf6e7; }
.g-shabbos .sh-shake { animation: sh-shake 0.35s; color: #ffb4a6; }
.g-shabbos .sh-board { background: #6fb3ad; }
.g-shabbos .sh-station { display: flex; flex-direction: column; min-height: 0; background: #3d2c55; border: 3px solid #231c2b; border-radius: 16px;
  box-shadow: 0 3px 0 #231c2b; overflow: hidden; }
.g-shabbos .sh-station > header { background: #231c2b; color: #fdf6e7; }
.g-shabbos .sh-station.done { border-color: #58b368; }
.g-shabbos .sh-station.done > header { background: #2f7a3e; }
.g-shabbos .sh-station.alert { animation: sh-alert 0.6s ease-in-out infinite; }
.g-shabbos .sh-station.alert > header { background: #b8392b; }
.g-shabbos .sh-msg-sm { font-size: 13px; min-height: 18px; padding: 2px 6px 0; line-height: 1.15; }
.g-shabbos .sh-phonestrip { background: #3d2c55; color: #fdf6e7; border: 3px solid #231c2b; border-radius: 16px; box-shadow: 0 3px 0 #231c2b; min-height: 64px; }
.g-shabbos .sh-phonestrip.ringing { background: #58b368; color: #231c2b; animation: sh-buzz 0.25s linear infinite, sh-alert 0.6s ease-in-out infinite; }
.g-shabbos .sh-phonestrip.done { background: #2f7a3e; }
.g-shabbos .sh-answer { font-family: 'Bowlby One', sans-serif; background: #231c2b; color: #fdf6e7; border-radius: 12px; padding: 8px 12px; font-size: 15px; }
.g-shabbos .sh-callcard { animation: sh-slideup 0.25s ease-out; filter: drop-shadow(0 -4px 0 rgba(35,28,43,0.45)); }
.g-shabbos .sh-callcard > div { padding: 0; }
.g-shabbos .sh-burst { transform-box: fill-box; transform-origin: center; animation: sh-burst 0.7s ease-out forwards; }
.g-shabbos .sh-pulse { animation: sh-pulse 1s ease-in-out infinite; }
.g-shabbos .sh-ring { animation: sh-ring 0.18s linear infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.g-shabbos .sh-waves { animation: sh-pulse 0.5s ease-in-out infinite; }
.g-shabbos .sh-steam { animation: sh-steam 1.2s ease-in-out infinite; }
.g-shabbos .sh-flame { animation: sh-flame 0.4s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 50% 100%; }
.g-shabbos .sh-fall-r, .g-shabbos .sh-fall-l { transform-box: fill-box; transform-origin: 50% 100%; animation: sh-fall-r 0.9s ease-in forwards; }
.g-shabbos .sh-fall-l { animation-name: sh-fall-l; }
.g-shabbos .sh-banner { background: #58b368; color: #231c2b; border: 3px solid #231c2b; border-radius: 14px; box-shadow: 0 4px 0 #231c2b; animation: sh-wiggle 0.4s ease-in-out infinite; }
.g-shabbos .sh-phone { background: #fdf6e7; color: #231c2b; border: 4px solid #231c2b; border-radius: 30px; width: 100%; max-width: 360px; flex: 1;
  display: flex; flex-direction: column; box-shadow: 0 6px 0 #231c2b; overflow: hidden; }
.g-shabbos .sh-caller { font-family: 'Bowlby One', sans-serif; font-size: 20px; }
.g-shabbos .sh-bubble { border: 3px solid #231c2b; border-radius: 18px; padding: 8px 12px; font-weight: 600; font-size: 15px; line-height: 1.25; max-width: 88%; animation: sh-pop 0.18s ease-out; }
.g-shabbos .sh-bubble-mom { background: #f7c6d0; align-self: flex-start; border-bottom-left-radius: 4px; }
.g-shabbos .sh-bubble-me { background: #9fd6cf; align-self: flex-end; border-bottom-right-radius: 4px; }
.g-shabbos .sh-reply { background: #fff; border: 3px solid #231c2b; border-radius: 14px; padding: 9px 10px; font-weight: 600; font-size: 14.5px;
  line-height: 1.2; text-align: left; box-shadow: 0 3px 0 #231c2b; color: #231c2b; }
.g-shabbos .sh-reply:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #231c2b; }
.g-shabbos .sh-reply:disabled { opacity: 0.5; }
@keyframes sh-alert { 0%,100% { border-color: #231c2b; box-shadow: 0 3px 0 #231c2b; } 50% { border-color: #ff5a3c; box-shadow: 0 0 0 3px #ff5a3c; } }
@keyframes sh-buzz { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-3px) rotate(-0.6deg); } 40% { transform: translateX(3px) rotate(0.6deg); } 60% { transform: translateX(-2px); } 80% { transform: translateX(2px); } }
@keyframes sh-slideup { from { transform: translateY(60%); opacity: 0.3; } to { transform: none; opacity: 1; } }
@keyframes sh-burst { from { transform: scale(0.6); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
@keyframes sh-blink { 50% { opacity: 0.35; } }
@keyframes sh-up { from { transform: translateY(40%); opacity: 0.4; } to { transform: none; opacity: 1; } }
@keyframes sh-shake { 0%,100% { transform: none; } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
@keyframes sh-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes sh-ring { 0% { transform: rotate(-9deg); } 50% { transform: rotate(9deg); } 100% { transform: rotate(-9deg); } }
@keyframes sh-steam { 0% { transform: translateY(6px); opacity: 0.2; } 50% { opacity: 0.9; } 100% { transform: translateY(-10px); opacity: 0; } }
@keyframes sh-flame { from { transform: scale(1, 0.92) rotate(-3deg); } to { transform: scale(0.94, 1.08) rotate(3deg); } }
@keyframes sh-fall-r { 0% { transform: none; opacity: 1; } 100% { transform: translate(140px, 260px) rotate(120deg); opacity: 0; } }
@keyframes sh-fall-l { 0% { transform: none; opacity: 1; } 100% { transform: translate(-140px, 260px) rotate(-120deg); opacity: 0; } }
@keyframes sh-wiggle { 0%,100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } }
@keyframes sh-pop { from { transform: scale(0.85); opacity: 0; } to { transform: none; opacity: 1; } }
`;
