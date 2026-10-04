import { createDeck, isRed, sameRank, shuffle, type Card } from '../cards';
import type { GameSettings } from '../settings';
import { lowest, scorePartie } from './scoring';
import type {
  Ability,
  ActionResult,
  AudiencedEvent,
  GameError,
  GameEvent,
  GameState,
  Phase,
  PlayerAction,
  PlayerState,
  SlotRef,
  SystemAction,
} from './types';

/**
 * Spiel-Engine: reine Funktionen, die aus Zustand + Aktion einen neuen Zustand
 * und eine Liste von Ereignissen berechnen. Timer laufen nicht hier, sondern im
 * Server, der dafür SystemActions auslöst. Regeln: docs/RULES.md.
 */

export type Random = () => number;

export const INITIAL_CARDS = 4;
/** Slots, die zu Beginn angesehen werden dürfen (die unteren beiden im 2×2-Raster). */
export const INITIAL_PEEK_SLOTS = [2, 3] as const;

interface Ctx {
  events: AudiencedEvent[];
  random: Random;
}

const toAll = (event: GameEvent): AudiencedEvent => ({ audience: { to: 'all' }, event });

/** Ereignis mit Karte nur für einen Spieler, ohne Karte für alle anderen. */
function emitPrivate(ctx: Ctx, playerId: string, withCard: GameEvent, withoutCard: GameEvent) {
  ctx.events.push(
    { audience: { to: 'only', playerId }, event: withCard },
    { audience: { to: 'except', playerId }, event: withoutCard },
  );
}

// ---------------------------------------------------------------------------
// Spielstart

export function createGame(
  players: { id: string; name: string }[],
  settings: GameSettings,
  random: Random = Math.random,
): { state: GameState; events: AudiencedEvent[] } {
  if (players.length < 2 || players.length > settings.maxPlayers) {
    throw new Error(`Ungültige Spieleranzahl: ${players.length}`);
  }
  const state: GameState = {
    settings,
    players: players.map((p) => ({ ...p, slots: [], errorCount: 0, totalScore: 0 })),
    drawPile: [],
    discardPile: [],
    phase: { type: 'initialPeek' },
    currentPlayerIndex: 0,
    startingPlayerIndex: 0,
    lap: 1,
    partieNumber: 0,
    cambioCallerId: null,
    snapOpen: false,
    snapTaken: false,
    finalTurnsLeft: 0,
    results: [],
  };
  const ctx: Ctx = { events: [], random };
  startPartie(state, ctx);
  return { state, events: ctx.events };
}

