const STORAGE_KEY = 'ipl-predict-identity';

export function getClaimedIdentity() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function claimIdentity(userName) {
  try {
    localStorage.setItem(STORAGE_KEY, userName);
  } catch {
    // localStorage not available (e.g. some private browsing modes)
  }
}

export function isOwnProfile(urlUser) {
  const claimed = getClaimedIdentity();
  return claimed && claimed === urlUser;
}

export function hasClaimedIdentity() {
  return !!getClaimedIdentity();
}

export function clearIdentity() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
