import { validateCityQuery, validatePlace, validateTemperature } from "../utils/validators";
import { getWeatherRuntimeConfig } from "../config/runtimeConfig";

// Cache en memoria para evitar llamadas repetidas en ventanas cortas.
const CACHE_TTL_MS = 2 * 60 * 1000;
const weatherCache = new Map();

const WEATHER_CODE_LABELS = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla con escarcha",
  51: "Llovizna ligera",
  53: "Llovizna moderada",
  55: "Llovizna intensa",
  56: "Llovizna helada ligera",
  57: "Llovizna helada intensa",
  61: "Lluvia ligera",
  63: "Lluvia moderada",
  65: "Lluvia intensa",
  66: "Lluvia helada ligera",
  67: "Lluvia helada intensa",
  71: "Nevada ligera",
  73: "Nevada moderada",
  75: "Nevada intensa",
  77: "Granos de nieve",
  80: "Chubascos ligeros",
  81: "Chubascos moderados",
  82: "Chubascos intensos",
  85: "Chubascos de nieve ligeros",
  86: "Chubascos de nieve intensos",
  95: "Tormenta",
  96: "Tormenta con granizo leve",
  99: "Tormenta con granizo fuerte",
};

class WeatherApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "WeatherApiError";
    this.code = code;
  }
}

function getWeatherDescription(weatherCode) {
  return WEATHER_CODE_LABELS[weatherCode] || "Descripcion no disponible";
}

function normalizeSuggestions(results = []) {
  return results.map((place) => ({
    id: place.id,
    name: place.name,
    country: place.country || "",
    admin1: place.admin1 || "",
    latitude: place.latitude,
    longitude: place.longitude,
  }));
}

function getCombinedSignal(externalSignal, timeoutSignal) {
  if (!externalSignal) {
    return timeoutSignal;
  }

  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return AbortSignal.any([externalSignal, timeoutSignal]);
  }

  // Fallback para runtimes sin AbortSignal.any.
  // El bridge aborta si aborta la señal externa o la de timeout.
  const bridgeController = new AbortController();
  const abortBridge = () => bridgeController.abort();

  if (externalSignal.aborted || timeoutSignal.aborted) {
    abortBridge();
    return bridgeController.signal;
  }

  externalSignal.addEventListener("abort", abortBridge, { once: true });
  timeoutSignal.addEventListener("abort", abortBridge, { once: true });

  return bridgeController.signal;
}

function getNormalizedQuery(query) {
  return query.trim().toLocaleLowerCase("es");
}

function getCachedValue(cacheKey) {
  const entry = weatherCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    // Limpieza lazy: se elimina solo cuando se detecta expiracion.
    weatherCache.delete(cacheKey);
    return null;
  }

  return entry.data;
}

function setCachedValue(cacheKey, data) {
  weatherCache.set(cacheKey, {
    timestamp: Date.now(),
    data,
  });
}

async function fetchJson(url, { signal, requestErrorMessage }) {
  const runtimeConfig = getWeatherRuntimeConfig();
  // Cada request tiene timeout local para evitar esperas indefinidas.
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), runtimeConfig.requestTimeoutMs);

  try {
    const combinedSignal = getCombinedSignal(signal, timeoutController.signal);
    const response = await fetch(url, { signal: combinedSignal });

    if (!response.ok) {
      throw new WeatherApiError(requestErrorMessage, "HTTP_ERROR");
    }

    return await response.json();
  } catch (error) {
    // Si la cancelacion vino del caller, se propaga tal cual (AbortError).
    if (error.name === "AbortError") {
      if (signal?.aborted) {
        throw error;
      }

      // Si no fue cancelacion externa, tratamos el AbortError como timeout.
      throw new WeatherApiError("La peticion tardo demasiado. Intenta nuevamente.", "TIMEOUT");
    }

    if (error instanceof WeatherApiError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new WeatherApiError("Problema de red. Intenta nuevamente.", "NETWORK_ERROR");
    }

    throw new WeatherApiError("Ocurrio un error inesperado.", "UNKNOWN_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

function getHumidity(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 100) {
    return null;
  }

  return value;
}

function getWindSpeed(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return null;
  }

  return value;
}

