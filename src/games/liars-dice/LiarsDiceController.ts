import { TelemetryPacket } from '../../net/BinaryProtocol';
import { TransportMode } from '../../net/HostNetworkManager';
import {
  ControllerOutput,
  ControllerViewContext,
  GameControllerView,
  bindHoldButton,
  updateTransportBadge,
} from '../../controller/GameControllerView';
import {
  LiarsViewState,
  decodeLiarsTelemetry,
  diceGlyph,
  encodeBidSteer,
  isBidHigher,
  nextValidBid,
} from './LiarsDiceState';
import { LIARS_DICE_CSS } from './LiarsDiceStyles';

/**
 * Private Liar's Dice controller.
 *
 * The host packs this player's hidden dice and public table state into that
 * player's telemetry packet. The analog steer value encodes the selected bid
 * index so no extra input fields are needed.
 */
export class LiarsDiceController implements GameControllerView {
  readonly id = 'liars-dice';

  private root: HTMLElement | null = null;
  private view: LiarsViewState | null = null;
  private wasMyTurn = false;

  private totalDice = 1;
  private selectedQty = 1;
  private selectedFace = 1;
  private bidPressed = false;
  private challengePressed = false;
  private bidPulseUntil = 0;
  private challengePulseUntil = 0;

  private statusBadgeEl: HTMLElement | null = null;
  private diceEl: HTMLElement | null = null;
  private livesEl: HTMLElement | null = null;
  private diceLeftEl: HTMLElement | null = null;
  private rankEl: HTMLElement | null = null;
  private phaseEl: HTMLElement | null = null;
  private bidEl: HTMLElement | null = null;
  private bidSubEl: HTMLElement | null = null;
  private timerFillEl: HTMLElement | null = null;
  private timerLabelEl: HTMLElement | null = null;
  private turnEl: HTMLElement | null = null;
  private resultEl: HTMLElement | null = null;
  private qtyEl: HTMLElement | null = null;
  private faceEl: HTMLElement | null = null;
  private facesEl: HTMLElement | null = null;
  private validEl: HTMLElement | null = null;
  private bidBtnEl: HTMLButtonElement | null = null;
  private challengeBtnEl: HTMLButtonElement | null = null;

