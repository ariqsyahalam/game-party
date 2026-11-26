export const LIARS_DICE_CSS = `
.ld-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: #f8fafc;
  background:
    radial-gradient(circle at 50% 0%, rgba(120, 53, 15, 0.55) 0%, rgba(8, 12, 23, 0.95) 44%),
    radial-gradient(circle at 12% 88%, rgba(124, 58, 237, 0.18) 0%, transparent 42%),
    radial-gradient(circle at 88% 78%, rgba(239, 68, 68, 0.16) 0%, transparent 40%),
    #060913;
}

.ld-root::before {
  content: '';
  position: absolute;
  inset: 8% 6%;
  border-radius: 50%;
  border: 1px solid rgba(251, 191, 36, 0.14);
  box-shadow:
    inset 0 0 120px rgba(251, 191, 36, 0.05),
    0 0 0 22px rgba(251, 191, 36, 0.025),
    0 0 0 44px rgba(251, 191, 36, 0.018);
  pointer-events: none;
}

.ld-table {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
  padding: 70px 20px 16px;
}

.ld-players {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  align-content: start;
}

.ld-player {
  min-width: 0;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.78);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.ld-player.turn {
  transform: translateY(-2px);
  border-color: rgba(251, 191, 36, 0.9);
  background: rgba(120, 53, 15, 0.38);
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.55), 0 0 26px rgba(251, 191, 36, 0.24);
}

.ld-player.dead {
  opacity: 0.34;
  filter: grayscale(1);
}

.ld-player-top {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  font-weight: 800;
}

.ld-player-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ld-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: 0 0 auto;
  box-shadow: 0 0 10px currentColor;
}

.ld-bot {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.04em;
  color: #c4b5fd;
  background: rgba(124, 58, 237, 0.2);
  border: 1px solid rgba(124, 58, 237, 0.4);
  border-radius: 999px;
  padding: 1px 5px;
  white-space: nowrap;
}

.ld-dice-row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  margin-top: 2px;
  font-size: 24px;
  line-height: 1;
}

.ld-die {
  display: inline-block;
  color: #f8fafc;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.ld-die.hidden {
  font-size: 16px;
  opacity: 0.72;
}

.ld-die.match {
  color: #fbbf24;
  text-shadow: 0 0 14px rgba(251, 191, 36, 0.9);
}

.ld-hidden-count {
  font-size: 13px;
  font-weight: 900;
  color: #cbd5e1;
  margin-left: 2px;
}

.ld-player-meta {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 10px;
  color: #94a3b8;
  font-weight: 700;
}

.ld-center {
  align-self: center;
  justify-self: center;
  width: min(760px, 94%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 18px 24px;
  border-radius: 24px;
  border: 1px solid rgba(251, 191, 36, 0.2);
  background: rgba(8, 12, 23, 0.72);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
}

.ld-center-phase {
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.24em;
  color: #fbbf24;
}

.ld-center-bid {
  font-size: clamp(38px, 6vw, 72px);
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-shadow: 0 0 34px rgba(251, 191, 36, 0.25);
  white-space: nowrap;
}

.ld-center-sub {
  font-size: 13px;
  color: #cbd5e1;
  font-weight: 700;
  text-align: center;
}

.ld-center-turn {
  font-size: 15px;
  font-weight: 900;
  color: #f8fafc;
  text-align: center;
}

.ld-timer {
  width: min(420px, 100%);
  height: 7px;
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.9);
  overflow: hidden;
}

.ld-timer-fill {
  height: 100%;
  width: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #22c55e, #facc15 62%, #ef4444);
  transition: width 0.12s linear;
}

.ld-log {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  min-height: 42px;
  margin-top: 2px;
  font-size: 11px;
  color: #94a3b8;
  text-align: center;
}

.ld-log-line:first-child {
  color: #e2e8f0;
  font-weight: 700;
}

.ld-my-dice {
  justify-self: center;
  width: min(760px, 94%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-radius: 14px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  background: rgba(8, 47, 73, 0.44);
}

.ld-my-dice-label {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: #7dd3fc;
  white-space: nowrap;
}

.ld-my-dice-row {
  display: flex;
  gap: 4px;
  font-size: 26px;
  line-height: 1;
}

.ld-my-dice-hint {
  margin-left: auto;
  font-size: 10px;
  color: #bae6fd;
  font-weight: 700;
  text-align: right;
}

.ld-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(2, 6, 23, 0.74);
  backdrop-filter: blur(7px);
}

.ld-overlay.show {
  display: flex;
}

.ld-overlay-card {
  width: min(920px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  padding: 24px;
  border-radius: 24px;
  border: 1px solid rgba(251, 191, 36, 0.26);
  background: linear-gradient(180deg, rgba(30, 20, 10, 0.96), rgba(8, 12, 23, 0.98));
  box-shadow: 0 34px 90px rgba(0, 0, 0, 0.7);
  text-align: center;
}

.ld-overlay-title {
  font-size: clamp(34px, 6vw, 64px);
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.02em;
  color: #f8fafc;
  text-shadow: 0 0 36px rgba(251, 191, 36, 0.3);
}

.ld-overlay-sub {
  margin-top: 8px;
  font-size: 15px;
  font-weight: 700;
  color: #cbd5e1;
}

.ld-reveal-dice {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  margin-top: 16px;
}

.ld-reveal-player {
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.7);
}

.ld-reveal-player.winner {
  border-color: rgba(34, 197, 94, 0.55);
  background: rgba(20, 83, 45, 0.3);
}

.ld-reveal-player.loser {
  border-color: rgba(239, 68, 68, 0.55);
  background: rgba(127, 29, 29, 0.3);
}

.ld-reveal-player-name {
  font-size: 11px;
  font-weight: 900;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ld-reveal-player-dice {
  display: flex;
  justify-content: center;
  gap: 3px;
  margin-top: 4px;
  font-size: 26px;
  line-height: 1;
}

.ld-overlay-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.ld-overlay-actions .btn {
  min-width: 150px;
}

@media (max-width: 900px) {
  .ld-players {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .ld-table {
    padding: 64px 12px 10px;
  }
}

@media (max-width: 620px) {
  .ld-players {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .ld-center {
    padding: 12px 14px;
  }
  .ld-my-dice {
    flex-wrap: wrap;
  }
  .ld-my-dice-hint {
    width: 100%;
    margin-left: 0;
    text-align: left;
  }
}

/* Phone controller */
.ld-ctrl {
  display: grid;
  grid-template-columns: 0.9fr 1.08fr 1.02fr;
  gap: 8px;
  padding: 8px 10px;
  align-items: stretch;
}

.ld-ctrl-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.86);
}

.ld-ctrl-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #94a3b8;
}

.ld-ctrl-label {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.14em;
  color: #7dd3fc;
}

.ld-ctrl-dice {
  display: flex;
  justify-content: center;
  gap: 4px;
  font-size: clamp(34px, 7vw, 58px);
  line-height: 1;
}

.ld-ctrl-die {
  color: #f8fafc;
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
}

.ld-ctrl-die.empty {
  opacity: 0.25;
}

.ld-ctrl-meta {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  color: #cbd5e1;
}

.ld-ctrl-phase {
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.06em;
  color: #fbbf24;
  text-align: center;
}

.ld-ctrl-bid {
  font-size: clamp(26px, 5vw, 42px);
  line-height: 1;
  font-weight: 900;
  text-align: center;
  color: #f8fafc;
  white-space: nowrap;
}

.ld-ctrl-bid-sub {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-align: center;
  min-height: 15px;
}

.ld-ctrl-timer {
  height: 6px;
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.95);
  overflow: hidden;
}

.ld-ctrl-timer > div {
  height: 100%;
  width: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #22c55e, #facc15 62%, #ef4444);
  transition: width 0.12s linear;
}

.ld-ctrl-turn {
  font-size: 11px;
  font-weight: 900;
  color: #e2e8f0;
  text-align: center;
  min-height: 15px;
}

.ld-ctrl-result {
  font-size: 10px;
  font-weight: 800;
  color: #fca5a5;
  text-align: center;
  min-height: 13px;
}

.ld-ctrl-qty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 18px;
  font-weight: 900;
}

.ld-ctrl-small {
  width: 34px;
  height: 30px;
  border-radius: 9px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: #1e293b;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 900;
  cursor: pointer;
}

.ld-ctrl-small:active {
  transform: scale(0.94);
}

.ld-ctrl-face-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.ld-ctrl-face-btn {
  min-height: 36px;
  border-radius: 9px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: #0f172a;
  color: #e2e8f0;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.ld-ctrl-face-btn.selected {
  border-color: #fbbf24;
  background: rgba(120, 53, 15, 0.65);
  color: #fde68a;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.28);
}

.ld-ctrl-face-btn:active {
  transform: scale(0.95);
}

.ld-ctrl-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
}

.ld-ctrl-btn {
  width: 100%;
  min-height: 48px;
  border: none;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.05em;
  cursor: pointer;
}

.ld-ctrl-btn.bid {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: #111827;
}

.ld-ctrl-btn.challenge {
  background: linear-gradient(135deg, #7c3aed, #db2777);
  color: #ffffff;
}

.ld-ctrl-btn:disabled {
  opacity: 0.35;
  filter: grayscale(1);
  cursor: default;
}

.ld-ctrl-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.ld-ctrl-hint {
  font-size: 9px;
  line-height: 1.4;
  color: #94a3b8;
  text-align: center;
}

.ld-ctrl-valid {
  font-size: 9px;
  font-weight: 900;
  color: #4ade80;
}

.ld-ctrl-valid.invalid {
  color: #f87171;
}

@media (orientation: landscape) and (max-height: 430px) {
  .ld-ctrl {
    gap: 5px;
    padding: 5px 7px;
  }
  .ld-ctrl-panel {
    padding: 5px;
    gap: 4px;
  }
  .ld-ctrl-dice {
    font-size: clamp(26px, 6vw, 42px);
  }
  .ld-ctrl-btn {
    min-height: 38px;
    font-size: 12px;
  }
  .ld-ctrl-face-btn {
    min-height: 30px;
    font-size: 18px;
  }
  .ld-ctrl-small {
    height: 26px;
  }
}
`;
