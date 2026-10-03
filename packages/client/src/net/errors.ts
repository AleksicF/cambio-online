import type { ClientError } from './store';

const MESSAGES: Record<ClientError, string> = {
  roomNotFound: 'Raum nicht gefunden.',
  roomFull: 'Der Raum ist voll.',
  gameInProgress: 'In diesem Raum läuft gerade ein Spiel.',
  invalidName: 'Bitte einen Namen mit 1–20 Zeichen eingeben.',
  invalidPayload: 'Ungültige Eingabe.',
  invalidSession: 'Die Sitzung ist abgelaufen.',
  notInRoom: 'Du bist in keinem Raum.',
  notHost: 'Das kann nur der Host.',
  notEnoughPlayers: 'Es braucht mindestens 2 Spieler.',
  notInLobby: 'Das geht nur in der Lobby.',
  wrongPhase: 'Das geht gerade nicht.',
  notYourTurn: 'Du bist nicht am Zug.',
  invalidSlot: 'Ungültige Karte.',
  emptySlot: 'Dort liegt keine Karte.',
  lockedCard: 'Die Karten des Cambio-Rufers sind gesperrt.',
  samePlayer: 'Wähle Karten von zwei verschiedenen Spielern.',
  cambioTooEarly: 'Cambio ist noch nicht erlaubt.',
  mustCallCambio: 'Du hast keine Karten mehr und musst Cambio rufen.',
  callerCannotAct: 'Nach deinem Cambio-Ruf darfst du nicht mehr abwerfen.',
  notOwnCard: 'Wähle eine eigene Karte.',
  unknownPlayer: 'Unbekannter Spieler.',
  emptyDeck: 'Es sind keine Karten mehr im Stapel.',
  timeout: 'Keine Antwort vom Server.',
};

export const errorText = (error: ClientError): string => MESSAGES[error] ?? 'Unbekannter Fehler.';
