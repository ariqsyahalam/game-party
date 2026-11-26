import { KartController } from '../games/kart/KartController';
import { PacController } from '../games/pacman/PacController';
import { SerpentController } from '../games/snake/SerpentController';
import { LiarsDiceController } from '../games/liars-dice/LiarsDiceController';
import { DefaultController } from './DefaultController';
import { GameControllerView } from './GameControllerView';

/**
 * Per-game controller registry.
 * Games with a custom controller return their dedicated controller;
 * all other games (and the hub) fall back to DefaultController (A/B/C/D + Analog/Arrow).
 */
const CONTROLLER_FACTORIES: Record<string, () => GameControllerView> = {
  'nitro-kart-3d': () => new KartController(),
  'pacman-ghost-hunt': () => new PacController(),
  'neon-serpent': () => new SerpentController(),
  'liars-dice': () => new LiarsDiceController(),
};

export function createControllerForGame(gameId: string | null): GameControllerView {
  if (gameId && CONTROLLER_FACTORIES[gameId]) {
    return CONTROLLER_FACTORIES[gameId]();
  }
  return new DefaultController();
}