  mount(container: HTMLElement, ctx: ControllerViewContext): void {
    this.root = container;
    this.view = null;
    this.wasMyTurn = false;
    this.totalDice = 1;
    this.selectedQty = 1;
    this.selectedFace = 1;
    this.bidPressed = false;
    this.challengePressed = false;
    this.bidPulseUntil = 0;
    this.challengePulseUntil = 0;

    container.innerHTML = `
      <style>${LIARS_DICE_CSS}</style>
      <div class="ctrl-gamepad ld-ctrl">
        <div class="ld-ctrl-panel">
          <div class="ld-ctrl-head">
            <span style="color:${ctx.color};">P${ctx.slot + 1}</span>
            <span id="ld-ctrl-status" class="badge-ws">Connecting...</span>
          </div>
          <div class="ld-ctrl-label">DADU KAMU</div>
          <div class="ld-ctrl-dice" id="ld-ctrl-dice">
            <span class="ld-ctrl-die empty">⚀</span>
            <span class="ld-ctrl-die empty">⚀</span>
            <span class="ld-ctrl-die empty">⚀</span>
          </div>
          <div class="ld-ctrl-meta">
            <span id="ld-ctrl-lives">3 dadu</span>
            <span id="ld-ctrl-rank">#1</span>
          </div>
          <div class="ld-ctrl-phase" id="ld-ctrl-phase">Menunggu host</div>
          <button id="ld-ctrl-fs" type="button" class="btn btn-secondary" style="margin-top:auto;padding:5px 8px;font-size:10px;">
            Fullscreen
          </button>
        </div>

        <div class="ld-ctrl-panel">
          <div class="ld-ctrl-head">
            <span>BID SAAT INI</span>
            <span id="ld-ctrl-timer-label">--</span>
          </div>
          <div class="ld-ctrl-bid" id="ld-ctrl-bid">—</div>
          <div class="ld-ctrl-bid-sub" id="ld-ctrl-bid-sub">Belum ada bid</div>
          <div class="ld-ctrl-timer"><div id="ld-ctrl-timer-fill"></div></div>
          <div class="ld-ctrl-turn" id="ld-ctrl-turn">Menunggu giliran...</div>
          <div class="ld-ctrl-result" id="ld-ctrl-result"></div>

          <div class="ld-ctrl-head" style="margin-top:auto;">
            <span>PILIH BID</span>
            <span class="ld-ctrl-valid" id="ld-ctrl-valid">—</span>
          </div>
          <div class="ld-ctrl-qty">
            <button type="button" id="ld-ctrl-qty-minus" class="ld-ctrl-small" aria-label="Kurangi jumlah">−</button>
            <span id="ld-ctrl-qty">1</span>
            <span>×</span>
            <span id="ld-ctrl-face">⚀</span>
            <button type="button" id="ld-ctrl-qty-plus" class="ld-ctrl-small" aria-label="Tambah jumlah">+</button>
          </div>
          <div class="ld-ctrl-face-grid" id="ld-ctrl-faces"></div>
        </div>

        <div class="ld-ctrl-panel">
          <div class="ld-ctrl-head">
            <span>AKSI</span>
            <span id="ld-ctrl-dice-left" style="color:#fbbf24;">3 DADU</span>
          </div>
          <div class="ld-ctrl-actions">
            <button type="button" id="ld-ctrl-bid-btn" class="ld-ctrl-btn bid" disabled>BID</button>
            <button type="button" id="ld-ctrl-challenge-btn" class="ld-ctrl-btn challenge" disabled>TANTANG!</button>
          </div>
          <div class="ld-ctrl-hint">
            Naikkan jumlah atau pilih mata dadu.<br>
            Lalu tekan BID atau TANTANG.
          </div>
        </div>
      </div>
    `;

    this.statusBadgeEl = container.querySelector('#ld-ctrl-status');
    this.diceEl = container.querySelector('#ld-ctrl-dice');
    this.livesEl = container.querySelector('#ld-ctrl-lives');
    this.diceLeftEl = container.querySelector('#ld-ctrl-dice-left');
    this.rankEl = container.querySelector('#ld-ctrl-rank');
    this.phaseEl = container.querySelector('#ld-ctrl-phase');
    this.bidEl = container.querySelector('#ld-ctrl-bid');
    this.bidSubEl = container.querySelector('#ld-ctrl-bid-sub');
    this.timerFillEl = container.querySelector('#ld-ctrl-timer-fill');
    this.timerLabelEl = container.querySelector('#ld-ctrl-timer-label');
    this.turnEl = container.querySelector('#ld-ctrl-turn');
    this.resultEl = container.querySelector('#ld-ctrl-result');
    this.qtyEl = container.querySelector('#ld-ctrl-qty');
    this.faceEl = container.querySelector('#ld-ctrl-face');
    this.facesEl = container.querySelector('#ld-ctrl-faces');
    this.validEl = container.querySelector('#ld-ctrl-valid');
    this.bidBtnEl = container.querySelector('#ld-ctrl-bid-btn');
    this.challengeBtnEl = container.querySelector('#ld-ctrl-challenge-btn');

    if (this.facesEl) this.facesEl.innerHTML = [1, 2, 3, 4, 5, 6]
      .map(
        (face) =>
          `<button type="button" class="ld-ctrl-face-btn" data-ld-face="${face}" aria-label="Mata dadu ${face}">${diceGlyph(
            face
          )}</button>`
      )
      .join('');

    bindHoldButton(
      container.querySelector('#ld-ctrl-qty-minus'),
      (pressed) => {
        if (pressed) this.changeQty(-1);
      },
      ctx.onUnlockAudio
    );
    bindHoldButton(
      container.querySelector('#ld-ctrl-qty-plus'),
      (pressed) => {
        if (pressed) this.changeQty(1);
      },
      ctx.onUnlockAudio
    );

    for (const btn of Array.from(container.querySelectorAll<HTMLElement>('[data-ld-face]'))) {
      bindHoldButton(
        btn,
        (pressed) => {
          if (pressed) this.setFace(Number(btn.dataset.ldFace || 1));
        },
        ctx.onUnlockAudio
      );
    }

    bindHoldButton(
      this.bidBtnEl,
      (pressed) => {
        this.bidPressed = pressed;
        if (pressed) this.bidPulseUntil = performance.now() + 160;
      },
      ctx.onUnlockAudio
    );
    bindHoldButton(
      this.challengeBtnEl,
      (pressed) => {
        this.challengePressed = pressed;
        if (pressed) this.challengePulseUntil = performance.now() + 160;
      },
      ctx.onUnlockAudio
    );

    container.querySelector('#ld-ctrl-fs')?.addEventListener('click', () => ctx.onToggleFullscreen());
    ctx.onBindLandscapeGuard();
    this.updateTransport(ctx.transportMode);
    this.render();
  }

  updateTransport(mode: TransportMode): void {
    updateTransportBadge(this.statusBadgeEl, mode);
  }

  updateTelemetry(t: TelemetryPacket): void {
    const view = decodeLiarsTelemetry(t);
    this.view = view;
    this.totalDice = Math.max(1, view.totalDice);

    if (view.myTurn && !this.wasMyTurn) {
      const next = nextValidBid(view.bid, this.totalDice);
      this.selectedQty = next?.qty ?? 1;
      this.selectedFace = next?.face ?? 1;
    }
    this.wasMyTurn = view.myTurn;

    this.selectedQty = Math.max(1, Math.min(this.totalDice, this.selectedQty));
    this.selectedFace = Math.max(1, Math.min(6, this.selectedFace));
    this.render();
  }

