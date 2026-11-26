import { ControllerInputState } from '../../net/BinaryProtocol';
import { BotLevel, HostSDKContext, PlatformGame, PlatformPlayer } from '../../sdk/GameSDK';
import { LiarsDiceAudioEngine } from './LiarsDiceAudioEngine';
import {
  LIARS_COUNTDOWN_SECONDS,
  LIARS_DICE_PER_PLAYER,
  LIARS_MAX_PLAYERS,
  LIARS_REVEAL_SECONDS,
  LIARS_TURN_SECONDS,
  LiarsBid,
  LiarsPhase,
  LiarsResultCode,
  LiarsViewState,
  binomialAtLeast,
  decodeBidSteer,
  diceGlyph,
  hasHigherBid,
  nextValidBid,
  normalizeBid,
  packLiarsTelemetry,
} from './LiarsDiceState';
import { LIARS_DICE_CSS } from './LiarsDiceStyles';

interface LiarsSeat {
  player: PlatformPlayer;
  diceLeft: number;
  dice: number[];
  alive: boolean;
  wins: number;
}

interface LiarsResult {
  code: LiarsResultCode;
  actual: number;
  bid: LiarsBid | null;
  loserSlot: number;
  challengerSlot: number;
}

const NEUTRAL_INPUT: ControllerInputState = {
  seq: 0,
  steer: 0,
  gas: false,
  brake: false,
  drift: false,
  item: false,
  boost: false,
  timestamp: 0,
};

const EMPTY_RESULT: LiarsResult = {
  code: 0,
  actual: 0,
  bid: null,
  loserSlot: -1,
  challengerSlot: -1,
};

const COVER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <radialGradient id="bg" cx="50%" cy="25%" r="75%">
      <stop offset="0" stop-color="#7c2d12"/>
      <stop offset="0.55" stop-color="#1e1b4b"/>
      <stop offset="1" stop-color="#060913"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fde68a"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <circle cx="320" cy="185" r="126" fill="none" stroke="#fbbf24" stroke-opacity="0.22" stroke-width="2"/>
  <circle cx="320" cy="185" r="96" fill="none" stroke="#fbbf24" stroke-opacity="0.14" stroke-width="2"/>
  <g transform="translate(186 104) rotate(-14)">
    <rect width="88" height="88" rx="18" fill="#f8fafc"/>
    <circle cx="26" cy="26" r="7" fill="#111827"/><circle cx="62" cy="26" r="7" fill="#111827"/>
    <circle cx="26" cy="62" r="7" fill="#111827"/><circle cx="62" cy="62" r="7" fill="#111827"/>
    <circle cx="44" cy="44" r="7" fill="#ef4444"/>
  </g>
  <g transform="translate(276 94) rotate(8)">
    <rect width="96" height="96" rx="20" fill="url(#gold)"/>
    <circle cx="27" cy="27" r="8" fill="#111827"/><circle cx="69" cy="27" r="8" fill="#111827"/>
    <circle cx="27" cy="69" r="8" fill="#111827"/><circle cx="69" cy="69" r="8" fill="#111827"/>
    <circle cx="48" cy="48" r="8" fill="#111827"/>
  </g>
  <g transform="translate(374 112) rotate(-6)">
    <rect width="82" height="82" rx="17" fill="#f8fafc"/>
    <circle cx="24" cy="24" r="6.5" fill="#111827"/><circle cx="58" cy="24" r="6.5" fill="#111827"/>
    <circle cx="24" cy="58" r="6.5" fill="#111827"/><circle cx="58" cy="58" r="6.5" fill="#111827"/>
    <circle cx="41" cy="41" r="6.5" fill="#ef4444"/>
  </g>
  <text x="320" y="306" text-anchor="middle" fill="#f8fafc" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="3">LIAR'S DICE</text>
  <text x="320" y="334" text-anchor="middle" fill="#c4b5fd" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="4">BLUFF • BID • CHALLENGE</text>
</svg>
`)}`;

export class LiarsDiceGame implements PlatformGame {
  readonly id = 'liars-dice';
  readonly title = "Liar's Dice";
  readonly subtitle =
    'Bid jumlah mata dadu, bluff lawan, dan tantang sebelum kehabisan dadu. Arena sosial 2-10 pemain.';
  readonly badge = '2-10 PLAYER • BLUFF';
  readonly accentColor = '#f59e0b';
  readonly coverImage = COVER_SVG;
  readonly minPlayers = 2;
  readonly maxPlayers = LIARS_MAX_PLAYERS;
  readonly controllerLayout: 'arena-dpad' = 'arena-dpad';

  private container: HTMLElement | null = null;
  private sdk: HostSDKContext | null = null;
  private audio = new LiarsDiceAudioEngine();
  private unlockAudioOnce = (): void => {
    this.audio.unlock();
  };

