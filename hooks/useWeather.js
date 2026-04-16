import { useRef, useState } from "react";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MAX_QUERY_LENGTH = 100;

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

function getWeatherDescription(weatherCode) {
  return WEATHER_CODE_LABELS[weatherCode] || "Descripción no disponible";
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

function buildNetworkError(message) {
  return message || "Problema de red. Intenta nuevamente.";
}

export function useWeather() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const currentRequestId = useRef(0);
  const activeController = useRef(null);

  async function searchTemperature(queryString) {
    const query = String(queryString || "").trim();

    if (!query) {
      setError("Ingresa una ciudad.");
      setResult(null);
      setSuggestions([]);
      setLoading(false);
      return;
    }

    if (query.length > MAX_QUERY_LENGTH) {
      setError("La ciudad no puede superar 100 caracteres.");
      setResult(null);
      setSuggestions([]);
      setLoading(false);
      return;
    }

    currentRequestId.current += 1;
    const requestId = currentRequestId.current;

    if (activeController.current) {
      activeController.current.abort();
    }

    const controller = new AbortController();
    activeController.current = controller;

    setLoading(true);
    setError("");
    setSuggestions([]);

    try {
      const geocodingParams = new URLSearchParams({
        name: query,
        count: "5",
        language: "es",
        format: "json",
      });

      const geocodingResponse = await fetch(`${GEOCODING_URL}?${geocodingParams.toString()}`, {
        signal: controller.signal,
      });

      if (!geocodingResponse.ok) {
        throw new Error("No se pudo consultar la ciudad.");
      }

      const geocodingData = await geocodingResponse.json();

      if (requestId !== currentRequestId.current) {
        return;
      }

      const places = geocodingData.results || [];

      if (places.length === 0) {
        setError("Ciudad no encontrada.");
        setResult(null);
        setSuggestions([]);
        return;
      }

      const citySuggestions = normalizeSuggestions(places);
      setSuggestions(citySuggestions);

      const selectedPlace = places[0];
      const forecastParams = new URLSearchParams({
        latitude: String(selectedPlace.latitude),
        longitude: String(selectedPlace.longitude),
        current_weather: "true",
        temperature_unit: "celsius",
        timezone: "auto",
      });

      const forecastResponse = await fetch(`${FORECAST_URL}?${forecastParams.toString()}`, {
        signal: controller.signal,
      });

      if (!forecastResponse.ok) {
        throw new Error("No se pudo consultar el clima actual.");
      }

      const forecastData = await forecastResponse.json();

      if (requestId !== currentRequestId.current) {
        return;
      }

      const currentWeather = forecastData.current_weather;

      if (!currentWeather || typeof currentWeather.temperature !== "number") {
        throw new Error("La API devolvió datos del clima inválidos.");
      }

      setResult({
        city: selectedPlace.name,
        country: selectedPlace.country || "",
        temperature: currentWeather.temperature,
        description: getWeatherDescription(currentWeather.weathercode),
      });
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }

      const isNetworkError = err instanceof TypeError;
      setError(isNetworkError ? buildNetworkError() : err.message || "Ocurrió un error inesperado.");
      setResult(null);
      setSuggestions([]);
    } finally {
      if (requestId === currentRequestId.current) {
        setLoading(false);
      }
    }
  }

  return { loading, error, result, suggestions, searchTemperature };
}
