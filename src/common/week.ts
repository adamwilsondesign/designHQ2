// Weeks run Monday to Sunday.
export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return x;
}

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function shiftWeek(weekOf: string, weeks: number): string {
  const [y, m, d] = weekOf.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + weeks * 7));
}

export function weekLabel(weekOf: string): string {
  const [y, m, d] = weekOf.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const f = (x: Date) => x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${f(start)} – ${f(end)}`;
}