  private seats: LiarsSeat[] = [];
  private phase: LiarsPhase = 'waiting';
  private phaseTimer = 0;
  private turnTimer = 0;
  private turnSlot = -1;
  private round = 0;
  private currentBid: LiarsBid | null = null;
  private lastResult: LiarsResult = { ...EMPTY_RESULT };
  private revealStarter = -1;
  private botTimer = 0;

  private rafId: number | null = null;
  private lastTime = 0;
  private hudTimer = 0;
  private telemetryTimer = 0;

  private inputPrev = new Map<string, ControllerInputState>();
  private keyboardBid = { qty: 1, face: 1 };
  private logLines: string[] = [];

  private playersEl: HTMLElement | null = null;
  private roundEl: HTMLElement | null = null;
  private totalDiceEl: HTMLElement | null = null;
  private phasePillEl: HTMLElement | null = null;
  private centerPhaseEl: HTMLElement | null = null;
  private centerBidEl: HTMLElement | null = null;
  private centerSubEl: HTMLElement | null = null;
  private centerTurnEl: HTMLElement | null = null;
  private timerFillEl: HTMLElement | null = null;
  private logEl: HTMLElement | null = null;
  private myDicePanelEl: HTMLElement | null = null;
  private myDiceRowEl: HTMLElement | null = null;
  private myDiceBidEl: HTMLElement | null = null;
  private overlayEl: HTMLElement | null = null;
  private overlayTitleEl: HTMLElement | null = null;
  private overlaySubEl: HTMLElement | null = null;
  private overlayDiceEl: HTMLElement | null = null;
  private overlayActionsEl: HTMLElement | null = null;
  private muteBtnEl: HTMLButtonElement | null = null;

