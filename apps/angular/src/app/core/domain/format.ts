/**
 * Presentation formatting helpers.
 * Currency and date formatting are centralised so prices render identically
 * everywhere — the same value must never appear in two different shapes.
 */

const CURRENCY = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CURRENCY_COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DATE_ONLY = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const TIME_ONLY = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** `1250` → `"1,250.00"` (currency symbol is rendered separately in the UI). */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return CURRENCY.format(value);
}

export function formatAmountCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return CURRENCY_COMPACT.format(value);
}

/** Full timestamp, used for bid history and audit fields. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE_TIME.format(d);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE_ONLY.format(d);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : TIME_ONLY.format(d);
}

/**
 * Breaks a millisecond duration into its parts for a countdown.
 * Returns zeroed parts for a negative duration so callers can render "Ended".
 */
export interface DurationParts {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  negative: boolean;
}

export function toDurationParts(ms: number): DurationParts {
  const negative = ms < 0;
  const total = Math.max(0, ms);
  const seconds = Math.floor(total / 1000);
  return {
    total,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    negative,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Coarse human duration: `2d 04h`, `04h 12m`, `12m 30s`, `38s`. */
export function formatDuration(ms: number): string {
  const { days, hours, minutes, seconds, negative } = toDurationParts(ms);
  if (negative) return '—';
  if (days > 0) return `${days}d ${pad(hours)}h`;
  if (hours > 0) return `${pad(hours)}h ${pad(minutes)}m`;
  if (minutes > 0) return `${pad(minutes)}m ${pad(seconds)}s`;
  return `${seconds}s`;
}

/** Precise countdown: `2d 04:12:30`, `04:12:30`, `12:30`. */
export function formatCountdown(ms: number): string {
  const { days, hours, minutes, seconds, negative } = toDurationParts(ms);
  if (negative) return '00:00';
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Relative time for recent activity: `just now`, `12m ago`, `3h ago`. */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';

  const diff = now - t;
  if (diff < 45_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.round(diff / 86_400_000)}d ago`;
  return formatDate(iso);
}

/** Initials for avatar fallbacks: "Ayu Lestari" → "AL". */
export function initials(first?: string | null, last?: string | null): string {
  const a = (first ?? '').trim()[0] ?? '';
  const b = (last ?? '').trim()[0] ?? '';
  const value = (a + b).toUpperCase();
  if (value) return value;
  const single = (first ?? last ?? '').trim()[0];
  return single ? single.toUpperCase() : '?';
}

export function fullName(first?: string | null, last?: string | null): string {
  const name = [first, last].filter(Boolean).join(' ').trim();
  return name || '—';
}

/** Short display form of an identifier for dense layouts. */
export function shortId(id: string | null | undefined, length = 8): string {
  if (!id) return '—';
  return id.length <= length ? id : `${id.slice(0, length)}…`;
}

/**
 * Parses a `datetime-local` input value as a local Date and returns ISO.
 * The value has no timezone, so it is interpreted in the user's local zone —
 * which is what an operator entering "starts 09:00" expects.
 */
export function localInputToIso(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Formats an ISO timestamp for a `datetime-local` input in local time. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

/** Parses a user-entered amount, tolerating spaces, commas and a currency symbol. */
export function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}
