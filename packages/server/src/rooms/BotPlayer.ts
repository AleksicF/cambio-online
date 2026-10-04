import {
  BOT_PROFILES,
  BotBrain,
  snapOpportunityKey,
  type ActionError,
  type BotDifficulty,
  type GameUpdate,
  type PlayerAction,
  type PlayerView,
} from '@cambio/shared';

/** Was ein Bot vom Raum braucht. */
export interface BotHost {
  viewFor(playerId: string): PlayerView | null;
  botAct(playerId: string, action: PlayerAction): { ok: true } | { ok: false; error: ActionError };
}

interface Pending {
  key: string;
  handle: ReturnType<typeof setTimeout>;
}

/**
 * Lässt einen Bot im Raum mitspielen: nimmt Spiel-Updates entgegen (genau wie
 * ein menschlicher Spieler) und handelt mit Bedenk- und Reaktionszeit.
 */
export class BotPlayer {
  private brain: BotBrain;
  private turn: Pending | null = null;
  private snap: Pending | null = null;

  constructor(
    readonly id: string,
    public difficulty: BotDifficulty,
    private readonly host: BotHost,
    private readonly random: () => number = Math.random,
  ) {
    this.brain = this.newBrain();
  }

  /** Neues Spiel: Gedächtnis leeren, geplante Aktionen verwerfen. */
  reset() {
    this.dispose();
    this.brain = this.newBrain();
  }

  dispose() {
    if (this.turn) clearTimeout(this.turn.handle);
    if (this.snap) clearTimeout(this.snap.handle);
    this.turn = null;
    this.snap = null;
  }

  update({ view, events }: GameUpdate) {
    this.brain.observe(events);
    this.planTurn(view);
    this.planSnap(view);
  }

  private newBrain() {
    return new BotBrain(this.id, BOT_PROFILES[this.difficulty], this.random);
  }

  /** Ein Zugschritt pro Phase – geplant, bis die Bedenkzeit um ist. */
  private planTurn(view: PlayerView) {
    if (!this.brain.needsToAct(view)) {
      if (this.turn) clearTimeout(this.turn.handle);
      this.turn = null;
      return;
    }
    const key = `${view.partieNumber}:${view.lap}:${view.currentPlayerId}:${view.phase.type}`;
    if (this.turn?.key === key) return;
    if (this.turn) clearTimeout(this.turn.handle);
    this.turn = { key, handle: setTimeout(() => this.actTurn(), this.brain.thinkDelay()) };
  }

  private actTurn() {
    this.turn = null;
    const view = this.host.viewFor(this.id);
    if (!view) return;
    const action = this.brain.decideTurn(view);
    if (!action) return;
    if (this.host.botAct(this.id, action).ok) return;
    // Sollte nicht vorkommen – zur Sicherheit einen immer gültigen Schritt machen.
    const fallback = fallbackAction(view);
    if (fallback) this.host.botAct(this.id, fallback);
  }

  private planSnap(view: PlayerView) {
    const decision = this.brain.decideSnap(view);
    if (!decision) return;
    if (this.snap) clearTimeout(this.snap.handle);
    this.snap = {
      key: decision.key,
      handle: setTimeout(() => {
        this.snap = null;
        const now = this.host.viewFor(this.id);
        // Liegt inzwischen eine andere Karte oben, wäre der Abwurf falsch – verwerfen.
        if (!now?.snapAllowed || snapOpportunityKey(now) !== decision.key) return;
        this.host.botAct(this.id, { type: 'snap', target: decision.target });
      }, decision.delayMs),
    };
  }
}

/** Ein Schritt, der in der jeweiligen Phase immer erlaubt ist. */
function fallbackAction(view: PlayerView): PlayerAction | null {
  switch (view.phase.type) {
    case 'turn':
      return view.mustCallCambio ? { type: 'callCambio' } : { type: 'drawFromDeck' };
    case 'drawn':
      return { type: 'discardDrawn' };
    case 'ability':
    case 'kingSwap':
      return { type: 'skipAbility' };
    case 'snapGive': {
      const me = view.players.find((p) => p.id === view.me);
      const slot = me?.slots.findIndex(Boolean) ?? -1;
      return slot >= 0 ? { type: 'giveCard', slot } : null;
    }
    default:
      return null;
  }
}
