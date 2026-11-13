const bucharest = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** An ISO instant as Romanian-time text, e.g. "12 nov., 07:00:00". */
export function formatBucharest(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : bucharest.format(d);
}
