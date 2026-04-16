const DEFAULT_RUNTIME_CONFIG = {
  geocodingUrl: "https://geocoding-api.open-meteo.com/v1/search",
  forecastUrl: "https://api.open-meteo.com/v1/forecast",
  requestTimeoutMs: 8000,
  weatherApiKey: "",
};

function sanitizeUrl(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizeTimeout(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : fallback;
}

export function getWeatherRuntimeConfig() {
  const runtimeConfig = globalThis.__WEATHER_APP_ENV__ || {};

  return {
    geocodingUrl: sanitizeUrl(runtimeConfig.geocodingUrl, DEFAULT_RUNTIME_CONFIG.geocodingUrl),
    forecastUrl: sanitizeUrl(runtimeConfig.forecastUrl, DEFAULT_RUNTIME_CONFIG.forecastUrl),
    requestTimeoutMs: sanitizeTimeout(runtimeConfig.requestTimeoutMs, DEFAULT_RUNTIME_CONFIG.requestTimeoutMs),
    weatherApiKey:
      typeof runtimeConfig.weatherApiKey === "string" ? runtimeConfig.weatherApiKey.trim() : DEFAULT_RUNTIME_CONFIG.weatherApiKey,
  };
}
