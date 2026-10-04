import { randomUUID } from 'node:crypto';
import {
  DEFAULT_SETTINGS,
  MAX_NAME_LENGTH,
  MIN_PLAYERS,
  applyAction,
  applySystemAction,
  createGame,
  currentPlayer,
  eventsFor,
  getPlayerView,
  mergeSettings,
  type ActionError,
  type ActionResult,
  type AudiencedEvent,
  type BotDifficulty,
  type GameSettings,
  type GameState,
  type GameUpdate,
  type PlayerAction,
  type RoomView,
  type SystemAction,
} from '@cambio/shared';
import { BotPlayer, type BotHost } from './BotPlayer';

/** Wie der Raum seine Mitglieder erreicht – entkoppelt von Socket.IO, damit testbar. */
export interface RoomTransport {
  sendRoom(playerId: string, room: RoomView): void;
  sendGame(playerId: string, update: GameUpdate | null): void;
  sendKicked(playerId: string): void;
}

export interface Member {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  /** Hat das laufende Spiel verlassen; wird beim Zurück-zur-Lobby entfernt. */
  left: boolean;
  /** Schwierigkeit, falls Bot. Bots sind immer verbunden und nie Host. */
  bot: BotDifficulty | null;
}

/** Namen für Bots, in dieser Reihenfolge vergeben. */
export const BOT_NAMES = ['Ada', 'Bruno', 'Clara', 'Dario', 'Elif', 'Finn'];

/** Zeitlimit für abwesende Spieler, damit das Spiel nicht hängen bleibt. */
export const ABSENT_PLAYER_TIMEOUT_MS = 5_000;
/** Zeitlimit für das Abgeben einer Karte, falls kein Zug-Zeitlimit eingestellt ist. */
export const GIVE_CARD_FALLBACK_MS = 15_000;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: ActionError };

export function normalizeName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH ? trimmed : null;
}

export class Room implements BotHost {
  readonly members: Member[] = [];
  hostId = '';
  settings: GameSettings = { ...DEFAULT_SETTINGS };
  game: GameState | null = null;
  /** Zeitpunkt, seit dem niemand mehr verbunden ist (für das Aufräumen). */
  emptySince: number | null = null;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private deadline: number | null = null;
  private phaseKey = '';
  private phaseDeadline: number | null = null;
  private readonly bots = new Map<string, BotPlayer>();

  constructor(
    readonly code: string,
    private readonly transport: RoomTransport,
    private readonly random: () => number = Math.random,
  ) {}

  // -------------------------------------------------------------------------
  // Mitglieder

  join(rawName: unknown): Result<{ member: Member }> {
    const name = normalizeName(rawName);
    if (!name) return { ok: false, error: 'invalidName' };
    if (this.game) return { ok: false, error: 'gameInProgress' };
    if (this.members.length >= this.settings.maxPlayers) return { ok: false, error: 'roomFull' };

    const member: Member = {
      id: randomUUID(),
      name: this.uniqueName(name),
      token: randomUUID(),
      connected: true,
      left: false,
      bot: null,
    };
    this.members.push(member);
    if (!this.hostId) this.hostId = member.id;
    this.emptySince = null;
    this.broadcastRoom();
    return { ok: true, member };
  }

  findByToken(playerId: string, token: string): Member | undefined {
    return this.members.find((m) => m.id === playerId && m.token === token && !m.left && !m.bot);
  }

  addBot(by: string, difficulty: BotDifficulty): Result<{ member: Member }> {
    if (!this.isHost(by)) return { ok: false, error: 'notHost' };
    if (this.game) return { ok: false, error: 'notInLobby' };
    if (this.members.length >= this.settings.maxPlayers) return { ok: false, error: 'roomFull' };
    const taken = new Set(this.members.map((m) => m.name));
    const name = BOT_NAMES.find((n) => !taken.has(n)) ?? 'Bot';
    const member: Member = {
      id: randomUUID(),
      name: this.uniqueName(name),
      token: '',
      connected: true,
      left: false,
      bot: difficulty,
    };
    this.members.push(member);
    this.bots.set(member.id, new BotPlayer(member.id, difficulty, this, this.random));
    this.broadcastRoom();
    return { ok: true, member };
  }

  setBotDifficulty(by: string, playerId: string, difficulty: BotDifficulty): Result {
    if (!this.isHost(by)) return { ok: false, error: 'notHost' };
    if (this.game) return { ok: false, error: 'notInLobby' };
    const member = this.member(playerId);
    const bot = this.bots.get(playerId);
    if (!member || !bot) return { ok: false, error: 'notInRoom' };
    member.bot = difficulty;
    bot.difficulty = difficulty;
    bot.reset();
    this.broadcastRoom();
    return { ok: true };
  }

