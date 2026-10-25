export class ResearchQueue {
  constructor(store, processor, { concurrency = 1, minIntervalMs = 1500, now = Date.now } = {}) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 1) throw new Error('Concurrency must be 1');
    this.store = store; this.processor = processor; this.concurrency = concurrency;
    this.minIntervalMs = minIntervalMs; this.now = now; this.active = new Map(); this.ids = new Set();
    this.running = false; this.lastStarted = -Infinity; this.pausedUntil = 0;
  }
  start(limit = 10, allowedIds) {
    if (this.running) return this.status();
    if (this.active.size) return { ...this.status(), message: 'The current videos are finishing. Start another batch after they finish.' };
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error('Batch size must be between 1 and 25');
    // Freeze membership of each batch; imports during a batch cannot expand it.
    this.ids = new Set(this.store.list().filter(x => ['pending','retry_wait'].includes(x.status)&&(!allowedIds||allowedIds.has(x.id))).slice(0, limit).map(x => x.id));
    this.finished=new Set();this.startedAt=this.now();this.durations=[];this.reason=null;
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
        this.lastStarted = now;const began=now;
        const controller = new AbortController();
        this.active.set(job.id, controller);
        Promise.resolve().then(() => this.processor(job, controller.signal))
          .then(result => {this.store.finish(job.id, result, this.now());this.finished.add(job.id);})
          .catch(error => {
            if (controller.signal.aborted) { this.store.interrupt(job.id,this.now()); return; }
            if (error.retryAfterMs) this.pausedUntil = this.now() + Math.min(3600000, error.retryAfterMs);
            this.store.fail(job.id, error, this.now());if(this.store.get(job.id)?.status==='failed')this.finished.add(job.id);
          }).finally(() => {this.durations.push(this.now()-began);this.lastStarted=this.now();this.active.delete(job.id);this.tick();if(!this.running&&!this.active.size)this.onIdle?.();});
      }
    }
    if (!this.active.size && !this.store.hasReady(this.ids, now) && !this.store.hasWaiting(this.ids)) this.pause();
  }
  pause(reason) { if(reason)this.reason=reason;this.running = false; if (this.timer) clearInterval(this.timer); this.timer = undefined;if(!this.active.size)this.onIdle?.(); }
  async stop() { this.pause(); for (const controller of this.active.values()) controller.abort(); while (this.active.size) await new Promise(r => setTimeout(r, 20)); }
  status() { return { running: this.running, active: this.active.size, batchSize: this.ids.size, concurrency: this.concurrency, maxBatch: 25, done:this.finished?.size||0, estimatedSecondsLeft:this.running?Math.ceil(((this.ids.size-(this.finished?.size||0))*(this.durations?.length?this.durations.reduce((a,b)=>a+b,0)/this.durations.length:120)+Math.max(0,this.ids.size-(this.finished?.size||0)-1)*this.minIntervalMs)/1000):0, etaIsEstimate:true, stopReason:this.reason||null }; }
}
