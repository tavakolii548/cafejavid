/** Tehran wall-clock hour 0–23. */
export function tehranHourNow(date = new Date()): number {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  );
  return Number.isFinite(hour) ? hour : date.getUTCHours();
}

/**
 * Product order window in Tehran local hours.
 * Both null → always open. Otherwise both must be set (0–23).
 * Same-day: start <= hour < end. Overnight (start > end): hour >= start || hour < end.
 */
export function isWithinServiceHours(
  startHour: number | null | undefined,
  endHour: number | null | undefined,
  hour = tehranHourNow(),
): boolean {
  if (startHour == null || endHour == null) return true;
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export function isOutsideServiceHours(
  startHour: number | null | undefined,
  endHour: number | null | undefined,
  hour = tehranHourNow(),
): boolean {
  return !isWithinServiceHours(startHour, endHour, hour);
}