  setConnected(playerId: string, connected: boolean) {
    const member = this.member(playerId);
    if (!member || member.connected === connected) return;
    member.connected = connected;
    this.updateEmptySince();
    this.broadcastRoom();
    if (this.game) {
      // Abwesende Spieler bekommen ein kurzes Zeitlimit.
      this.schedule();
      if (connected) this.sendGameTo(member, []);
    }
  }

  /** Spieler verlässt den Raum freiwillig. */
  leave(playerId: string): Result {
    const member = this.member(playerId);
    if (!member) return { ok: false, error: 'notInRoom' };
    if (this.game) {
      member.left = true;
      member.connected = false;
      this.ensureHost();
      this.schedule();
    } else {
      this.members.splice(this.members.indexOf(member), 1);
      this.ensureHost();
    }
    this.updateEmptySince();
    this.broadcastRoom();
    return { ok: true };
  }

  kick(by: string, playerId: string): Result {
    if (!this.isHost(by)) return { ok: false, error: 'notHost' };
    if (this.game) return { ok: false, error: 'notInLobby' };
    const member = this.member(playerId);
    if (!member || playerId === by) return { ok: false, error: 'notInRoom' };
    this.members.splice(this.members.indexOf(member), 1);
    const bot = this.bots.get(playerId);
    if (bot) {
      bot.dispose();
      this.bots.delete(playerId);
    } else {
      this.transport.sendKicked(playerId);
    }
    this.broadcastRoom();
    return { ok: true };
  }

