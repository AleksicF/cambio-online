import { useState } from 'react';
import {
  cardValue,
  type Card,
  type GameUpdate,
  type PlayerAction,
  type PlayerView,
  type PlayerViewPlayer,
  type RoomView,
  type SlotRef,
} from '@cambio/shared';
import { CardView, EmptySlot, type CardMark } from '../cards/CardView';
import { api } from '../net/store';
import { errorText } from '../net/errors';
import { DECK, DISCARD, DRAWN, slotAnchor } from './anchors';
import {
  ABILITY_SHORT,
  ABILITY_TEXT,
  EMPTY_SELECTION,
  canSnapCard,
  clickCard,
  isSelectable,
  type LocalSelection,
} from './interaction';
import { useEventFeed } from './useEventFeed';
import { useFlights } from './useFlights';
import { Results } from './Results';
import { TimerBar } from './TimerBar';
import { useSnapDrag } from './useSnapDrag';
import { setShowHelp, useShowHelp, useSnapMode, type SnapMode } from '../prefs';
import { HelpPanel, cardHint } from './HelpPanel';

interface GameProps {
  update: GameUpdate;
  room: RoomView;
  deadline: number | null;
}

export function Game({ update, room, deadline }: GameProps) {
  const { view } = update;
  const [error, setError] = useState<string | null>(null);
  const { hidden, landed, layer } = useFlights(update);
  const { reveals, highlights, log } = useEventFeed(update);

  // Lokale Auswahl gilt nur für die Phase, in der sie getroffen wurde.
  const phaseKey = `${view.phase.type}:${view.currentPlayerId}:${view.lap}`;
  const [stored, setStored] = useState({ phaseKey, selection: EMPTY_SELECTION });
  const selection = stored.phaseKey === phaseKey ? stored.selection : EMPTY_SELECTION;
  const setSelection = (next: LocalSelection) => setStored({ phaseKey, selection: next });

  const snapMode = useSnapMode();
  const showHelp = useShowHelp();
  // Eine Abwurf-Gelegenheit gilt für genau eine oberste Ablagekarte.
  const snapWindowKey =
    view.snapAllowed && snapMode === 'drag'
      ? `${view.partieNumber}:${view.discardCount}:${view.discardTop?.id ?? ''}`
      : null;
  const snapDrag = useSnapDrag(snapWindowKey, (target) => void send({ type: 'snap', target }));

  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const name = (id: string) => names.get(id) ?? '?';
  const me = view.players.find((p) => p.id === view.me)!;
  const opponents = view.players.filter((p) => p.id !== view.me);
  const myTurn = view.currentPlayerId === view.me;
  const revealAll = view.phase.type === 'partieEnd' || view.phase.type === 'gameEnd';

  async function send(action: PlayerAction) {
    setError(null);
    const r = await api.act(action);
    if (!r.ok) setError(errorText(r.error));
  }

  function onCard(ref: SlotRef) {
    const result = clickCard(view, selection, ref, snapMode === 'click');
    if (result.kind === 'action') {
      setSelection(EMPTY_SELECTION);
      void send(result.action);
    } else if (result.kind === 'select') {
      setSelection(result.selection);
    }
  }

  const canDraw = myTurn && view.phase.type === 'turn' && !view.mustCallCambio;
  function onDeck() {
    if (canDraw) void send({ type: 'drawFromDeck' });
  }
  function onDiscard() {
    if (canDraw && view.discardTop)
      setSelection({ ...selection, takingDiscard: !selection.takingDiscard });
    else if (myTurn && view.phase.type === 'drawn') void send({ type: 'discardDrawn' });
  }

  function renderHand(player: PlayerViewPlayer, small: boolean) {
    return (
      <Hand
        player={player}
        view={view}
        small={small}
        selection={selection}
        hidden={hidden}
        reveals={reveals}
        highlights={highlights}
        revealAll={revealAll}
        landed={landed}
        onCard={onCard}
        snapMode={snapMode}
        dragging={snapDrag.dragging?.ref ?? null}
        onDragStart={snapDrag.start}
      />
    );
  }

  const drawnCard = view.phase.type === 'drawn' ? view.phase.card : undefined;

  return (
    <main className="game">
      <header className="game__bar">
        <span>
          Raum {room.code} · Partie {view.partieNumber} · Umlauf {view.lap}
        </span>
        <span className="game__bar-actions">
          <button
            type="button"
            className="link-button"
            aria-pressed={showHelp}
            onClick={() => setShowHelp(!showHelp)}
          >
            {showHelp ? 'Hilfe aus' : 'Hilfe an'}
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              if (window.confirm('Spiel wirklich verlassen?')) void api.leaveRoom();
            }}
          >
            Verlassen
          </button>
        </span>
      </header>

      <div className="game__table">
        <section className="opponents">
          {opponents.map((p) => (
            <PlayerPanel
              key={p.id}
              player={p}
              view={view}
              connected={room.players.find((r) => r.id === p.id)?.connected ?? false}
            >
              {renderHand(p, true)}
            </PlayerPanel>
          ))}
        </section>

        <section className="center">
          <div className="pile">
            <CardView
              card={null}
              anchor={DECK}
              marks={canDraw ? ['selectable'] : []}
              onClick={canDraw ? onDeck : undefined}
              title="Nachziehstapel"
            />
            <span className="pile__label">Stapel · {view.drawPileCount}</span>
          </div>

          <div className="pile">
            {view.discardTop ? (
              <CardView
                card={view.discardTop}
                anchor={DISCARD}
                hidden={hidden.has(DISCARD)}
                marks={
                  snapDrag.dragging
                    ? [snapDrag.dragging.overDiscard ? 'drop-target' : 'drop-zone']
                    : selection.takingDiscard
                      ? ['selected']
                      : canDraw || (myTurn && view.phase.type === 'drawn')
                        ? ['selectable']
                        : []
                }
                onClick={onDiscard}
              />
            ) : (
              <EmptySlot anchor={DISCARD} />
            )}
            <span className="pile__label">Ablage</span>
            {showHelp && view.discardTop && (
              <span className="pile__hint">{cardHint(view.discardTop, false)}</span>
            )}
          </div>

          <div className="pile">
            {drawnCard !== undefined ? (
              <CardView
                card={drawnCard}
                anchor={DRAWN}
                hidden={hidden.has(DRAWN)}
                title="Gezogene Karte"
              />
            ) : (
              <EmptySlot anchor={DRAWN} />
            )}
            <span className="pile__label">{drawnCard !== undefined ? 'Gezogen' : ' '}</span>
            {showHelp && drawnCard && (
              <span className="pile__hint">{cardHint(drawnCard, true)}</span>
            )}
          </div>
        </section>

        <section className="status">
          <TimerBar deadline={deadline} key={`${deadline}`} />
          <Prompt view={view} selection={selection} name={name} snapMode={snapMode} />
          <div className="status__actions">
            {myTurn && view.phase.type === 'turn' && selection.takingDiscard && (
              <button
                type="button"
                className="button"
                onClick={() => setSelection(EMPTY_SELECTION)}
              >
                Abbrechen
              </button>
            )}
            {myTurn && view.phase.type === 'drawn' && (
              <button
                type="button"
                className="button"
                onClick={() => void send({ type: 'discardDrawn' })}
              >
                Ablegen
              </button>
            )}
            {myTurn && (view.phase.type === 'ability' || view.phase.type === 'kingSwap') && (
              <button
                type="button"
                className="button"
                onClick={() => void send({ type: 'skipAbility' })}
              >
                {view.phase.type === 'kingSwap' ? 'Nicht tauschen' : 'Überspringen'}
              </button>
            )}
            {view.canCallCambio && (
              <button
                type="button"
                className="button button--primary"
                onClick={() => void send({ type: 'callCambio' })}
              >
                Cambio rufen
              </button>
            )}
          </div>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="me">
          <PlayerPanel player={me} view={view} connected>
            {renderHand(me, false)}
          </PlayerPanel>
        </section>

        {revealAll && <Results view={view} room={room} />}
      </div>

      <aside className="game__side">
        {showHelp && !revealAll && <HelpPanel />}
        <section className="log" aria-live="polite">
          {log.map((line, i) => (
            <p key={`${i}:${line}`}>{line}</p>
          ))}
        </section>
      </aside>

      {layer}
      {snapDrag.ghost}
    </main>
  );
}

