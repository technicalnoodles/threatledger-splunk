/** Convert an explicit epoch or ISO timestamp (with timezone) into epoch seconds. */
export function absoluteTime(value: string | number): string {
  const text = String(value).trim();
  let seconds: number;
  if (/^\d+(?:\.\d+)?$/.test(text)) seconds = Number(text);
  else {
    const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/i.exec(text);
    if (!iso) throw new Error('Enter an absolute time with a timezone or epoch seconds.');
    const [, year, month, day, hour, minute, second = '0', zone] = iso;
    const y = Number(year), m = Number(month), d = Number(day);
    const maxDay = m >= 1 && m <= 12 ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 0;
    const zoneHours = zone.toUpperCase() === 'Z' ? 0 : Number(zone.slice(1, 3));
    const zoneMinutes = zone.toUpperCase() === 'Z' ? 0 : Number(zone.slice(4, 6));
    if (d < 1 || d > maxDay || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || zoneHours > 23 || zoneMinutes > 59) throw new Error('Invalid absolute time.');
    seconds = Date.parse(text) / 1000;
  }
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 253402300799) throw new Error('Invalid absolute time.');
  return String(seconds);
}
export function fixedTimeRange(earliest: string | number, latest: string | number) {
  const start = absoluteTime(earliest), end = absoluteTime(latest);
  if (Number(start) >= Number(end)) throw new Error('Earliest time must be before latest time.');
  return { earliest: start, latest: end };
}

export function describeFixedRange(earliest: string | number, latest: string | number): string {
  const range = fixedTimeRange(earliest, latest);
  const start = Number(range.earliest) === 0 ? 'All available time' : new Date(Number(range.earliest) * 1000).toISOString();
  return `${start} to ${new Date(Number(range.latest) * 1000).toISOString()} (UTC)`;
}

/** Ignore quoted literals, but detect modifiers in the main search and subsearches. */
export function containsTimeModifiers(spl: string): boolean {
  let visible = '', quote = '', escaped = false;
  for (const char of spl) {
    if (quote) {
      visible += ' ';
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") { quote = char; visible += ' '; }
    else visible += char;
  }
  return /(?:^|[\s\[(|])(?:earliest|latest|_index_earliest|_index_latest)\s*=/i.test(visible) || /(?:^|\|)\s*(?:savedsearch|loadjob)\b/i.test(visible) || /\b(?:now|relative_time|time)\s*\(/i.test(visible);
}

/** Offline snapshots cover fixed units only; calendar snapping needs Splunk's parser. */
export function resolveOfflineRange(earliest: string, latest: string, now = Date.now()) {
  const capture = Math.floor(now / 1000);
  const resolve = (input: string): string => {
    const text = input.trim();
    if (text.toLowerCase() === 'now') return String(capture);
    const match = /^-(\d+)(s|m|h|d|w)$/i.exec(text);
    if (match) {
      const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
      return String(capture - Number(match[1]) * units[match[2].toLowerCase()]);
    }
    try { return absoluteTime(text); } catch { throw new Error('This relative time needs Splunk to resolve it. Use an absolute timestamp or connect to Splunk.'); }
  };
  return { ...fixedTimeRange(resolve(earliest), resolve(latest)), capturedAt: new Date(capture * 1000).toISOString() };
}

/** Accept a job ID or a same-origin Splunk Search URL containing a job ID. */
export function searchJobId(input: string, origin: string): string {
  const value = input.trim();
  if (/^[A-Za-z0-9_.:-]{1,512}$/.test(value)) return value;
  let url: URL;
  try { url = new URL(value, origin); } catch { throw new Error('Enter a search job ID or a same-origin Splunk search link.'); }
  if (url.origin !== origin || !url.pathname.includes('/app/')) throw new Error('Search job links must point to this Splunk server.');
  const sid = url.searchParams.get('sid');
  if (!sid || !/^[A-Za-z0-9_.:-]{1,512}$/.test(sid)) throw new Error('This link has no search job ID. Open a completed search and copy its URL.');
  return sid;
}
