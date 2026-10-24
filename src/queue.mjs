export class ResearchQueue {
  constructor(store, processor, { concurrency = 1, minIntervalMs = 1500, now = Date.now } = {}) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) throw new Error('Concurrency must be 1 or 2');
    this.store = store; this.processor = processor; this.concurrency = concurrency;
    this.minIntervalMs = minIntervalMs; this.now = now; this.active = new Map(); this.ids = new Set();
    this.running = false; this.lastStarted = -Infinity; this.pausedUntil = 0;
  }
  start(limit = 3) {
    if (this.running) return this.status();
    if (this.active.size) return { ...this.status(), message: 'The current videos are finishing. Start another batch after they finish.' };
    if (!Number.isInteger(limit) || limit < 1 || limit > 3) throw new Error('Proof of concept is limited to three videos per batch');
    // Freeze membership of each batch; imports during a batch cannot expand it.
    this.ids = new Set(this.store.list().filter(x => ['pending','retry_wait'].includes(x.status)).slice(0, limit).map(x => x.id));
    this.running = this.ids.size > 0;
    this.tick();
    if (this.running) this.timer = setInterval(() => this.tick(), 250);
    return this.status();
  }
  tick() {
    if (!this.running) return;
    const now = this.now();
    if (this.active.size < this.concurrency && now >= this.pausedUntil && now - this.lastStarted >= this.minIntervalMs) {
      const job = this.store.claim(now, this.ids);
      if (job) {
        this.lastStarted = now;
        const controller = new AbortController();
        this.active.set(job.id, controller);
        Promise.resolve().then(() => this.processor(job, controller.signal))
          .then(result => this.store.finish(job.id, result, this.now()))
          .catch(error => {
            if (controller.signal.aborted) { this.store.interrupt(job.id,this.now()); return; }
            if (error.retryAfterMs) this.pausedUntil = this.now() + Math.min(3600000, error.retryAfterMs);
            this.store.fail(job.id, error, this.now());
          }).finally(() => { this.active.delete(job.id); this.tick(); });
      }
    }
    if (!this.active.size && !this.store.hasReady(this.ids, now) && !this.store.hasWaiting(this.ids)) this.pause();
  }
  pause() { this.running = false; if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  async stop() { this.pause(); for (const controller of this.active.values()) controller.abort(); while (this.active.size) await new Promise(r => setTimeout(r, 20)); }
  status() { return { running: this.running, active: this.active.size, batchSize: this.ids.size, concurrency: this.concurrency, maxBatch: 3 }; }
}
