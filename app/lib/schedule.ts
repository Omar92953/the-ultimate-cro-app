/**
 * Scheduled offers (Pro): an offer can have a start and an end, in the store's time zone. The app switches it on
 * at the start and off at the end, once each, so a merchant who switches it by hand in between keeps that choice.
 * Pure: shared by the editors, the server job (schedule.server.ts) and the tests.
 */

export const SCHEDULE_TYPES = ["rule", "deal", "bundle"] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

/** A start or end as the merchant types it: a date (YYYY-MM-DD) and a time (HH:MM), in the store's time zone. */
export type LocalMoment = { date: string; time: string };
export type ScheduleInput = { start: LocalMoment | null; end: LocalMoment | null };
export type ScheduleRow = { startsAt: Date | null; endsAt: Date | null; startDone: boolean; endDone: boolean };

/** Every half hour of the day, for the time menus. */
export const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes the time zone is ahead of UTC at that moment (Cairo in summer: 180). */
function offsetMinutes(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The moment a store's local date and time happens. Null when the date or time isn't valid. */
export function toInstant(m: LocalMoment | null | undefined, timeZone: string): Date | null {
  if (!m || !DATE.test(m.date) || !TIME.test(m.time)) return null;
  const [y, mo, d] = m.date.split("-").map(Number);
  const [h, mi] = m.time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // A date that doesn't exist (13th month, 31 April) would roll over to another day.
  if (Number.isNaN(guess) || new Date(guess).toISOString().slice(0, 10) !== m.date) return null;
  // Twice, so a moment next to a daylight saving change lands on the right side of it.
  let at = new Date(guess - offsetMinutes(new Date(guess), timeZone) * 60_000);
  at = new Date(guess - offsetMinutes(at, timeZone) * 60_000);
  return at;
}

/** The store's local date and time of a moment. */
export function toLocal(at: Date | null | undefined, timeZone: string): LocalMoment | null {
  if (!at) return null;
  const local = new Date(at.getTime() + offsetMinutes(at, timeZone) * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** What's wrong with a schedule, in the merchant's words; null when it can be saved. */
export function scheduleProblem(s: { startsAt: Date | null; endsAt: Date | null }, now = new Date(), savedStart: Date | null = null): string | null {
  // A start that already passed can only stay as it was saved (the offer is running); a new one can't be in the past.
  if (s.startsAt && s.startsAt.getTime() < now.getTime() - 60_000 && s.startsAt.getTime() !== savedStart?.getTime()) return "The start is in the past. Choose a later start or remove it.";
  if (s.endsAt && s.endsAt.getTime() <= now.getTime()) return "The end is in the past. Choose a later end or remove it.";
  if (s.startsAt && s.endsAt && s.endsAt.getTime() <= s.startsAt.getTime()) return "The end must be after the start.";
  return null;
}

/** Whether a newly saved schedule means the offer should be on right now (off before its start). */
export function onNow(s: { startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  if (s.startsAt && s.startsAt.getTime() > now.getTime()) return false;
  if (s.endsAt && s.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/** What the job does now for one schedule: switch the offer on, off, or nothing. The end wins when both are due. */
export function dueAction(s: ScheduleRow, now = new Date()): "on" | "off" | null {
  const t = now.getTime();
  if (s.endsAt && !s.endDone && s.endsAt.getTime() <= t) return "off";
  if (s.startsAt && !s.startDone && s.startsAt.getTime() <= t) return "on";
  return null;
}

/** "Starts Fri 31 Oct, 09:00" / "Ends Sun 2 Nov, 23:30" for the offers list. */
export function scheduleLabel(s: { startsAt: Date | null; endsAt: Date | null }, timeZone: string, now = new Date()): string | null {
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).replace(/,? (\d{2}:\d{2})$/, ", $1");
  if (s.startsAt && s.startsAt.getTime() > now.getTime()) return `Starts ${fmt(s.startsAt)}`;
  if (s.endsAt && s.endsAt.getTime() > now.getTime()) return `Ends ${fmt(s.endsAt)}`;
  return null;
}
