const STORAGE_CONSENT_KEY = "weather-app:storage-consent";
const LAST_CITY_KEY = "weather-app:last-city";

export const STORAGE_CONSENT_STATUS = {
  UNKNOWN: "unknown",
  GRANTED: "granted",
  DENIED: "denied",
};

function getLocalStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }

    return window.localStorage;
  } catch {
    return null;
  }
}

function sanitizeRememberedCity(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 100);
}

export function getStorageConsentStatus() {
  const storage = getLocalStorage();
  const value = storage?.getItem(STORAGE_CONSENT_KEY);

  if (value === STORAGE_CONSENT_STATUS.GRANTED || value === STORAGE_CONSENT_STATUS.DENIED) {
    return value;
  }

  return STORAGE_CONSENT_STATUS.UNKNOWN;
}

export function setStorageConsentStatus(status) {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  if (status === STORAGE_CONSENT_STATUS.GRANTED || status === STORAGE_CONSENT_STATUS.DENIED) {
    storage.setItem(STORAGE_CONSENT_KEY, status);
  } else {
    storage.removeItem(STORAGE_CONSENT_KEY);
  }

  if (status !== STORAGE_CONSENT_STATUS.GRANTED) {
    storage.removeItem(LAST_CITY_KEY);
  }
}

export function loadRememberedCity() {
  const storage = getLocalStorage();

  if (!storage || getStorageConsentStatus() !== STORAGE_CONSENT_STATUS.GRANTED) {
    return "";
  }

  return sanitizeRememberedCity(storage.getItem(LAST_CITY_KEY));
}

export function saveRememberedCity(city) {
  const storage = getLocalStorage();

  if (!storage || getStorageConsentStatus() !== STORAGE_CONSENT_STATUS.GRANTED) {
    return;
  }

  const value = sanitizeRememberedCity(city);

  if (!value) {
    storage.removeItem(LAST_CITY_KEY);
    return;
  }

  storage.setItem(LAST_CITY_KEY, value);
}

export function clearRememberedCity() {
  const storage = getLocalStorage();
  storage?.removeItem(LAST_CITY_KEY);
}
