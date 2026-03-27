export function buildUrl(path, user) {
  if (!user) return path;
  return `${path}?user=${encodeURIComponent(user)}`;
}

export function formatMatchDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatMatchTime(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date);
}

export function formatDateGroup(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getDateKey(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isMatchLocked(matchDate) {
  return new Date() >= new Date(matchDate);
}
