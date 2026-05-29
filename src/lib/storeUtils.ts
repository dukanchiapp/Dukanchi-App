export interface StoreStatus {
  isOpen: boolean;
  label: string;
  color: 'green' | 'yellow' | 'red';
  minutesUntilClose?: number;
}

const formatTime = (h: number, m: number): string => {
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export function getStoreStatus(
  openingTime?: string,
  closingTime?: string,
  is24Hours?: boolean,
  workingDays?: string,
): StoreStatus | null {
  if (workingDays) {
    const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
    if (!workingDays.includes(today)) return { isOpen: false, label: 'Closed Today', color: 'red' };
  }
  if (is24Hours) return { isOpen: true, label: 'Open 24h', color: 'green' };
  if (!openingTime || !closingTime) return null;

  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const openMins = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;
  const isOpen = closeMins > openMins
    ? nowMins >= openMins && nowMins < closeMins
    : nowMins >= openMins || nowMins < closeMins;

  if (isOpen) {
    const minsLeft = closeMins > nowMins ? closeMins - nowMins : (closeMins + 1440) - nowMins;
    if (minsLeft <= 60) {
      return { isOpen: true, label: `Closing in ${minsLeft} min${minsLeft === 1 ? '' : 's'}`, color: 'yellow', minutesUntilClose: minsLeft };
    }
    return { isOpen: true, label: `Open · Closes at ${formatTime(closeH, closeM)}`, color: 'green' };
  }
  return { isOpen: false, label: `Closed · Opens at ${formatTime(openH, openM)}`, color: 'red' };
}

export function statusColor(color: 'green' | 'yellow' | 'red'): string {
  if (color === 'yellow') return '#F59E0B';
  if (color === 'green') return '#10B981';
  return '#EF4444';
}
