import { useState } from "react";
import { suggestCities } from "../services/openMeteoApi";
import { getWeatherByCity } from "../services/getWeatherByCity";
import { validateCityQuery, validatePlace } from "../utils/validators";

export function useWeather() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  async function searchTemperature(cityQuery) {
    setLoading(true);
    setError("");
    setSuggestions([]);

    // Validar entrada
    const queryValidation = validateCityQuery(cityQuery);
    if (!queryValidation.valid) {
      setError(queryValidation.error);
      setLoading(false);
      return;
    }

    try {
      const weather = await getWeatherByCity(queryValidation.sanitized);

      setResult({
        city: weather.ciudad,
        country: weather.pais || "",
        temperature: weather.temperatura,
        description: weather.descripcion,
      });
    } catch (err) {
      setResult(null);

      const notFound =
        err.code === "CITY_NOT_FOUND" ||
        String(err.message || "").includes("No se encontr");

      if (notFound) {
        try {
          const suggestionResults = await suggestCities(queryValidation.sanitized);
          setSuggestions(suggestionResults.filter((place) => validatePlace(place).valid));
        } catch {
          setSuggestions([]);
        }
      }

      setError(err.message || "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, result, suggestions, searchTemperature };
}
