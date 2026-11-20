# Offline-first and sync

* **Reads** (`useRead`): network first; on a network failure the last saved response (AsyncStorage, max 24 h) is shown with a "last saved copy (offline)" ribbon. Cleared per product on sign-out.
* **Writes** go through `mutate()`. If the device is offline and the write is `queueable`, it is persisted in the queue (`src/offline/queue.ts`) with an **idempotency key**, owner, label and optional **precondition**; the UI says "Saved offline". Otherwise the error surfaces.
* **Replay** (`SyncDriver`): when connectivity returns, on app foreground and every 60 s. FIFO per owner (never another user's queue). Outcomes: 2xx => removed; network error => stop, still pending; precondition mismatch or HTTP 409 => **conflict**; other 4xx => **failed** (user action); 5xx/429 => retry, `failed` after 6 attempts.
* **Conflicts**: a queued edit carries the base revision (`updatedAt`) of the server record. At replay the server copy is re-read; if its revision changed, the op is parked as `conflict` with the server copy and **never silently overwrites clinical data**. The Sync centre (`/sync`) shows both versions; the user chooses *Keep my change* (re-queued without the precondition) or *Discard*.
* **Status chip** (`SyncChip`): Offline (n waiting) / Syncing / n waiting / n conflicts / All synced; offline banner on every tab.

## What may be queued
| Queueable | Never queued (online only, tagged `OFFLINE:` in code) |
|---|---|
| Clinic: visit draft save (`PATCH /encounters/:id`, precondition `updatedAt`), quick vitals, home-visit depart/finish/"I'm OK"/abort | Prescription sign, lab approve, SOS/arrive (geostamp must be live), sample hand-off |
| Pharmacy: stock-count lines (last write wins per lot), alert acks, inbox read marks | Rx override/sign-off/complete, receipts, countersign, order accept/reject, anything with money |
| Lab: specimen collect (idempotent) | Validation, report signing, release |

Safety alert acknowledgement is idempotent (first acknowledger wins), safe to retry.

## Limits
The queue is stored in app-sandbox storage (AsyncStorage) and cleared on sign-out; encrypting it with a SecureStore-held key is backlog (see SECURITY.md). Clinic has no server-side conflict API: `PATCH /encounters/:id` on a draft is last-write-wins, hence the client precondition.
