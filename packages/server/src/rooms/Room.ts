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
  type GameSettings,
  type GameState,
  type GameUpdate,
  type PlayerAction,
  type RoomView,
  type SystemAction,
} from '@cambio/shared';

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
}

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

export class Room {
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
    };
    this.members.push(member);
    if (!this.hostId) this.hostId = member.id;
    this.emptySince = null;
    this.broadcastRoom();
    return { ok: true, member };
  }

  findByToken(playerId: string, token: string): Member | undefined {
    return this.members.find((m) => m.id === playerId && m.token === token && !m.left);
  }

  setConnected(playerId: string, connected: boolean) {
    const member = this.member(playerId);
    if (!member || member.connected === connected) return;
    member.connected = connected;
    this.emptySince = this.members.some((m) => m.connected) ? null : Date.now();
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
    this.emptySince = this.members.some((m) => m.connected) ? null : Date.now();
    this.broadcastRoom();
    return { ok: true };
  }

  kick(by: string, playerId: string): Result {
    if (!this.isHost(by)) return { ok: false, error: 'notHost' };
    if (this.game) return { ok: false, error: 'notInLobby' };
    const member = this.member(playerId);
    if (!member || playerId === by) return { ok: false, error: 'notInRoom' };
    this.members.splice(this.members.indexOf(member), 1);
    this.transport.sendKicked(playerId);
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
  }

  // -------------------------------------------------------------------------
  // Ansichten

  view(): RoomView {
    return {
      code: this.code,
      hostId: this.effectiveHostId(),
      players: this.members
        .filter((m) => !m.left)
        .map(({ id, name, connected }) => ({ id, name, connected })),
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
  }

  private sendGameTo(member: Member, events: AudiencedEvent[]) {
    if (!this.game || !member.connected) return;
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
    for (const m of this.members) if (m.connected) this.transport.sendRoom(m.id, view);
  }

  /**
   * Ist der Host nur kurz getrennt (z. B. Seite neu geladen), übernimmt
   * vorübergehend der erste verbundene Spieler – die Rolle bleibt beim Host.
   */
  effectiveHostId(): string {
    const host = this.member(this.hostId);
    if (host?.connected) return host.id;
    return this.members.find((m) => m.connected && !m.left)?.id ?? this.hostId;
  }

  isHost(playerId: string): boolean {
    return playerId === this.effectiveHostId();
  }

  /** Überträgt die Host-Rolle dauerhaft, wenn der Host den Raum verlassen hat. */
  private ensureHost() {
    const host = this.member(this.hostId);
    if (host && !host.left) return;
    const next =
      this.members.find((m) => m.connected && !m.left) ?? this.members.find((m) => !m.left);
    this.hostId = next?.id ?? '';
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