  updateSettings(by: string, input: unknown): Result {
    if (!this.isHost(by)) return { ok: false, error: 'notHost' };
    if (this.game) return { ok: false, error: 'notInLobby' };
    const merged = mergeSettings(this.settings, input);
    // Max. Spieler nie unter die aktuelle Anzahl senken.
    merged.maxPlayers = Math.max(merged.maxPlayers, this.members.length);
    this.settings = merged;
    this.broadcastRoom();
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Spielablauf

  start(by: string): Result {
    if (!this.isHost(by)) return { ok: false, error: 'notHost' };
    if (this.game) return { ok: false, error: 'notInLobby' };
    if (this.members.length < MIN_PLAYERS) return { ok: false, error: 'notEnoughPlayers' };
    const { state, events } = createGame(
      this.members.map(({ id, name }) => ({ id, name })),
      this.settings,
      this.random,
    );
    this.game = state;
    this.phaseKey = '';
    for (const bot of this.bots.values()) bot.reset();
    this.broadcastRoom();
    this.afterChange(events);
    return { ok: true };
  }

  act(by: string, action: PlayerAction): Result {
    if (!this.game) return { ok: false, error: 'notInLobby' };
    return this.commit(applyAction(this.game, by, action, this.random));
  }

  nextPartie(by: string): Result {
    if (!this.isHost(by)) return { ok: false, error: 'notHost' };
    if (!this.game) return { ok: false, error: 'notInLobby' };
    return this.commit(applySystemAction(this.game, { type: 'startNextPartie' }, this.random));
  }

  backToLobby(by: string): Result {
    if (!this.isHost(by)) return { ok: false, error: 'notHost' };
    if (this.game?.phase.type !== 'gameEnd') return { ok: false, error: 'gameInProgress' };
    this.clearTimer();
    for (const bot of this.bots.values()) bot.reset();
    this.game = null;
    for (const m of this.members.filter((m) => m.left)) {
      this.members.splice(this.members.indexOf(m), 1);
    }
    this.ensureHost();
    this.broadcastRoom();
    for (const m of this.members) this.transport.sendGame(m.id, null);
    return { ok: true };
  }

  dispose() {
    this.clearTimer();
    for (const bot of this.bots.values()) bot.dispose();
  }

  // -------------------------------------------------------------------------
  // Schnittstelle für Bots

  viewFor(playerId: string) {
    return this.game ? getPlayerView(this.game, playerId) : null;
  }

  botAct(playerId: string, action: PlayerAction): Result {
    return this.act(playerId, action);
  }

  // -------------------------------------------------------------------------
  // Ansichten

  view(): RoomView {
    return {
      code: this.code,
      hostId: this.effectiveHostId(),
      players: this.members
        .filter((m) => !m.left)
        .map(({ id, name, connected, bot }) => ({ id, name, connected, bot })),
      settings: this.settings,
      status: this.game ? 'playing' : 'lobby',
    };
  }

  sendStateTo(playerId: string) {
    const member = this.member(playerId);
    if (!member) return;
    this.transport.sendRoom(member.id, this.view());
    this.transport.sendGame(member.id, this.game ? this.gameUpdate(member, []) : null);
  }

  // -------------------------------------------------------------------------
  // Intern

  private commit(result: ActionResult): Result {
    if (!result.ok) return result;
    this.game = result.state;
    this.afterChange(result.events);
    return { ok: true };
  }

  private applySystem(action: SystemAction) {
    if (!this.game) return;
    const result = applySystemAction(this.game, action, this.random);
    if (result.ok) {
      this.game = result.state;
      this.afterChange(result.events);
    }
  }

  private afterChange(events: AudiencedEvent[]) {
    this.schedule();
    for (const m of this.members) this.sendGameTo(m, events);
    // Bots bekommen dasselbe Update wie ein Mensch; sie handeln verzögert über Timer.
    if (this.game) {
      for (const m of this.members) {
        if (m.bot) this.bots.get(m.id)?.update(this.gameUpdate(m, events));
      }
    }
  }

  private sendGameTo(member: Member, events: AudiencedEvent[]) {
    if (!this.game || !member.connected || member.bot) return;
    this.transport.sendGame(member.id, this.gameUpdate(member, events));
  }

  private gameUpdate(member: Member, events: AudiencedEvent[]): GameUpdate {
    return {
      view: getPlayerView(this.game!, member.id),
      events: eventsFor(events, member.id),
      timeLeftMs: this.deadline === null ? null : Math.max(0, this.deadline - Date.now()),
    };
  }

  /**
   * Setzt den Timer passend zur aktuellen Phase (RULES §10). Die Deadline gilt
   * pro Phase: Teilschritte eines Zugs oder Fehlwürfe verlängern sie nicht.
   */
  private schedule() {
    this.clearTimer();
    const g = this.game;
    if (!g) return;

    const now = Date.now();
    const { settings, phase } = g;
    const turnLimitMs = settings.turnTimeLimit === null ? null : settings.turnTimeLimit * 1000;
    let baseMs: number | null;
    let action: SystemAction = { type: 'timeout' };
    /** Spieler, auf den gewartet wird – ist er abwesend, gilt ein kurzes Zeitlimit. */
    let waitingFor: string | null = null;

    switch (phase.type) {
      case 'initialPeek':
        baseMs = settings.peekDuration * 1000;
        action = { type: 'endInitialPeek' };
        break;
      case 'snapWindow':
        baseMs = settings.snapWindow * 1000;
        action = { type: 'closeSnapWindow' };
        break;
      case 'turn':
      case 'drawn':
      case 'ability':
      case 'kingSwap':
        baseMs = turnLimitMs;
        waitingFor = currentPlayer(g).id;
        break;
      case 'snapGive':
        baseMs = turnLimitMs ?? GIVE_CARD_FALLBACK_MS;
        waitingFor = phase.snapperId;
        break;
      case 'partieEnd':
      case 'gameEnd':
        this.phaseKey = '';
        return;
    }

    const group = waitingFor && phase.type !== 'snapGive' ? 'turn' : phase.type;
    const key = `${g.partieNumber}:${g.lap}:${g.currentPlayerIndex}:${group}`;
    if (key !== this.phaseKey) {
      this.phaseKey = key;
      this.phaseDeadline = baseMs === null ? null : now + baseMs;
    }

    let deadline = this.phaseDeadline;
    if (waitingFor && !this.member(waitingFor)?.connected) {
      deadline = Math.min(deadline ?? Infinity, now + ABSENT_PLAYER_TIMEOUT_MS);
    }
    if (deadline === null) return;
    this.deadline = deadline;
    this.timer = setTimeout(() => this.applySystem(action), Math.max(0, deadline - now));
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
  }

  private broadcastRoom() {
    const view = this.view();
    for (const m of this.members) if (m.connected && !m.bot) this.transport.sendRoom(m.id, view);
  }

  /**
   * Ist der Host nur kurz getrennt (z. B. Seite neu geladen), übernimmt
   * vorübergehend der erste verbundene Spieler – die Rolle bleibt beim Host.
   */
  effectiveHostId(): string {
    const host = this.member(this.hostId);
    if (host?.connected) return host.id;
    return this.members.find((m) => m.connected && !m.left && !m.bot)?.id ?? this.hostId;
  }

  isHost(playerId: string): boolean {
    return playerId === this.effectiveHostId();
  }

  /** Überträgt die Host-Rolle dauerhaft, wenn der Host den Raum verlassen hat. */
  private ensureHost() {
    const host = this.member(this.hostId);
    if (host && !host.left) return;
    const humans = this.members.filter((m) => !m.left && !m.bot);
    const next = humans.find((m) => m.connected) ?? humans[0];
    this.hostId = next?.id ?? '';
  }

  /** Nur Menschen zählen: Ein Raum nur mit Bots gilt als leer. */
  hasHumans(): boolean {
    return this.members.some((m) => !m.bot && !m.left);
  }

  private updateEmptySince() {
    const anyoneHere = this.members.some((m) => m.connected && !m.bot);
    this.emptySince = anyoneHere ? null : (this.emptySince ?? Date.now());
  }

  private uniqueName(name: string): string {
    const taken = new Set(this.members.map((m) => m.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; ; i++) {
      const candidate = `${name.slice(0, MAX_NAME_LENGTH - 3)} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  private member(id: string) {
    return this.members.find((m) => m.id === id);
  }
}