function startPartie(s: GameState, ctx: Ctx) {
  s.partieNumber++;
  s.startingPlayerIndex =
    s.partieNumber === 1
      ? Math.floor(ctx.random() * s.players.length)
      : (s.startingPlayerIndex + 1) % s.players.length;
  s.currentPlayerIndex = s.startingPlayerIndex;
  s.lap = 1;
  s.cambioCallerId = null;
  s.snapOpen = false;
  s.snapTaken = false;
  s.finalTurnsLeft = 0;

  const deck = shuffle(createDeck(), ctx.random);
  for (const p of s.players) {
    p.slots = deck.splice(-INITIAL_CARDS);
    p.errorCount = 0;
  }
  s.discardPile = [deck.pop()!];
  s.drawPile = deck;
  s.phase = { type: 'initialPeek' };

  ctx.events.push(
    toAll({
      type: 'partieStarted',
      partieNumber: s.partieNumber,
      startingPlayerId: s.players[s.startingPlayerIndex]!.id,
    }),
  );
  for (const p of s.players) {
    for (const slot of INITIAL_PEEK_SLOTS) {
      const target = { playerId: p.id, slot };
      emitPrivate(
        ctx,
        p.id,
        { type: 'cardPeeked', viewerId: p.id, target, card: p.slots[slot]! },
        { type: 'cardPeeked', viewerId: p.id, target },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Öffentliche Einstiegspunkte

export function applyAction(
  state: GameState,
  playerId: string,
  action: PlayerAction,
  random: Random = Math.random,
): ActionResult {
  const s = clone(state);
  const ctx: Ctx = { events: [], random };
  const player = s.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, error: 'unknownPlayer' };
  const error = handlePlayerAction(s, player, action, ctx);
  return error ? { ok: false, error } : { ok: true, state: s, events: ctx.events };
}

export function applySystemAction(
  state: GameState,
  action: SystemAction,
  random: Random = Math.random,
): ActionResult {
  const s = clone(state);
  const ctx: Ctx = { events: [], random };
  const error = handleSystemAction(s, action, ctx);
  return error ? { ok: false, error } : { ok: true, state: s, events: ctx.events };
}

// ---------------------------------------------------------------------------
// Abfragen

export const currentPlayer = (s: GameState): PlayerState => s.players[s.currentPlayerIndex]!;

export const cardCount = (p: PlayerState): number => p.slots.filter(Boolean).length;

/** Spieler ohne Karten muss Cambio rufen, solange noch niemand gerufen hat (RULES §7). */
export const mustCallCambio = (s: GameState, p: PlayerState): boolean =>
  s.cambioCallerId === null && cardCount(p) === 0;

export function canCallCambio(s: GameState, p: PlayerState): boolean {
  return (
    s.phase.type === 'turn' &&
    currentPlayer(s).id === p.id &&
    s.cambioCallerId === null &&
    (s.lap >= s.settings.cambioFromLap || cardCount(p) === 0)
  );
}

const TURN_PHASES = new Set<Phase['type']>(['turn', 'drawn', 'ability', 'kingSwap']);

/** Darf gerade abgeworfen werden (RULES §6)? */
export function snapAllowed(s: GameState): boolean {
  return s.phase.type === 'snapWindow' || (s.snapOpen && TURN_PHASES.has(s.phase.type));
}

export function abilityOf(card: Card): Ability | null {
  if (card.kind === 'joker') return null;
  switch (card.rank) {
    case '7':
    case '8':
      return 'peekOwn';
    case '9':
    case '10':
      return 'peekOther';
    case 'J':
    case 'Q':
      return 'blindSwap';
    case 'K':
      return isRed(card.suit) ? null : 'king';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Spieleraktionen

function handlePlayerAction(
  s: GameState,
  player: PlayerState,
  action: PlayerAction,
  ctx: Ctx,
): GameError | null {
  const phase = s.phase;
  const isCurrent = currentPlayer(s).id === player.id;

  switch (action.type) {
    case 'drawFromDeck': {
      if (phase.type !== 'turn') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      if (mustCallCambio(s, player)) return 'mustCallCambio';
      if (!drawToHand(s, player, ctx)) return 'emptyDeck';
      return null;
    }

    case 'takeDiscard': {
      if (phase.type !== 'turn') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      if (mustCallCambio(s, player)) return 'mustCallCambio';
      const err = checkOwnSlot(player, action.slot);
      if (err) return err;
      const taken = s.discardPile.pop()!;
      const discarded = player.slots[action.slot]!;
      player.slots[action.slot] = taken;
      s.discardPile.push(discarded);
      s.snapTaken = false;
      ctx.events.push(
        toAll({
          type: 'tookDiscard',
          playerId: player.id,
          slot: action.slot,
          card: taken,
          discarded,
        }),
      );
      openSnapWindow(s, ctx);
      return null;
    }

    case 'swapDrawn': {
      if (phase.type !== 'drawn') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      const err = checkOwnSlot(player, action.slot);
      if (err) return err;
      const discarded = player.slots[action.slot]!;
      player.slots[action.slot] = phase.card;
      s.discardPile.push(discarded);
      s.snapTaken = false;
      ctx.events.push(
        toAll({ type: 'swappedDrawn', playerId: player.id, slot: action.slot, discarded }),
      );
      openSnapWindow(s, ctx);
      return null;
    }

    case 'discardDrawn': {
      if (phase.type !== 'drawn') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      discardDrawn(s, player, phase.card, true, ctx);
      return null;
    }

    case 'callCambio': {
      if (phase.type !== 'turn') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      if (!canCallCambio(s, player)) return 'cambioTooEarly';
      callCambio(s, player, ctx);
      return null;
    }

    case 'peekOwn': {
      if (phase.type !== 'ability' || phase.ability !== 'peekOwn') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      const err = checkOwnSlot(player, action.slot);
      if (err) return err;
      peek(s, player, { playerId: player.id, slot: action.slot }, ctx);
      openSnapWindow(s, ctx);
      return null;
    }

    case 'peekOther': {
      if (phase.type !== 'ability' || phase.ability !== 'peekOther') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      if (action.target.playerId === player.id) return 'samePlayer';
      const err = checkTarget(s, action.target);
      if (err) return err;
      peek(s, player, action.target, ctx);
      openSnapWindow(s, ctx);
      return null;
    }

    case 'blindSwap': {
      if (phase.type !== 'ability' || phase.ability !== 'blindSwap') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      const err = swapCards(s, player, action.a, action.b, ctx);
      if (err) return err;
      openSnapWindow(s, ctx);
      return null;
    }

    case 'kingPeek': {
      if (phase.type !== 'ability' || phase.ability !== 'king') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      const err = checkTarget(s, action.target);
      if (err) return err;
      peek(s, player, action.target, ctx);
      s.phase = { type: 'kingSwap', peeked: action.target };
      return null;
    }

    case 'kingSwap': {
      if (phase.type !== 'kingSwap') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      const err = swapCards(s, player, action.a, action.b, ctx);
      if (err) return err;
      openSnapWindow(s, ctx);
      return null;
    }

    case 'skipAbility': {
      if (phase.type !== 'ability' && phase.type !== 'kingSwap') return 'wrongPhase';
      if (!isCurrent) return 'notYourTurn';
      ctx.events.push(toAll({ type: 'abilitySkipped', playerId: player.id }));
      openSnapWindow(s, ctx);
      return null;
    }

    case 'snap': {
      if (!snapAllowed(s)) return 'wrongPhase';
      if (player.id === s.cambioCallerId) return 'callerCannotAct';
      const err = checkTarget(s, action.target);
      if (err) return err;
      snap(s, player, action.target, ctx);
      return null;
    }

    case 'giveCard': {
      if (phase.type !== 'snapGive') return 'wrongPhase';
      if (phase.snapperId !== player.id) return 'notYourTurn';
      const err = checkOwnSlot(player, action.slot);
      if (err) return err;
      giveCard(s, player, action.slot, phase.target, ctx);
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Systemaktionen

function handleSystemAction(s: GameState, action: SystemAction, ctx: Ctx): GameError | null {
  const phase = s.phase;
  switch (action.type) {
    case 'endInitialPeek':
      if (phase.type !== 'initialPeek') return 'wrongPhase';
      s.phase = { type: 'turn' };
      ctx.events.push(toAll({ type: 'turnStarted', playerId: currentPlayer(s).id, lap: s.lap }));
      return null;

    case 'closeSnapWindow':
      if (phase.type !== 'snapWindow') return 'wrongPhase';
      closeSnapWindow(s, ctx);
      return null;

    case 'startNextPartie':
      if (phase.type !== 'partieEnd') return 'wrongPhase';
      startPartie(s, ctx);
      return null;

    case 'timeout':
      return handleTimeout(s, ctx);
  }
}

/** Automatisches Handeln bei abgelaufenem Zeitlimit (RULES §10). */
function handleTimeout(s: GameState, ctx: Ctx): GameError | null {
  const phase = s.phase;
  const player = currentPlayer(s);
  switch (phase.type) {
    case 'initialPeek':
      return handleSystemAction(s, { type: 'endInitialPeek' }, ctx);
    case 'turn':
      if (mustCallCambio(s, player)) {
        callCambio(s, player, ctx);
      } else {
        const card = drawToHand(s, player, ctx);
        if (card) discardDrawn(s, player, card, false, ctx);
        else openSnapWindow(s, ctx);
      }
      return null;
    case 'drawn':
      discardDrawn(s, player, phase.card, false, ctx);
      return null;
    case 'ability':
    case 'kingSwap':
      ctx.events.push(toAll({ type: 'abilitySkipped', playerId: player.id }));
      openSnapWindow(s, ctx);
      return null;
    case 'snapWindow':
      closeSnapWindow(s, ctx);
      return null;
    case 'snapGive': {
      const snapper = s.players.find((p) => p.id === phase.snapperId)!;
      const slot = snapper.slots.findIndex(Boolean);
      giveCard(s, snapper, slot, phase.target, ctx);
      return null;
    }
    case 'partieEnd':
    case 'gameEnd':
      return 'wrongPhase';
  }
}

// ---------------------------------------------------------------------------
// Bausteine

function drawToHand(s: GameState, player: PlayerState, ctx: Ctx): Card | null {
  const card = drawCard(s, ctx);
  if (!card) return null;
  s.phase = { type: 'drawn', card };
  emitPrivate(
    ctx,
    player.id,
    { type: 'drewFromDeck', playerId: player.id, card },
    { type: 'drewFromDeck', playerId: player.id },
  );
  return card;
}

function discardDrawn(
  s: GameState,
  player: PlayerState,
  card: Card,
  allowAbility: boolean,
  ctx: Ctx,
) {
  // Neue Karte auf der Ablage: Abwerfen auf die alte endet.
  s.snapOpen = false;
  s.snapTaken = false;
  s.discardPile.push(card);
  ctx.events.push(toAll({ type: 'discardedDrawn', playerId: player.id, card }));
  const ability = allowAbility ? abilityOf(card) : null;
  if (ability) {
    // Abwerfen ist schon vor und während der Fähigkeit möglich (RULES §6).
    s.phase = { type: 'ability', ability };
    s.snapOpen = true;
  } else {
    openSnapWindow(s, ctx);
  }
}

/** Zieht vom Nachziehstapel; mischt bei Bedarf den Ablagestapel ein (RULES §9). */
function drawCard(s: GameState, ctx: Ctx): Card | null {
  if (s.drawPile.length === 0) {
    const top = s.discardPile.pop();
    if (s.discardPile.length === 0) {
      if (top) s.discardPile.push(top);
      return null;
    }
    s.drawPile = shuffle(s.discardPile, ctx.random);
    s.discardPile = top ? [top] : [];
    ctx.events.push(toAll({ type: 'deckReshuffled' }));
  }
  return s.drawPile.pop() ?? null;
}

function peek(s: GameState, viewer: PlayerState, target: SlotRef, ctx: Ctx) {
  const card = slotCard(s, target)!;
  emitPrivate(
    ctx,
    viewer.id,
    { type: 'cardPeeked', viewerId: viewer.id, target, card },
    { type: 'cardPeeked', viewerId: viewer.id, target },
  );
}

function swapCards(
  s: GameState,
  actor: PlayerState,
  a: SlotRef,
  b: SlotRef,
  ctx: Ctx,
): GameError | null {
  if (a.playerId === b.playerId) return 'samePlayer';
  const err = checkTarget(s, a) ?? checkTarget(s, b);
  if (err) return err;
  const pa = findPlayer(s, a.playerId)!;
  const pb = findPlayer(s, b.playerId)!;
  [pa.slots[a.slot], pb.slots[b.slot]] = [pb.slots[b.slot]!, pa.slots[a.slot]!];
  ctx.events.push(toAll({ type: 'cardsSwapped', playerId: actor.id, a, b }));
  return null;
}

function snap(s: GameState, snapper: PlayerState, target: SlotRef, ctx: Ctx) {
  const owner = findPlayer(s, target.playerId)!;
  const card = owner.slots[target.slot]!;
  const top = s.discardPile[s.discardPile.length - 1];

  if (top && sameRank(card, top)) {
    owner.slots[target.slot] = null;
    s.discardPile.push(card);
    ctx.events.push(toAll({ type: 'snapSucceeded', snapperId: snapper.id, target, card }));
    const mustGive = owner.id !== snapper.id && cardCount(snapper) > 0;

    if (s.phase.type === 'snapWindow') {
      if (mustGive) s.phase = { type: 'snapGive', snapperId: snapper.id, target, resume: null };
      else closeSnapWindow(s, ctx);
      return;
    }
    // Abwerfen während eines Zugs: Nur der erste richtige Abwurf zählt,
    // der unterbrochene Zug geht nach dem Abgeben weiter.
    s.snapOpen = false;
    s.snapTaken = true;
    if (mustGive) {
      s.phase = { type: 'snapGive', snapperId: snapper.id, target, resume: s.phase };
    }
    return;
  }

  // Falsch: Karte bleibt liegen. Steigend: n-ter Fehler kostet n Strafkarten.
  snapper.errorCount++;
  const count = s.settings.escalatingPenalty ? snapper.errorCount : 1;
  let penaltyCards = 0;
  for (let i = 0; i < count; i++) {
    const penalty = drawCard(s, ctx);
    if (!penalty) break;
    snapper.slots.push(penalty);
    penaltyCards++;
  }
  ctx.events.push(toAll({ type: 'snapFailed', snapperId: snapper.id, target, card, penaltyCards }));
}

function giveCard(s: GameState, giver: PlayerState, slot: number, to: SlotRef, ctx: Ctx) {
  const receiver = findPlayer(s, to.playerId)!;
  receiver.slots[to.slot] = giver.slots[slot]!;
  giver.slots[slot] = null;
  ctx.events.push(toAll({ type: 'cardGiven', from: { playerId: giver.id, slot }, to }));
  if (s.phase.type === 'snapGive' && s.phase.resume) s.phase = s.phase.resume;
  else closeSnapWindow(s, ctx);
}

/**
 * Eine Karte ist durch einen Zug auf die Ablage gekommen (RULES §6).
 * Feste Zeit: Abwurf-Fenster als eigene Phase. Bis zur nächsten Karte: Der
 * nächste Zug beginnt sofort, Abwerfen bleibt offen – außer nach dem letzten
 * Zug der Partie, dort gibt es ein Fenster mit fester Zeit.
 * Wurde schon (während einer Fähigkeit) richtig abgeworfen, gibt es kein Fenster mehr.
 */
function openSnapWindow(s: GameState, ctx: Ctx) {
  if (s.snapTaken) {
    s.snapOpen = false;
    finishTurn(s, ctx);
    return;
  }
  if (s.settings.snapWindowMode === 'untilNextCard' && !isLastTurn(s)) {
    s.snapOpen = true;
    finishTurn(s, ctx);
    return;
  }
  s.snapOpen = false;
  s.phase = { type: 'snapWindow' };
}

/** Ist der laufende Zug der letzte der Partie? */
function isLastTurn(s: GameState): boolean {
  if (s.cambioCallerId === null) return false;
  let left = s.finalTurnsLeft - (currentPlayer(s).id !== s.cambioCallerId ? 1 : 0);
  let index = s.currentPlayerIndex;
  while (left > 0) {
    index = (index + 1) % s.players.length;
    // Spieler ohne Karten setzen ihren letzten Zug aus.
    if (cardCount(s.players[index]!) > 0) return false;
    left--;
  }
  return true;
}

function closeSnapWindow(s: GameState, ctx: Ctx) {
  ctx.events.push(toAll({ type: 'snapWindowClosed' }));
  finishTurn(s, ctx);
}

function callCambio(s: GameState, player: PlayerState, ctx: Ctx) {
  s.cambioCallerId = player.id;
  s.finalTurnsLeft = s.players.length - 1;
  ctx.events.push(toAll({ type: 'cambioCalled', playerId: player.id }));
  moveToNextPlayer(s, ctx);
}

function finishTurn(s: GameState, ctx: Ctx) {
  if (s.cambioCallerId !== null) {
    if (currentPlayer(s).id !== s.cambioCallerId) s.finalTurnsLeft--;
    if (s.finalTurnsLeft <= 0) {
      endPartie(s, ctx);
      return;
    }
  }
  moveToNextPlayer(s, ctx);
}

function moveToNextPlayer(s: GameState, ctx: Ctx) {
  s.currentPlayerIndex = (s.currentPlayerIndex + 1) % s.players.length;
  if (s.currentPlayerIndex === s.startingPlayerIndex) s.lap++;
  s.phase = { type: 'turn' };
  // Nach dem Cambio-Ruf setzt ein Spieler ohne Karten seinen letzten Zug aus.
  if (s.cambioCallerId !== null && cardCount(currentPlayer(s)) === 0) {
    finishTurn(s, ctx);
    return;
  }
  ctx.events.push(toAll({ type: 'turnStarted', playerId: currentPlayer(s).id, lap: s.lap }));
}

function endPartie(s: GameState, ctx: Ctx) {
  const result = scorePartie(s.players, s.cambioCallerId!, s.settings, s.partieNumber);
  for (const p of s.players) p.totalScore += result.points[p.id]!;
  s.results.push(result);
  ctx.events.push(toAll({ type: 'partieEnded', result }));

  if (isGameOver(s)) {
    const winners =
      s.settings.mode === 'single'
        ? result.winners
        : lowest(
            Object.fromEntries(s.players.map((p) => [p.id, p.totalScore])),
            s.players.map((p) => p.id),
          );
    s.phase = { type: 'gameEnd', result, winners };
    ctx.events.push(toAll({ type: 'gameEnded', winners }));
  } else {
    s.phase = { type: 'partieEnd', result };
  }
}

function isGameOver(s: GameState): boolean {
  const { mode, endCondition, roundCount, pointLimit } = s.settings;
  if (mode === 'single') return true;
  if (endCondition === 'rounds') return s.partieNumber >= roundCount;
  return s.players.some((p) => p.totalScore >= pointLimit);
}

// ---------------------------------------------------------------------------
// Validierung & Hilfsfunktionen

const findPlayer = (s: GameState, id: string) => s.players.find((p) => p.id === id);

function slotCard(s: GameState, ref: SlotRef): Card | null | undefined {
  return findPlayer(s, ref.playerId)?.slots[ref.slot];
}

function checkOwnSlot(player: PlayerState, slot: number): GameError | null {
  if (!Number.isInteger(slot) || slot < 0 || slot >= player.slots.length) return 'invalidSlot';
  if (!player.slots[slot]) return 'emptySlot';
  return null;
}

/** Prüft eine beliebige Zielkarte: existiert, nicht leer, nicht vom Cambio-Rufer. */
function checkTarget(s: GameState, ref: SlotRef): GameError | null {
  const owner = findPlayer(s, ref.playerId);
  if (!owner) return 'unknownPlayer';
  if (ref.playerId === s.cambioCallerId) return 'lockedCard';
  return checkOwnSlot(owner, ref.slot);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
