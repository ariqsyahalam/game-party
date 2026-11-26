import { SpaceAudioEngine } from '../games/dogfight/SpaceAudioEngine';
import { LiarsDiceAudioEngine } from '../games/liars-dice/LiarsDiceAudioEngine';
import { DefaultAudioEngine, GameAudioEngine } from './GameAudioEngine';
import { KartAudioEngine } from './KartAudioEngine';

/**
 * Per-game audio registry.
 * Games with custom audio return their dedicated audio engine;
 * all other games (and the hub) fall back to DefaultAudioEngine.
 */
const AUDIO_FACTORIES: Record<string, () => GameAudioEngine> = {
  'nitro-kart-3d': () => new KartAudioEngine(),
  'space-dogfight-2p': () => new SpaceAudioEngine(),
  'liars-dice': () => new LiarsDiceAudioEngine(),
};

export function createAudioForGame(gameId: string | null): GameAudioEngine {
  if (gameId && AUDIO_FACTORIES[gameId]) {
    return AUDIO_FACTORIES[gameId]();
  }
  return new DefaultAudioEngine();
}
