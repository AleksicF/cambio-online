import { z } from 'zod';
import type { PlayerAction, Session } from '@cambio/shared';

const slot = z.number().int().min(0).max(63);
const slotRef = z.object({ playerId: z.string().max(64), slot });

const playerAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('drawFromDeck') }),
  z.object({ type: z.literal('takeDiscard'), slot }),
  z.object({ type: z.literal('swapDrawn'), slot }),
  z.object({ type: z.literal('discardDrawn') }),
  z.object({ type: z.literal('callCambio') }),
  z.object({ type: z.literal('peekOwn'), slot }),
  z.object({ type: z.literal('peekOther'), target: slotRef }),
  z.object({ type: z.literal('blindSwap'), a: slotRef, b: slotRef }),
  z.object({ type: z.literal('kingPeek'), target: slotRef }),
  z.object({ type: z.literal('kingSwap'), a: slotRef, b: slotRef }),
  z.object({ type: z.literal('skipAbility') }),
  z.object({ type: z.literal('snap'), target: slotRef }),
  z.object({ type: z.literal('giveCard'), slot }),
]);

const session = z.object({
  roomCode: z.string().max(16),
  playerId: z.string().max(64),
  token: z.string().max(64),
});

export function parseAction(input: unknown): PlayerAction | null {
  const r = playerAction.safeParse(input);
  return r.success ? r.data : null;
}

export function parseSession(input: unknown): Session | null {
  const r = session.safeParse(input);
  return r.success ? r.data : null;
}

export function parseObject(input: unknown): Record<string, unknown> | null {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}