function PlayerPanel({
  player,
  view,
  connected,
  children,
}: {
  player: PlayerViewPlayer;
  view: PlayerView;
  connected: boolean;
  children: React.ReactNode;
}) {
  const active = view.currentPlayerId === player.id && view.phase.type !== 'initialPeek';
  const isMe = player.id === view.me;
  const classes = ['player', active && 'player--active', isMe && 'player--me']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <div className="player__name">
        <span>{isMe ? `${player.name} (du)` : player.name}</span>
        {view.cambioCallerId === player.id && <span className="tag tag--accent">Cambio</span>}
        {!connected && <span className="tag tag--muted">getrennt</span>}
        {view.settings.mode === 'points' && <span className="muted">{player.totalScore} P.</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Feste Plätze in zwei Reihen: 0 1 oben, 2 3 unten (die unteren werden zu
 * Beginn angesehen). Weitere Karten kommen spaltenweise rechts daneben.
 */
function slotPosition(i: number): React.CSSProperties {
  if (i < 4) return { gridRow: i < 2 ? 1 : 2, gridColumn: (i % 2) + 1 };
  const j = i - 4;
  return { gridRow: (j % 2) + 1, gridColumn: 3 + Math.floor(j / 2) };
}

function Hand({
  player,
  view,
  small,
  selection,
  hidden,
  reveals,
  highlights,
  revealAll,
  landed,
  onCard,
  snapMode,
  dragging,
  onDragStart,
}: {
  player: PlayerViewPlayer;
  view: PlayerView;
  small: boolean;
  selection: LocalSelection;
  hidden: Set<string>;
  reveals: Map<string, Card>;
  highlights: Set<string>;
  revealAll: boolean;
  landed: Set<string>;
  onCard: (ref: SlotRef) => void;
  snapMode: SnapMode;
  dragging: SlotRef | null;
  onDragStart: (ref: SlotRef, e: React.PointerEvent<HTMLElement>) => void;
}) {
  const sum = revealAll
    ? player.slots.reduce((s, slot) => s + (slot?.card ? cardValue(slot.card) : 0), 0)
    : null;

  return (
    <div className="hand-wrap">
      <div className={`hand${small ? ' hand--small' : ''}`}>
        {player.slots.map((slot, i) => {
          const ref = { playerId: player.id, slot: i };
          const anchor = slotAnchor(ref);
          const position = slotPosition(i);
          if (!slot) {
            return (
              <div key={i} className="hand__slot" style={position}>
                <EmptySlot small={small} anchor={anchor} />
              </div>
            );
          }
          const selectable = isSelectable(view, selection, ref, snapMode === 'click');
          const marks: CardMark[] = [];
          if (selection.picked.some((p) => p.playerId === ref.playerId && p.slot === ref.slot)) {
            marks.push('selected');
          } else if (selectable) marks.push('selectable');
          if (highlights.has(anchor)) marks.push('highlight');
          if (landed.has(anchor)) marks.push('landed');
          if (view.cambioCallerId === player.id && !revealAll) marks.push('locked');
          const draggable = snapMode === 'drag' && canSnapCard(view, ref);
          if (draggable) marks.push('draggable');
          if (dragging?.playerId === ref.playerId && dragging.slot === ref.slot) {
            marks.push('dragging');
          }
          return (
            <div key={i} className="hand__slot" style={position}>
              <CardView
                card={slot.card ?? reveals.get(anchor) ?? null}
                small={small}
                anchor={anchor}
                hidden={hidden.has(anchor)}
                marks={marks}
                onClick={selectable ? () => onCard(ref) : undefined}
                onPointerDown={draggable ? (e) => onDragStart(ref, e) : undefined}
              />
            </div>
          );
        })}
      </div>
      {sum !== null && <p className="hand__sum">Summe: {sum}</p>}
    </div>
  );
}

function Prompt({
  view,
  selection,
  name,
  snapMode,
}: {
  view: PlayerView;
  selection: LocalSelection;
  name: (id: string) => string;
  snapMode: SnapMode;
}) {
  const { phase, me } = view;
  const myTurn = view.currentPlayerId === me;
  const active = name(view.currentPlayerId);
  const lastRound =
    view.cambioCallerId && phase.type !== 'partieEnd' && phase.type !== 'gameEnd'
      ? ` ${view.cambioCallerId === me ? 'Du hast' : name(view.cambioCallerId) + ' hat'} Cambio gerufen – letzte Runde.`
      : '';

  let text: string;
  switch (phase.type) {
    case 'initialPeek':
      text = 'Merk dir deine beiden unteren Karten.';
      break;
    case 'turn':
      if (!myTurn) text = `${active} ist am Zug.`;
      else if (view.mustCallCambio) text = 'Du hast keine Karten mehr – rufe Cambio.';
      else if (selection.takingDiscard)
        text = 'Wähle die Karte, die du gegen die offene Karte tauschst.';
      else text = 'Du bist dran: Ziehe vom Stapel oder nimm die offene Karte.';
      break;
    case 'drawn':
      text = myTurn
        ? 'Tausche die Karte gegen eine deiner Karten oder lege sie ab.'
        : `${active} hat gezogen.`;
      break;
    case 'ability':
      text = myTurn ? ABILITY_TEXT[phase.ability] : `${active} ${ABILITY_SHORT[phase.ability]}.`;
      if (myTurn && phase.ability === 'blindSwap' && selection.picked.length === 1) {
        text = 'Wähle die zweite Karte (anderer Spieler).';
      }
      break;
    case 'kingSwap':
      text = myTurn
        ? selection.picked.length === 1
          ? 'Wähle die zweite Karte (anderer Spieler).'
          : 'Wähle zwei Karten zum Tauschen – oder lass es.'
        : `${active} überlegt zu tauschen.`;
      break;
    case 'snapWindow':
      text =
        view.cambioCallerId === me
          ? 'Abwurf-Fenster offen.'
          : snapMode === 'drag'
            ? 'Abwerfen? Ziehe eine Karte mit dem gleichen Rang auf die Ablage.'
            : 'Abwerfen? Klicke eine Karte mit dem gleichen Rang wie die offene Karte.';
      break;
    case 'snapGive':
      text =
        phase.snapperId === me
          ? `Gib ${name(phase.target.playerId)} eine deiner Karten.`
          : `${name(phase.snapperId)} gibt ${name(phase.target.playerId)} eine Karte.`;
      break;
    case 'partieEnd':
    case 'gameEnd':
      text = 'Alle Karten sind aufgedeckt.';
      break;
  }
  const snapStillOpen =
    view.snapAllowed && phase.type !== 'snapWindow' && view.cambioCallerId !== me
      ? snapMode === 'drag'
        ? 'Abwerfen auf die offene Karte ist noch möglich – Karte auf die Ablage ziehen.'
        : 'Abwerfen auf die offene Karte ist noch möglich.'
      : '';

  return (
    <p className="prompt">
      {text}
      {snapStillOpen && <span className="muted">{snapStillOpen}</span>}
      {lastRound && <span className="muted">{lastRound}</span>}
    </p>
  );
}
