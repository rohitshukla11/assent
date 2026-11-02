/**
 * Every date the app shows is in UTC and says so: the server writes some of the text (the Verify headline,
 * refusals, the render steps), and the daily limits reset at 00:00 UTC. Dates are stored as milliseconds
 * since the epoch.
 */
const fmt = (ms: number, time: boolean) =>
  new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}), timeZone: "UTC" });

/** "1 Nov 2026 (UTC)" */
export const utcDay = (ms: number) => `${fmt(ms, false)} (UTC)`;

/** "1 Nov 2026, 16:57 (UTC)" */
export const utcDateTime = (ms: number) => `${fmt(ms, true)} (UTC)`;