  mount(container: HTMLElement, sdk: HostSDKContext): void {
    this.container = container;
    this.sdk = sdk;
    this.seats = [];
    this.phase = 'waiting';
    this.phaseTimer = 0;
    this.turnTimer = 0;
    this.turnSlot = -1;
    this.round = 0;
    this.currentBid = null;
    this.lastResult = { ...EMPTY_RESULT };
    this.revealStarter = -1;
    this.botTimer = 0;
    this.inputPrev.clear();
    this.keyboardBid = { qty: 1, face: 1 };
    this.logLines = [];
    this.hudTimer = 0;
    this.telemetryTimer = 0;

    container.innerHTML = `
      <style>${LIARS_DICE_CSS}</style>
      <div class="ld-root">
        <div class="game-topbar" style="z-index:60;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button type="button" class="btn btn-danger" data-ld-action="exit">✕ Exit</button>
            <div class="hud-pill" style="color:#fbbf24;">RONDE <span id="ld-round">0</span></div>
            <div class="hud-pill" style="color:#a5b4fc;">DADU <span id="ld-total-dice">0</span></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button type="button" id="ld-mute" class="btn btn-secondary" data-ld-action="mute">🔊 Musik ON</button>
            <div class="hud-pill" id="ld-phase-pill">MENUNGGU</div>
          </div>
        </div>

        <div class="ld-table">
          <div class="ld-players" id="ld-players"></div>

          <div class="ld-center">
            <div class="ld-center-phase" id="ld-center-phase">MENUNGGU PEMAIN</div>
            <div class="ld-center-bid" id="ld-center-bid">—</div>
            <div class="ld-center-sub" id="ld-center-sub">Butuh minimal 2 pemain.</div>
            <div class="ld-center-turn" id="ld-center-turn">Tekan tombol di HP untuk mulai.</div>
            <div class="ld-timer"><div class="ld-timer-fill" id="ld-timer-fill"></div></div>
            <div class="ld-log" id="ld-log"></div>
          </div>

          <div class="ld-my-dice" id="ld-my-dice" style="display:none;">
            <div class="ld-my-dice-label">DADU KAMU • PC P1</div>
            <div class="ld-my-dice-row" id="ld-my-dice-row"></div>
            <div class="ld-my-dice-hint" id="ld-my-dice-bid">W/S qty • A/D face • E bid • Shift tantang</div>
          </div>
        </div>

        <div class="ld-overlay" id="ld-overlay">
          <div class="ld-overlay-card">
            <div class="ld-overlay-title" id="ld-overlay-title">MENUNGGU PEMAIN</div>
            <div class="ld-overlay-sub" id="ld-overlay-sub">Butuh minimal 2 pemain.</div>
            <div class="ld-reveal-dice" id="ld-overlay-dice"></div>
            <div class="ld-overlay-actions" id="ld-overlay-actions" style="display:none;">
              <button type="button" class="btn btn-primary" data-ld-action="restart">Main Lagi</button>
              <button type="button" class="btn btn-secondary" data-ld-action="exit">Keluar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.playersEl = container.querySelector('#ld-players');
    this.roundEl = container.querySelector('#ld-round');
    this.totalDiceEl = container.querySelector('#ld-total-dice');
    this.phasePillEl = container.querySelector('#ld-phase-pill');
    this.centerPhaseEl = container.querySelector('#ld-center-phase');
    this.centerBidEl = container.querySelector('#ld-center-bid');
    this.centerSubEl = container.querySelector('#ld-center-sub');
    this.centerTurnEl = container.querySelector('#ld-center-turn');
    this.timerFillEl = container.querySelector('#ld-timer-fill');
    this.logEl = container.querySelector('#ld-log');
    this.myDicePanelEl = container.querySelector('#ld-my-dice');
    this.myDiceRowEl = container.querySelector('#ld-my-dice-row');
    this.myDiceBidEl = container.querySelector('#ld-my-dice-bid');
    this.overlayEl = container.querySelector('#ld-overlay');
    this.overlayTitleEl = container.querySelector('#ld-overlay-title');
    this.overlaySubEl = container.querySelector('#ld-overlay-sub');
    this.overlayDiceEl = container.querySelector('#ld-overlay-dice');
    this.overlayActionsEl = container.querySelector('#ld-overlay-actions');
    this.muteBtnEl = container.querySelector('#ld-mute');

    container.addEventListener('click', this.handleClick);
    this.audio.unlock();
    window.addEventListener('pointerdown', this.unlockAudioOnce, { once: true });
    window.addEventListener('keydown', this.unlockAudioOnce, { once: true });

    this.syncPlayers();
    this.renderHud();
    this.updateMuteButton();

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  unmount(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('pointerdown', this.unlockAudioOnce);
    window.removeEventListener('keydown', this.unlockAudioOnce);
    this.container?.removeEventListener('click', this.handleClick);
    this.audio.destroy();
    this.seats = [];
    this.inputPrev.clear();
    this.logLines = [];
    this.currentBid = null;
    this.lastResult = { ...EMPTY_RESULT };
    if (this.container) this.container.innerHTML = '';
    this.container = null;
    this.sdk = null;
  }

  private handleClick = (event: MouseEvent): void => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-ld-action]');
    if (!target) return;
    const action = target.dataset.ldAction;
    if (action === 'exit') {
      this.sdk?.exitToHub();
    } else if (action === 'restart') {
      this.startMatch();
    } else if (action === 'mute') {
      this.audio.unlock();
      this.audio.setMuted(!this.audio.isMuted());
      this.updateMuteButton();
    }
  };

  private loop = (now: number): void => {
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.syncPlayers();
    this.pollInputs();

    if (this.phase === 'countdown') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.beginBidding();
    } else if (this.phase === 'bidding') {
      this.turnTimer -= dt;
      const seat = this.currentSeat();
      if (seat?.player.isBot) {
        this.botTimer -= dt;
        if (this.botTimer <= 0) this.runBot(seat);
      }
      if (this.phase === 'bidding' && this.turnTimer <= 0) this.timeoutAction();
    } else if (this.phase === 'reveal') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.nextRound();
    }

    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.renderHud();
    }

    this.telemetryTimer += dt;
    if (this.telemetryTimer >= 1 / 15) {
      this.telemetryTimer = 0;
      this.sendTelemetry();
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private syncPlayers(): boolean {
    const live = this.sdk?.getPlayers() ?? [];
    const liveIds = new Set(live.map((p) => p.id));
    const before = this.seats.length;
    let changed = false;

    this.seats = this.seats.filter((seat) => liveIds.has(seat.player.id));
    if (this.seats.length !== before) changed = true;

    for (const player of live) {
      const existing = this.seats.find((seat) => seat.player.id === player.id);
      if (existing) {
        if (
          existing.player.slot !== player.slot ||
          existing.player.name !== player.name ||
          existing.player.color !== player.color
        ) {
          changed = true;
        }
        existing.player = player;
      } else {
        this.seats.push({
          player,
          diceLeft: LIARS_DICE_PER_PLAYER,
          dice: [],
          alive: true,
          wins: 0,
        });
        changed = true;
      }
    }
    this.seats.sort((a, b) => a.player.slot - b.player.slot);

    if (!changed) return false;

    if (this.phase === 'waiting') {
      if (this.seats.length >= 2) this.startMatch();
    } else if (this.phase !== 'gameover') {
      this.pushLog('Roster berubah — match baru dimulai.');
      if (this.seats.length >= 2) this.startMatch();
      else this.resetWaiting();
    } else if (this.seats.length < 2) {
      this.resetWaiting();
    }

    return true;
  }

  private startMatch(): void {
    if (this.seats.length < 2) {
      this.resetWaiting();
      return;
    }
    this.round = 0;
    this.currentBid = null;
    this.lastResult = { ...EMPTY_RESULT };
    this.revealStarter = -1;
    this.logLines = [];
    for (const seat of this.seats) {
      seat.diceLeft = LIARS_DICE_PER_PLAYER;
      seat.alive = true;
      seat.wins = 0;
      seat.dice = [];
    }
    this.pushLog('Match dimulai. Kalahkan semua lawan untuk jadi champion!');
    this.startRound(this.seats[0].player.slot);
  }

  private startRound(starterSlot: number): void {
    if (this.seats.length < 2) {
      this.resetWaiting();
      return;
    }
    this.round += 1;
    this.phase = 'countdown';
    this.phaseTimer = LIARS_COUNTDOWN_SECONDS;
    this.currentBid = null;
    this.lastResult = { ...EMPTY_RESULT };
    this.revealStarter = -1;
    this.turnSlot = starterSlot;
    this.turnTimer = LIARS_TURN_SECONDS;
    this.botTimer = 0;

    for (const seat of this.seats) {
      seat.dice = seat.alive ? this.rollDice(seat.diceLeft) : [];
    }
    this.keyboardBid = this.nextKeyboardBid();
    this.audio.playRoll();
    this.pushLog(`Ronde ${this.round} — ${this.nameOf(starterSlot)} membuka bidding.`);
  }

  private beginBidding(): void {
    this.phase = 'bidding';
    this.turnTimer = LIARS_TURN_SECONDS;
    const seat = this.currentSeat();
    this.botTimer = seat?.player.isBot ? 0.65 + Math.random() * 0.7 : 0;
    this.keyboardBid = this.nextKeyboardBid();
    this.pushLog('Bidding dibuka. Bid lebih tinggi atau tantang bid sebelumnya.');
  }

  private advanceTurn(): void {
    const alive = this.aliveSeats();
    if (alive.length <= 1) {
      this.endGame();
      return;
    }
    const index = alive.findIndex((seat) => seat.player.slot === this.turnSlot);
    const next = index >= 0 ? alive[(index + 1) % alive.length] : alive[0];
    this.turnSlot = next.player.slot;
    this.turnTimer = LIARS_TURN_SECONDS;
    this.botTimer = next.player.isBot ? 0.65 + Math.random() * 0.7 : 0;
    this.keyboardBid = this.nextKeyboardBid();
  }

  private processBid(qty: number, face: number): void {
    if (this.phase !== 'bidding') return;
    const bidder = this.currentSeat();
    const totalDice = this.totalDice();
    if (!bidder || totalDice < 1) return;

    const normalized = normalizeBid(qty, face, this.currentBid, totalDice);
    if (!normalized || !hasHigherBid(this.currentBid, totalDice)) {
      this.pushLog('Tidak ada bid lebih tinggi — tantang lawan!');
      return;
    }
    if (!this.isBidHigher(normalized)) {
      this.pushLog('Bid harus lebih tinggi dari bid sebelumnya.');
      return;
    }

    this.currentBid = {
      qty: normalized.qty,
      face: normalized.face,
      bidderSlot: bidder.player.slot,
    };
    this.audio.playBid();
    this.pushLog(
      `${bidder.player.name} bid ${normalized.qty} × ${diceGlyph(normalized.face)}.`
    );
    this.advanceTurn();
  }

  private processChallenge(): void {
    if (this.phase !== 'bidding' || !this.currentBid) return;
    const challenger = this.currentSeat();
    const bid = this.currentBid;
    const bidder = this.seats.find((seat) => seat.player.slot === bid.bidderSlot);
    if (!challenger || !bidder) return;

    const actual = this.aliveSeats().reduce(
      (sum, seat) => sum + seat.dice.filter((die) => die === bid.face).length,
      0
    );
    const bidderWins = actual >= bid.qty;
    const loser = bidderWins ? challenger : bidder;
    const winner = bidderWins ? bidder : challenger;

    loser.diceLeft = Math.max(0, loser.diceLeft - 1);
    if (loser.diceLeft <= 0) loser.alive = false;
    winner.wins += 1;

    this.lastResult = {
      code: bidderWins ? 2 : 1,
      actual,
      bid,
      loserSlot: loser.player.slot,
      challengerSlot: challenger.player.slot,
    };
    this.phase = 'reveal';
    this.phaseTimer = LIARS_REVEAL_SECONDS;
    this.turnSlot = -1;
    this.turnTimer = 0;
    this.botTimer = 0;
    this.revealStarter = loser.player.slot;

    this.audio.playChallenge();
    this.audio.playReveal(!bidderWins);
    if (!loser.alive) this.audio.playEliminated();
    this.sdk?.sendVibrate(loser.player.id, [160, 60, 160]);
    this.sdk?.sendVibrate(winner.player.id, [40, 20, 40]);

    const verdict = bidderWins ? 'BID BENAR' : 'BID SALAH';
    this.pushLog(
      `${challenger.player.name} menantang ${bid.qty} × ${diceGlyph(bid.face)} — ${verdict}, aktual ${actual}. ${loser.player.name} kehilangan 1 dadu.`
    );
  }

  private nextRound(): void {
    const alive = this.aliveSeats();
    if (alive.length <= 1) {
      this.endGame();
      return;
    }
    const sorted = [...alive].sort((a, b) => a.player.slot - b.player.slot);
    let starter = sorted.find((seat) => seat.player.slot === this.revealStarter);
    if (!starter) {
      starter = sorted.find((seat) => seat.player.slot > this.revealStarter) ?? sorted[0];
    }
    this.startRound(starter.player.slot);
  }

  private endGame(): void {
    const winner = this.aliveSeats()[0] ?? null;
    this.phase = 'gameover';
    this.turnSlot = -1;
    this.turnTimer = 0;
    this.botTimer = 0;
    this.phaseTimer = 0;
    if (winner) {
      winner.wins += 1;
      this.audio.playWin();
      this.sdk?.sendVibrate('*', [80, 40, 80]);
      this.pushLog(`${winner.player.name} adalah Liar's Dice CHAMPION!`);
    } else {
      this.pushLog('Tidak ada pemenang.');
    }
  }

  private resetWaiting(): void {
    this.phase = 'waiting';
    this.phaseTimer = 0;
    this.turnTimer = 0;
    this.turnSlot = -1;
    this.round = 0;
    this.currentBid = null;
    this.lastResult = { ...EMPTY_RESULT };
    this.revealStarter = -1;
    this.botTimer = 0;
    for (const seat of this.seats) {
      seat.diceLeft = LIARS_DICE_PER_PLAYER;
      seat.dice = [];
      seat.alive = true;
      seat.wins = 0;
    }
  }

  private timeoutAction(): void {
    if (this.phase !== 'bidding') return;
    if (this.currentBid) {
      this.pushLog(`${this.nameOf(this.turnSlot)} kehabisan waktu — otomatis tantang.`);
      this.processChallenge();
    } else {
      this.pushLog(`${this.nameOf(this.turnSlot)} kehabisan waktu — bid 1 × ⚀.`);
      this.processBid(1, 1);
    }
  }

  private runBot(seat: LiarsSeat): void {
    if (this.phase !== 'bidding' || seat.player.slot !== this.turnSlot) return;
    const totalDice = this.totalDice();
    const bid = this.currentBid;
    const own = seat.dice;
    const level = seat.player.botLevel ?? 'medium';
    const threshold = this.botChallengeThreshold(level);

    if (bid) {
      const ownCount = own.filter((die) => die === bid.face).length;
      const unknown = Math.max(0, totalDice - own.length);
      const probability = binomialAtLeast(bid.qty - ownCount, unknown, 1 / 6);
      if (probability < threshold || !hasHigherBid(bid, totalDice)) {
        this.processChallenge();
        return;
      }
    }

    let face = 1;
    let bestCount = -1;
    for (let f = 1; f <= 6; f++) {
      const count = own.filter((die) => die === f).length + Math.random() * 0.2;
      if (count > bestCount) {
        bestCount = count;
        face = f;
      }
    }

    const aggression = this.botAggression(level);
    const unknown = Math.max(0, totalDice - own.length);
    let qty = Math.max(1, Math.ceil(bestCount + (unknown / 6) * aggression));
    if (bid) {
      qty = Math.max(qty, bid.qty + (bid.face < 6 ? 0 : 1));
    }
    if (qty > totalDice) {
      if (bid) {
        this.processChallenge();
        return;
      }
      qty = 1;
    }

    const candidate = normalizeBid(qty, face, bid, totalDice);
    if (!candidate || !this.isBidHigher(candidate)) {
      if (bid) this.processChallenge();
      return;
    }
    this.processBid(candidate.qty, candidate.face);
  }

  private botChallengeThreshold(level: BotLevel): number {
    if (level === 'easy') return 0.16;
    if (level === 'hard') return 0.44;
    if (level === 'god') return 0.58;
    return 0.3;
  }

  private botAggression(level: BotLevel): number {
    if (level === 'easy') return 0.25;
    if (level === 'hard') return 0.95;
    if (level === 'god') return 1.2;
    return 0.6;
  }

  private pollInputs(): void {
    const edges = new Map<string, { item: boolean; boost: boolean }>();
    const snapshots = new Map<string, ControllerInputState>();

    for (const seat of this.seats) {
      const input = this.sdk?.getInput(seat.player.id);
      if (!input) {
        this.inputPrev.delete(seat.player.id);
        continue;
      }
      const prev = this.inputPrev.get(seat.player.id) ?? NEUTRAL_INPUT;
      edges.set(seat.player.id, {
        item: input.item && !prev.item,
        boost: input.boost && !prev.boost,
      });
      snapshots.set(seat.player.id, input);
      if (seat.player.id === 'local_p1' && seat.alive) {
        this.handleKeyboardSelection(input, prev);
      }
      this.inputPrev.set(seat.player.id, { ...input });
    }

    if (this.phase !== 'bidding') return;
    const current = this.currentSeat();
    if (!current) return;
    const edge = edges.get(current.player.id);
    if (!edge) return;

    if (edge.item) {
      if (current.player.id === 'local_p1') {
        this.processBid(this.keyboardBid.qty, this.keyboardBid.face);
      } else {
        const input = snapshots.get(current.player.id);
        const selection = decodeBidSteer(input?.steer ?? 0, this.totalDice());
        this.processBid(selection.qty, selection.face);
      }
    } else if (edge.boost) {
      this.processChallenge();
    }
  }

  private handleKeyboardSelection(input: ControllerInputState, prev: ControllerInputState): void {
    const maxQty = Math.max(1, this.totalDice());
    if (input.gas && !prev.gas) {
      this.keyboardBid.qty = Math.min(maxQty, this.keyboardBid.qty + 1);
    }
    if (input.brake && !prev.brake) {
      this.keyboardBid.qty = Math.max(1, this.keyboardBid.qty - 1);
    }
    if (input.steer < -0.28 && !(prev.steer < -0.28)) {
      this.keyboardBid.face = this.keyboardBid.face <= 1 ? 6 : this.keyboardBid.face - 1;
    }
    if (input.steer > 0.28 && !(prev.steer > 0.28)) {
      this.keyboardBid.face = this.keyboardBid.face >= 6 ? 1 : this.keyboardBid.face + 1;
    }
    this.keyboardBid.qty = Math.max(1, Math.min(maxQty, this.keyboardBid.qty));
  }

  private sendTelemetry(): void {
    if (!this.sdk) return;
    const alive = this.aliveSeats();
    const totalDice = this.totalDice();
    const sorted = [...this.seats].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (a.diceLeft !== b.diceLeft) return b.diceLeft - a.diceLeft;
      return b.wins - a.wins;
    });

    for (const seat of this.seats) {
      const myTurn = this.phase === 'bidding' && seat.player.slot === this.turnSlot;
      const view: LiarsViewState = {
        phase: this.phase,
        dice: seat.dice,
        diceCount: seat.dice.length,
        totalDice,
        bid: this.currentBid,
        turnSlot: this.turnSlot,
        turnSeconds: this.phase === 'bidding' ? Math.max(0, this.turnTimer) : 0,
        turnPercent:
          this.phase === 'bidding'
            ? Math.max(0, Math.min(100, (this.turnTimer / LIARS_TURN_SECONDS) * 100))
            : 0,
        aliveCount: alive.length,
        round: this.round,
        wins: seat.wins,
        rank: sorted.indexOf(seat) + 1,
        resultCode: this.lastResult.code,
        isAlive: seat.alive,
        myTurn,
        canChallenge: myTurn && Boolean(this.currentBid),
      };
      this.sdk.sendTelemetry(seat.player.id, packLiarsTelemetry(view));
    }
  }

  private renderHud(): void {
    const totalDice = this.totalDice();
    if (this.roundEl) this.roundEl.textContent = String(this.round);
    if (this.totalDiceEl) this.totalDiceEl.textContent = String(totalDice);
    if (this.phasePillEl) {
      this.phasePillEl.textContent =
        this.phase === 'waiting'
          ? 'MENUNGGU'
          : this.phase === 'countdown'
          ? 'SIAP'
          : this.phase === 'bidding'
          ? 'BIDDING'
          : this.phase === 'reveal'
          ? 'REVEAL'
          : 'SELESAI';
    }

    this.renderPlayers();
    this.renderCenter();
    this.renderLocalDice();
    this.renderOverlay();
    this.updateMuteButton();
  }

  private renderPlayers(): void {
    if (!this.playersEl) return;
    const reveal = this.phase === 'reveal' || this.phase === 'gameover';
    this.playersEl.innerHTML = this.seats
      .map((seat) => {
        const turn = this.phase === 'bidding' && seat.player.slot === this.turnSlot;
        const dice =
          !seat.alive
            ? '<span class="ld-die hidden">💀</span>'
            : reveal
            ? seat.dice
                .map(
                  (die) =>
                    `<span class="ld-die ${
                      this.currentBid && die === this.currentBid.face ? 'match' : ''
                    }">${diceGlyph(die)}</span>`
                )
                .join('')
            : `<span class="ld-die hidden">🎲</span><span class="ld-hidden-count">×${seat.diceLeft}</span>`;

        const color = this.safeColor(seat.player.color);
        return `
          <div class="ld-player ${turn ? 'turn' : ''} ${seat.alive ? '' : 'dead'}">
            <div class="ld-player-top">
              <span class="ld-dot" style="background:${color};color:${color};"></span>
              <span class="ld-player-name">${this.escapeHtml(seat.player.name)}</span>
              ${seat.player.isBot ? `<span class="ld-bot">AI${seat.player.botLevel ? ` • ${seat.player.botLevel}` : ''}</span>` : ''}
            </div>
            <div class="ld-dice-row">${dice}</div>
            <div class="ld-player-meta">
              <span>${seat.diceLeft} dadu</span>
              <span>${seat.wins} menang</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  private renderCenter(): void {
    if (this.centerPhaseEl) {
      this.centerPhaseEl.textContent =
        this.phase === 'waiting'
          ? 'MENUNGGU PEMAIN'
          : this.phase === 'countdown'
          ? 'DADU DIKOCOK'
          : this.phase === 'bidding'
          ? 'BIDDING'
          : this.phase === 'reveal'
          ? 'REVEAL'
          : 'MATCH OVER';
    }
    if (this.centerBidEl) {
      this.centerBidEl.innerHTML = this.currentBid
        ? `${this.currentBid.qty} × <span style="color:#fbbf24;">${diceGlyph(this.currentBid.face)}</span>`
        : '<span style="font-size:0.45em;color:#94a3b8;">BELUM ADA BID</span>';
    }
    if (this.centerSubEl) {
      this.centerSubEl.textContent = this.currentBid
        ? `Bid dari ${this.nameOf(this.currentBid.bidderSlot)}`
        : this.phase === 'waiting'
        ? 'Butuh minimal 2 pemain.'
        : 'Belum ada bid.';
    }
    if (this.centerTurnEl) {
      if (this.phase === 'bidding') {
        const seat = this.currentSeat();
        this.centerTurnEl.textContent = seat
          ? `Giliran ${seat.player.name} — ${Math.ceil(Math.max(0, this.turnTimer))}s`
          : 'Menunggu pemain...';
      } else if (this.phase === 'reveal') {
        this.centerTurnEl.textContent = `Bid ${this.lastResult.bid?.qty ?? 0} × ${diceGlyph(
          this.lastResult.bid?.face ?? 0
        )} • aktual ${this.lastResult.actual} • ${this.nameOf(this.lastResult.loserSlot)} kehilangan 1 dadu.`;
      } else if (this.phase === 'gameover') {
        this.centerTurnEl.textContent = 'Lihat layar hasil untuk champion.';
      } else {
        this.centerTurnEl.textContent = 'Dadu dikocok ulang setiap ronde.';
      }
    }
    if (this.timerFillEl) {
      const pct =
        this.phase === 'bidding'
          ? Math.max(0, Math.min(100, (this.turnTimer / LIARS_TURN_SECONDS) * 100))
          : 0;
      this.timerFillEl.style.width = `${pct}%`;
    }
    if (this.logEl) {
      this.logEl.innerHTML = '';
      for (const line of this.logLines.slice(0, 4)) {
        const row = document.createElement('div');
        row.className = 'ld-log-line';
        row.textContent = line;
        this.logEl.appendChild(row);
      }
    }
  }

  private renderLocalDice(): void {
    const seat = this.seats.find((s) => s.player.id === 'local_p1');
    if (!this.myDicePanelEl) return;
    if (!seat) {
      this.myDicePanelEl.style.display = 'none';
      return;
    }
    this.myDicePanelEl.style.display = 'flex';
    if (this.myDiceRowEl) {
      this.myDiceRowEl.innerHTML = seat.alive
        ? seat.dice.map((die) => `<span class="ld-die">${diceGlyph(die)}</span>`).join('')
        : '<span class="ld-die hidden">💀</span>';
    }
    if (this.myDiceBidEl) {
      this.myDiceBidEl.textContent = seat.alive
        ? `Bid pilihan: ${this.keyboardBid.qty} × ${diceGlyph(this.keyboardBid.face)} • W/S qty • A/D face • E bid • Shift tantang`
        : 'Kamu sudah tereliminasi.';
    }
  }

  private renderOverlay(): void {
    if (!this.overlayEl) return;
    let show = false;
    let diceHtml = '';
    let actions = false;

    if (this.phase === 'waiting') {
      show = true;
      if (this.overlayTitleEl) this.overlayTitleEl.textContent = 'MENUNGGU PEMAIN';
      if (this.overlaySubEl) {
        this.overlaySubEl.textContent = `${this.seats.length}/2 pemain • butuh minimal 2 untuk mulai.`;
      }
    } else if (this.phase === 'countdown') {
      show = true;
      if (this.overlayTitleEl) {
        this.overlayTitleEl.textContent = String(Math.max(1, Math.ceil(this.phaseTimer)));
      }
      if (this.overlaySubEl) this.overlaySubEl.textContent = 'Dadu dikocok...';
    } else if (this.phase === 'reveal') {
      show = true;
      const bid = this.lastResult.bid;
      const bidderWins = this.lastResult.code === 2;
      if (this.overlayTitleEl) {
        this.overlayTitleEl.textContent = bidderWins ? 'BID BENAR' : 'BID SALAH';
      }
      if (this.overlaySubEl) {
        this.overlaySubEl.textContent = bid
          ? `Bid ${bid.qty} × ${diceGlyph(bid.face)} • aktual ${this.lastResult.actual} • ${this.nameOf(
              this.lastResult.loserSlot
            )} kehilangan 1 dadu.`
          : '';
      }
      diceHtml = this.revealDiceHtml();
    } else if (this.phase === 'gameover') {
      show = true;
      actions = true;
      const winner = this.aliveSeats()[0];
      if (this.overlayTitleEl) this.overlayTitleEl.textContent = 'CHAMPION';
      if (this.overlaySubEl) {
        this.overlaySubEl.textContent = winner
          ? `${winner.player.name} adalah Liar's Dice champion!`
          : 'Permainan selesai.';
      }
      diceHtml = this.revealDiceHtml();
    }

    this.overlayEl.classList.toggle('show', show);
    if (this.overlayDiceEl) this.overlayDiceEl.innerHTML = diceHtml;
    if (this.overlayActionsEl) this.overlayActionsEl.style.display = actions ? 'flex' : 'none';
  }

  private revealDiceHtml(): string {
    const bidFace = this.lastResult.bid?.face ?? this.currentBid?.face ?? 0;
    return this.seats
      .filter((seat) => seat.dice.length > 0)
      .map((seat) => {
        const isLoser = seat.player.slot === this.lastResult.loserSlot;
        const dice = seat.dice
          .map(
            (die) =>
              `<span class="ld-die ${die === bidFace ? 'match' : ''}">${diceGlyph(die)}</span>`
          )
          .join('');
        return `
          <div class="ld-reveal-player ${isLoser ? 'loser' : 'winner'}">
            <div class="ld-reveal-player-name">${this.escapeHtml(seat.player.name)}</div>
            <div class="ld-reveal-player-dice">${dice || '—'}</div>
          </div>
        `;
      })
      .join('');
  }

  private updateMuteButton(): void {
    if (!this.muteBtnEl) return;
    const muted = this.audio.isMuted();
    this.muteBtnEl.textContent = muted ? '🔇 Musik OFF' : '🔊 Musik ON';
    this.muteBtnEl.className = `btn ${muted ? 'btn-danger' : 'btn-secondary'}`;
  }

  private currentSeat(): LiarsSeat | null {
    return this.seats.find((seat) => seat.player.slot === this.turnSlot && seat.alive) ?? null;
  }

  private aliveSeats(): LiarsSeat[] {
    return this.seats.filter((seat) => seat.alive);
  }

  private totalDice(): number {
    return this.aliveSeats().reduce((sum, seat) => sum + seat.dice.length, 0);
  }

  private nextKeyboardBid(): { qty: number; face: number } {
    const next = nextValidBid(this.currentBid, this.totalDice());
    return { qty: next?.qty ?? 1, face: next?.face ?? 1 };
  }

  private isBidHigher(candidate: LiarsBid): boolean {
    if (!this.currentBid) return true;
    return (
      candidate.qty > this.currentBid.qty ||
      (candidate.qty === this.currentBid.qty && candidate.face > this.currentBid.face)
    );
  }

  private rollDice(count: number): number[] {
    return Array.from({ length: Math.max(0, count) }, () => 1 + Math.floor(Math.random() * 6));
  }

  private nameOf(slot: number): string {
    return this.seats.find((seat) => seat.player.slot === slot)?.player.name ?? `P${slot + 1}`;
  }

  private pushLog(line: string): void {
    this.logLines.unshift(line);
    this.logLines = this.logLines.slice(0, 6);
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      if (char === '&') return '&amp;';
      if (char === '<') return '&lt;';
      if (char === '>') return '&gt;';
      if (char === '"') return '&quot;';
      return '&#39;';
    });
  }

  private safeColor(value: string): string {
    return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '#94a3b8';
  }
}
