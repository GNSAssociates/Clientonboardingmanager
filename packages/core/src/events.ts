import { randomUUID } from "node:crypto";
import { insertEvent, listPendingEvents, markEventDispatched, type EventRow, type Tx } from "@gns/db";

/**
 * Outbox helpers (A2 §5, NFR-REL-1). `emitEvent` writes a domain event in the
 * SAME transaction as the state change (transactional outbox). The dispatcher
 * (worker / n8n bridge in M12) delivers them at-least-once; idempotency keys
 * make side effects effectively-once.
 */
export async function emitEvent(
  tx: Tx,
  input: { entityId: string; type: string; payload?: Record<string, unknown> },
): Promise<void> {
  await insertEvent(tx, {
    entityId: input.entityId,
    type: input.type,
    payload: input.payload ?? {},
    idempotencyKey: randomUUID(),
  });
}

/**
 * Drain pending events. M2 ships a default logging deliverer; M12 swaps in the
 * signed n8n webhook delivery with retry/backoff/dead-letter.
 */
export async function dispatchPendingEvents(
  deliver: (event: EventRow) => Promise<void> = async (e) => {
    // eslint-disable-next-line no-console
    console.log(`[outbox] ${e.type}`, e.payload);
  },
): Promise<{ dispatched: number; failed: number }> {
  const pending = await listPendingEvents();
  let dispatched = 0;
  let failed = 0;
  for (const event of pending) {
    try {
      await deliver(event);
      await markEventDispatched(event.id);
      dispatched += 1;
    } catch {
      failed += 1; // left pending; M12 adds attempt/backoff/dead-letter
    }
  }
  return { dispatched, failed };
}
