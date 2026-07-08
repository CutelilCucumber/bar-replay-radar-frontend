class RateLimiter {
  constructor(capacity, refillPerSec) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerSec = refillPerSec;
    this.lastRefill = Date.now();
  }
  async acquire() {
    for (;;) {
      const now = Date.now();
      const elapsed = (now - this.lastRefill) / 1000;
      this.tokens = Math.min(
        this.capacity,
        this.tokens + elapsed * this.refillPerSec,
      );
      this.lastRefill = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = ((1 - this.tokens) / this.refillPerSec) * 1000;
      await new Promise((r) => setTimeout(r, Math.max(50, waitMs)));
    }
  }
}
const rateLimiter = new RateLimiter(300, 1);

export default async function getJson(url) {
  await rateLimiter.acquire();
  const res = await fetch(url, {
    referrerPolicy: "strict-origin-when-cross-origin",
  });

  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const body = await res.json();
  return body.data ?? body;
}
