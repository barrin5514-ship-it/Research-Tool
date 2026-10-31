// Counts Brave searches per calendar month so the owner stays inside the free
// $5 credit (about 1,000 searches). When the month's allowance is gone, searches
// stop with a plain message instead of creating a paid overage.
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
export const BRAVE_FREE_MONTHLY = 1000;

// Used in tests and in any caller that has no quota file configured.
export const unlimitedQuota = {
  status: () => ({ month: 'unlimited', used: 0, limit: null, remaining: Number.MAX_SAFE_INTEGER }),
  reserve: async () => ({ allowed: true, month: 'unlimited', used: 0, limit: null, remaining: Number.MAX_SAFE_INTEGER })
};

export function monthKey(now = Date.now()) {
  const date = new Date(now);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function readQuotaSync(file, limit = BRAVE_FREE_MONTHLY, now = Date.now()) {
  const month = monthKey(now);
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    if (saved.month !== month) return { month, used: 0, limit, remaining: limit };
    const used = Math.max(0, Math.floor(Number(saved.count) || 0));
    return { month, used, limit, remaining: Math.max(0, limit - used) };
  } catch {
    return { month, used: 0, limit, remaining: limit };
  }
}

export class BraveQuota {
  constructor({ file, limit = BRAVE_FREE_MONTHLY, now = Date.now } = {}) {
    Object.assign(this, { file, limit, now });
    if (!Number.isInteger(limit) || limit < 1) throw Error('Brave monthly search limit must be a positive whole number');
  }
  status() { return readQuotaSync(this.file, this.limit, this.now()); }
  // Reserve n searches up front so a partly finished check cannot overspend.
  async reserve(n = 1) {
    const state = this.status();
    if (state.remaining < n) return { allowed: false, ...state };
    const used = state.used + n;
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify({ month: state.month, count: used }), { encoding: 'utf8' });
    return { allowed: true, month: state.month, used, limit: this.limit, remaining: this.limit - used };
  }
}

export function freeLimitMessage(state) {
  const limit = state?.limit ?? BRAVE_FREE_MONTHLY;
  return `The free Brave search limit for this month is used up (${state?.used ?? limit} of ${limit}). No paid search was made. Searches resume next month.`;
}
