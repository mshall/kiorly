/** A staff deep link that needs a session is held here and replayed once signed in. In memory only; never contains a token. */
let pending: string | null = null;
export const setPendingRoute = (route: string | null) => { pending = route; };
export const takePendingRoute = (): string | null => { const p = pending; pending = null; return p; };
export const peekPendingRoute = (): string | null => pending;