/**
 * Consulta clima actual por ciudad usando Open-Meteo.
 *
 * Flujo:
 * 1. Valida la entrada del usuario.
 * 2. Busca coordenadas con Geocoding API.
 * 3. Consulta clima actual con Forecast API.
 * 4. Devuelve resultado normalizado + sugerencias.
 *
 * @param {string} queryString
 * Nombre de ciudad ingresado por el usuario.
 *
 * @param {{ signal?: AbortSignal }} [options]
 * Opciones de ejecucion. Permite cancelar la peticion con AbortController.
 *
 * @returns {Promise<{
 *   result: {
 *     city: string,
 *     country: string,
 *     temperature: number,
 *     humidity: number | null,
 *     windSpeed: number | null,
 *     description: string
 *   },
 *   suggestions: Array<{
 *     id: number | undefined,
 *     name: string,
 *     country: string,
 *     admin1: string,
 *     latitude: number,
 *     longitude: number
 *   }>
 * }>} Datos del clima listos para UI.
 *
 * @throws {WeatherApiError}
 * Se lanza cuando hay errores de validacion, red, timeout, HTTP o datos invalidos.
 *
 * @example
 * const controller = new AbortController();
 *
 * try {
 *   const data = await getWeather("Bogota", { signal: controller.signal });
 *   console.log(data.result.temperature); // 14.2
 *   console.log(data.result.windSpeed);   // 10.5
 * } catch (error) {
 *   console.error(error.message);
 * }
 */
export async function getWeather(queryString, { signal } = {}) {
  const runtimeConfig = getWeatherRuntimeConfig();
  const queryValidation = validateCityQuery(queryString);

  if (!queryValidation.valid) {
    if (queryValidation.error === "Entrada inválida.") {
      throw new WeatherApiError("Entrada invalida.", "VALIDATION_ERROR");
    }

    if (queryValidation.error === "Campo requerido.") {
      throw new WeatherApiError("Ingresa una ciudad.", "VALIDATION_ERROR");
    }

    if (queryValidation.error?.includes("Maximo") || queryValidation.error?.includes("Máximo")) {
      throw new WeatherApiError("La ciudad no puede superar 100 caracteres.", "VALIDATION_ERROR");
    }

    throw new WeatherApiError("El nombre contiene caracteres no validos.", "VALIDATION_ERROR");
  }

  const cacheKey = getNormalizedQuery(queryValidation.sanitized);
  const cachedData = getCachedValue(cacheKey);

  if (cachedData) {
    // Early return para acelerar busquedas repetidas.
    return cachedData;
  }

  const geocodingParams = new URLSearchParams({
    name: queryValidation.sanitized,
    count: "5",
    language: "es",
    format: "json",
  });

  const geocodingData = await fetchJson(`${runtimeConfig.geocodingUrl}?${geocodingParams.toString()}`, {
    signal,
    requestErrorMessage: "No se pudo consultar la ciudad.",
  });

  const places = Array.isArray(geocodingData.results) ? geocodingData.results : [];
  const validPlaces = places.filter((place) => validatePlace(place).valid);

  if (validPlaces.length === 0) {
    throw new WeatherApiError("Ciudad no encontrada.", "CITY_NOT_FOUND");
  }

  const selectedPlace = validPlaces[0];
  // Estrategia: usar la mejor coincidencia y exponer todas como sugerencias.
  const forecastParams = new URLSearchParams({
    latitude: String(selectedPlace.latitude),
    longitude: String(selectedPlace.longitude),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    timezone: "auto",
  });

  const forecastData = await fetchJson(`${runtimeConfig.forecastUrl}?${forecastParams.toString()}`, {
    signal,
    requestErrorMessage: "No se pudo consultar el clima actual.",
  });

  const current = forecastData.current;
  const temperatureValidation = validateTemperature(current?.temperature_2m);

  if (!current || !temperatureValidation.valid) {
    throw new WeatherApiError("La API devolvio datos del clima invalidos.", "INVALID_DATA");
  }

  const weatherData = {
    result: {
      city: selectedPlace.name,
      country: selectedPlace.country || "",
      temperature: temperatureValidation.value,
      humidity: getHumidity(current.relative_humidity_2m),
      windSpeed: getWindSpeed(current.wind_speed_10m),
      description: getWeatherDescription(current.weathercode),
    },
    suggestions: normalizeSuggestions(validPlaces),
  };

  setCachedValue(cacheKey, weatherData);

  return weatherData;
}

export { WeatherApiError };