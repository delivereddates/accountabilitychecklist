// Identity + clock seam for the local-first layer. Everything that mints an
// id or stamps a timestamp goes through here, so a sanity clamp or hybrid
// clock could be introduced in one place later if LWW skew ever bites.

export function newId(): string {
  return crypto.randomUUID();
}

export function nowMs(): number {
  return Date.now();
}
