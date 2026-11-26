import { KartBlip, TelemetryPacket } from '../../net/BinaryProtocol';

export const LIARS_DICE_PER_PLAYER = 3;
export const LIARS_TURN_SECONDS = 18;
export const LIARS_COUNTDOWN_SECONDS = 3;
export const LIARS_REVEAL_SECONDS = 4.5;
export const LIARS_MAX_PLAYERS = 10;

export type LiarsPhase = 'waiting' | 'countdown' | 'bidding' | 'reveal' | 'gameover';

/** 0 = no result yet, 1 = bidder lost a die, 2 = challenger lost a die. */
export type LiarsResultCode = 0 | 1 | 2;

export interface LiarsBid {
  qty: number;
  face: number;
  bidderSlot: number;
}

export interface LiarsViewState {
  phase: LiarsPhase;
  dice: number[];
  diceCount: number;
  totalDice: number;
  bid: LiarsBid | null;
  turnSlot: number;
  turnSeconds: number;
  turnPercent: number;
  aliveCount: number;
  round: number;
  wins: number;
  rank: number;
  resultCode: LiarsResultCode;
  isAlive: boolean;
  myTurn: boolean;
  canChallenge: boolean;
}

export const DICE_GLYPHS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function diceGlyph(face: number): string {
  return DICE_GLYPHS[Math.max(0, Math.min(6, Math.round(face)))] ?? '🎲';
}

export function phaseToCode(phase: LiarsPhase): number {
  if (phase === 'waiting') return 0;
  if (phase === 'countdown') return 1;
  if (phase === 'bidding') return 2;
  if (phase === 'reveal') return 3;
  return 4;
}

