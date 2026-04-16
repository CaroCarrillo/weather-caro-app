import { validatePlace, validateAPIResponse, validateTemperature } from "../utils/validators";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REQUEST_TIMEOUT = 5000; // 5 segundos

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchVariants(query) {
  const compact = query.replace(/[,.;:]/g, " ").replace(/\s+/g, " ").trim();
  const pieces = compact.split(" ").filter(Boolean);
  const variants = new Set([query, compact]);

  if (pieces.length >= 2) {
    variants.add(pieces.slice(0, 2).join(" "));
  }

  if (pieces.length >= 3) {
    variants.add(pieces.slice(0, pieces.length - 1).join(" "));
  }

  return [...variants].filter(Boolean);
}

async function geocodeSearch(query, count = 5) {
  // Validar parámetros
  if (typeof count !== "number" || count < 1 || count > 10) {
    count = 5;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const url = `${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=${count}&language=es&format=json`;
    const res = await fetch(url, { signal: controller.signal });
    
    if (!res.ok) {
      throw new Error("No se pudo buscar la ciudad.");
    }

    const data = await res.json();
    const validation = validateAPIResponse(data);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }

    // Validar cada resultado
    const validResults = data.results.filter((place) => {
      const placeValidation = validatePlace(place);
      return placeValidation.valid;
    });

    return validResults;
  } finally {
    clearTimeout(timeout);
  }
}

export async function geocodeCity(query) {
  const results = await geocodeSearch(query, 10);
  if (results.length === 0) {
    const error = new Error("No se encontraron resultados para esa ciudad.");
    error.code = "CITY_NOT_FOUND";
    throw error;
  }

  const normalizedQuery = normalizeText(query);
  const exact = results.find((item) => normalizeText(item.name) === normalizedQuery);

  return exact || results[0];
}

export async function suggestCities(query) {
  const variants = buildSearchVariants(query);
  const all = [];

  for (const variant of variants) {
    const matches = await geocodeSearch(variant, 5);
    all.push(...matches);
  }

  const seen = new Set();
  const unique = [];

  for (const item of all) {
    const key = `${item.name}|${item.country}|${item.admin1 || ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique.slice(0, 5);
}

export async function getCurrentTemperature(latitude, longitude) {
  // Validar números
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    isNaN(latitude) ||
    isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Coordenadas inválidas.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m",
      timezone: "auto",
    });

    const res = await fetch(`${FORECAST_URL}?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error("No se pudo obtener la temperatura.");
    }

    const data = await res.json();
    const tempValidation = validateTemperature(data.current?.temperature_2m);
    if (!tempValidation.valid) {
      throw new Error(tempValidation.error);
    }

    return tempValidation.value;
  } finally {
    clearTimeout(timeout);
  }
}
