import { useRef, useState } from "react";
import { getWeather } from "../services/weatherApi";

/**
 * Hook de alto nivel para consultar clima y exponer estado de UI.
 *
 * Responsabilidades:
 * 1. Manejar estados de carga, error, resultado y sugerencias.
 * 2. Cancelar peticiones previas cuando llega una nueva busqueda.
 * 3. Evitar race conditions con control por requestId.
 *
 * @returns {{
 *   loading: boolean,
 *   error: string,
 *   result: {
 *     city: string,
 *     country: string,
 *     temperature: number,
 *     humidity: number | null,
 *     windSpeed: number | null,
 *     description: string
 *   } | null,
 *   suggestions: Array<{
 *     id: number | undefined,
 *     name: string,
 *     country: string,
 *     admin1: string,
 *     latitude: number,
 *     longitude: number
 *   }>,
 *   searchTemperature: (queryString: string) => Promise<void>
 * }} Estado y acciones para consumir desde componentes React.
 *
 * @example
 * const { loading, error, result, searchTemperature } = useWeather();
 *
 * useEffect(() => {
 *   searchTemperature("Bogota");
 * }, [searchTemperature]);
 */
export function useWeather() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const currentRequestId = useRef(0);
  const activeController = useRef(null);

  /**
   * Ejecuta la busqueda de clima para una ciudad.
   *
   * @param {string} queryString
   * Texto ingresado por el usuario para buscar la ciudad.
   *
   * @returns {Promise<void>}
   * Resuelve cuando la operacion finaliza (exitosa o con error manejado).
   */
  async function searchTemperature(queryString) {
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
      const data = await getWeather(queryString, { signal: controller.signal });

      if (requestId !== currentRequestId.current) {
        return;
      }

      setResult(data.result);
      setSuggestions(data.suggestions);
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }

      setError(err.message || "Ocurrio un error inesperado.");
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