export function codeToPhase(code: number): LiarsPhase {
  if (code === 1) return 'countdown';
  if (code === 2) return 'bidding';
  if (code === 3) return 'reveal';
  if (code === 4) return 'gameover';
  return 'waiting';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Packs the private controller view into the existing telemetry packet.
 *
 * No protocol change is needed: each player gets a private telemetry packet, so
 * the `karts` blips act as a small byte channel for dice, turn, bid and result.
 * Standard fields keep the controller HUD useful too.
 */
export function packLiarsTelemetry(view: LiarsViewState): TelemetryPacket {
  const dice = [0, 0, 0, 0, 0];
  for (let i = 0; i < Math.min(5, view.dice.length); i++) {
    dice[i] = clamp(Math.round(view.dice[i]), 0, 6);
  }

  const bid = view.bid;
  const flags =
    (view.isAlive ? 1 : 0) |
    (view.myTurn ? 2 : 0) |
    (view.canChallenge ? 4 : 0);

  const blips: KartBlip[] = [
    { slot: dice[0], x: dice[1], z: dice[2] },
    { slot: dice[3], x: dice[4], z: clamp(view.diceCount, 0, 255) },
    {
      slot: view.turnSlot >= 0 ? clamp(view.turnSlot, 0, 255) : 255,
      x: bid ? clamp(bid.qty, 0, 255) : 0,
      z: bid ? clamp(bid.face, 0, 255) : 0,
    },
    {
      slot: bid ? clamp(bid.bidderSlot, 0, 255) : 255,
      x: clamp(view.totalDice, 0, 255),
      z: clamp(view.aliveCount, 0, 255),
    },
    {
      slot: phaseToCode(view.phase),
      x: clamp(Math.round(view.turnSeconds * 10), 0, 255),
      z: view.resultCode,
    },
    {
      slot: clamp(view.wins, 0, 255),
      x: clamp(view.rank, 0, 255),
      z: flags,
    },
    {
      slot: clamp(view.round, 0, 255),
      x: clamp(view.diceCount, 0, 255),
      z: 0,
    },
  ];

  return {
    rank: clamp(view.rank, 1, 15),
    totalPlayers: clamp(view.aliveCount, 0, 15),
    lap: clamp(view.round, 0, 15),
    maxLaps: 15,
    speedKmh: clamp(view.diceCount, 0, 255),
    turboCharge: clamp(Math.round(view.turnPercent), 0, 100),
    turboZone: Math.min(3, phaseToCode(view.phase)),
    itemId: view.myTurn ? 1 : 0,
    fruits: clamp(view.wins, 0, 10),
    boostCooldownSec: clamp(Math.ceil(view.turnSeconds), 0, 15),
    karts: blips,
  };
}

export function decodeLiarsTelemetry(t: TelemetryPacket): LiarsViewState {
  const blips = t.karts;
  const slot = (i: number): number => blips[i]?.slot ?? 0;
  const x = (i: number): number => blips[i]?.x ?? 0;
  const z = (i: number): number => blips[i]?.z ?? 0;

  const dice = [slot(0), x(0), z(0), slot(1), x(1)].filter((d) => d >= 1 && d <= 6);
  const bidQty = x(2);
  const bidFace = z(2);
  const bidderSlot = slot(3);
  const turnSlot = slot(2);
  const flags = z(5);

  return {
    phase: codeToPhase(slot(4)),
    dice,
    diceCount: z(1) || dice.length,
    totalDice: x(3),
    bid:
      bidQty > 0 && bidFace > 0
        ? {
            qty: bidQty,
            face: bidFace,
            bidderSlot: bidderSlot === 255 ? -1 : bidderSlot,
          }
        : null,
    turnSlot: turnSlot === 255 ? -1 : turnSlot,
    turnSeconds: x(4) / 10,
    turnPercent: t.turboCharge,
    aliveCount: z(3),
    round: slot(6),
    wins: slot(5),
    rank: x(5),
    resultCode: Math.max(0, Math.min(2, z(4))) as LiarsResultCode,
    isAlive: (flags & 1) !== 0,
    myTurn: (flags & 2) !== 0,
    canChallenge: (flags & 4) !== 0,
  };
}

export function isBidHigher(qty: number, face: number, current: LiarsBid | null): boolean {
  if (!current) return qty >= 1 && face >= 1 && face <= 6;
  return qty > current.qty || (qty === current.qty && face > current.face);
}

export function nextValidBid(current: LiarsBid | null, totalDice: number): LiarsBid | null {
  if (totalDice < 1) return null;
  if (!current) return { qty: 1, face: 1, bidderSlot: -1 };
  let qty = current.qty;
  let face = current.face + 1;
  if (face > 6) {
    face = 1;
    qty += 1;
  }
  if (qty > totalDice) return null;
  return { qty, face, bidderSlot: -1 };
}

export function hasHigherBid(current: LiarsBid | null, totalDice: number): boolean {
  if (totalDice < 1) return false;
  if (!current) return true;
  return current.qty < totalDice || current.face < 6;
}

/** Normalizes a requested bid into a legal higher bid, or returns the next legal bid. */
export function normalizeBid(
  qty: number,
  face: number,
  current: LiarsBid | null,
  totalDice: number
): LiarsBid | null {
  if (totalDice < 1) return null;
  const requestedQty = clamp(Math.round(qty), 1, totalDice);
  const requestedFace = clamp(Math.round(face), 1, 6);
  if (isBidHigher(requestedQty, requestedFace, current)) {
    return { qty: requestedQty, face: requestedFace, bidderSlot: -1 };
  }
  return nextValidBid(current, totalDice);
}

/** Encodes the selected bid as the analog steer value (-1..1). */
export function encodeBidSteer(qty: number, face: number, totalDice: number): number {
  const maxIndex = Math.max(0, totalDice * 6 - 1);
  if (maxIndex === 0) return 0;
  const index = clamp((qty - 1) * 6 + (face - 1), 0, maxIndex);
  return (index / maxIndex) * 2 - 1;
}

/** Decodes the analog steer value back into a bid. */
export function decodeBidSteer(steer: number, totalDice: number): { qty: number; face: number } {
  const maxIndex = Math.max(0, totalDice * 6 - 1);
  if (maxIndex === 0) return { qty: 1, face: 1 };
  const index = clamp(Math.round(((steer + 1) / 2) * maxIndex), 0, maxIndex);
  return {
    qty: Math.floor(index / 6) + 1,
    face: (index % 6) + 1,
  };
}

/** P(X >= k) for X ~ Binomial(n, p). Used by bot challenge decisions. */
export function binomialAtLeast(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (n <= 0 || k > n) return 0;
  let below = 0;
  let term = Math.pow(1 - p, n);
  for (let i = 0; i < k; i++) {
    below += term;
    term *= ((n - i) / (i + 1)) * (p / (1 - p));
  }
  return Math.max(0, Math.min(1, 1 - below));
}