  getOutput(): ControllerOutput {
    return {
      steer: encodeBidSteer(this.selectedQty, this.selectedFace, this.totalDice),
      gas: false,
      brake: false,
      drift: false,
      item: this.bidPressed || performance.now() < this.bidPulseUntil,
      boost: this.challengePressed || performance.now() < this.challengePulseUntil,
    };
  }

  releaseAllInputs(): void {
    this.bidPressed = false;
    this.challengePressed = false;
    this.bidPulseUntil = 0;
    this.challengePulseUntil = 0;
    this.root?.querySelectorAll('.ld-ctrl-btn.pressed, .ld-ctrl-small.pressed, .ld-ctrl-face-btn.pressed').forEach((el) => {
      el.classList.remove('pressed');
    });
  }

  unmount(): void {
    this.releaseAllInputs();
    this.view = null;
    this.root = null;
  }

  private changeQty(delta: number): void {
    this.selectedQty = Math.max(1, Math.min(this.totalDice, this.selectedQty + delta));
    this.render();
  }

  private setFace(face: number): void {
    this.selectedFace = Math.max(1, Math.min(6, face));
    this.render();
  }

  private render(): void {
    const view = this.view;
    if (!view) return;

    const dice =
      view.dice.length > 0
        ? view.dice.map((d) => `<span class="ld-ctrl-die">${diceGlyph(d)}</span>`).join('')
        : '<span class="ld-ctrl-die empty">⚀</span><span class="ld-ctrl-die empty">⚀</span><span class="ld-ctrl-die empty">⚀</span>';
    if (this.diceEl) this.diceEl.innerHTML = dice;
    if (this.livesEl) this.livesEl.textContent = `${view.diceCount} dadu`;
    if (this.diceLeftEl) this.diceLeftEl.textContent = `${view.diceCount} DADU`;
    if (this.rankEl) this.rankEl.textContent = `#${view.rank}`;

    if (this.phaseEl) {
      if (view.phase === 'waiting') this.phaseEl.textContent = 'Menunggu host';
      else if (view.phase === 'countdown') this.phaseEl.textContent = 'Siap-siap...';
      else if (view.phase === 'bidding' && view.myTurn) this.phaseEl.textContent = 'GILIRAN KAMU';
      else if (view.phase === 'bidding') this.phaseEl.textContent = `Giliran P${view.turnSlot + 1}`;
      else if (view.phase === 'reveal') this.phaseEl.textContent = 'REVEAL';
      else this.phaseEl.textContent = 'MATCH OVER';
    }

    if (this.bidEl) {
      this.bidEl.innerHTML = view.bid
        ? `${view.bid.qty} × ${diceGlyph(view.bid.face)}`
        : '<span style="font-size:0.5em;color:#94a3b8;">BELUM ADA</span>';
    }
    if (this.bidSubEl) {
      this.bidSubEl.textContent = view.bid
        ? `Bid dari P${view.bid.bidderSlot + 1}`
        : 'Belum ada bid';
    }
    if (this.timerFillEl) {
      this.timerFillEl.style.width = `${Math.max(0, Math.min(100, view.turnPercent))}%`;
    }
    if (this.timerLabelEl) {
      this.timerLabelEl.textContent = view.phase === 'bidding' ? `${Math.ceil(view.turnSeconds)}s` : '--';
    }
    if (this.turnEl) {
      if (view.phase === 'bidding' && view.myTurn) this.turnEl.textContent = 'Bid atau tantang sekarang!';
      else if (view.phase === 'bidding') this.turnEl.textContent = `P${view.turnSlot + 1} sedang berpikir...`;
      else if (view.phase === 'reveal') this.turnEl.textContent = 'Lihat layar host untuk hasil.';
      else if (view.phase === 'gameover') this.turnEl.textContent = 'Permainan selesai.';
      else this.turnEl.textContent = 'Menunggu giliran...';
    }
    if (this.resultEl) {
      this.resultEl.textContent =
        view.resultCode === 1
          ? 'Bidder kalah 1 dadu'
          : view.resultCode === 2
          ? 'Challenger kalah 1 dadu'
          : '';
    }

    if (this.qtyEl) this.qtyEl.textContent = String(this.selectedQty);
    if (this.faceEl) this.faceEl.textContent = diceGlyph(this.selectedFace);
    if (this.facesEl) {
      this.facesEl.querySelectorAll<HTMLElement>('[data-ld-face]').forEach((el) => {
        el.classList.toggle('selected', Number(el.dataset.ldFace) === this.selectedFace);
      });
    }

    const canBid = view.myTurn && isBidHigher(this.selectedQty, this.selectedFace, view.bid);
    const canChallenge = view.myTurn && Boolean(view.bid);
    if (this.validEl) {
      this.validEl.textContent = !view.myTurn ? 'MENUNGGU' : canBid ? 'VALID' : 'NAIKKAN';
      this.validEl.classList.toggle('invalid', view.myTurn && !canBid);
    }
    if (this.bidBtnEl) this.bidBtnEl.disabled = !canBid;
    if (this.challengeBtnEl) this.challengeBtnEl.disabled = !canChallenge;
  }
}
