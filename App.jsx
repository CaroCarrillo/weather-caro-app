import { useEffect, useState } from "react";
import { useWeather } from "./hooks/useWeather";
import { sanitizeString } from "./utils/validators";
import {
  clearRememberedCity,
  getStorageConsentStatus,
  loadRememberedCity,
  saveRememberedCity,
  setStorageConsentStatus,
  STORAGE_CONSENT_STATUS,
} from "./utils/privacyPreferences";

const DEFAULT_CITY = "GRAND";

/**
 * Pantalla principal de la aplicacion de clima.
 *
 * Permite:
 * - Escribir una ciudad.
 * - Consultar clima actual mediante el hook useWeather.
 * - Seleccionar sugerencias cuando hay multiples coincidencias.
 */
export default function App() {
  const [city, setCity] = useState(() => loadRememberedCity() || DEFAULT_CITY);
  const [storageConsent, setStorageConsent] = useState(() => getStorageConsentStatus());
  const { loading, error, result, suggestions, searchTemperature } = useWeather();

  const hasStorageConsent = storageConsent === STORAGE_CONSENT_STATUS.GRANTED;

  useEffect(() => {
    if (!hasStorageConsent || !result) {
      return;
    }

    const rememberedCity = [result.city, result.country].filter(Boolean).join(", ");
    saveRememberedCity(rememberedCity);
  }, [hasStorageConsent, result]);

  /**
   * Convierte una descripcion textual de clima en un icono.
   * @param {string} description
   * @returns {string}
   */
  function getWeatherIcon(description) {
    const text = String(description || "").toLowerCase();

    if (text.includes("tormenta")) return "⛈️";
    if (text.includes("granizo")) return "🌨️";
    if (text.includes("nieve") || text.includes("nevada")) return "❄️";
    if (text.includes("lluvia") || text.includes("llovizna") || text.includes("chubasco")) return "🌧️";
    if (text.includes("neblina")) return "🌫️";
    if (text.includes("nublado")) return "☁️";
    if (text.includes("despejado")) return "☀️";

    return "🌤️";
  }

  /**
   * Formatea una sugerencia de ciudad para mostrarla en UI.
   * @param {{name?: string, admin1?: string, country?: string}} place
   * @returns {string}
   */
  function formatSuggestion(place) {
    const parts = [place.name, place.admin1, place.country].filter(Boolean).map(sanitizeString);
    return parts.join(", ");
  }

  /**
   * Ejecuta una nueva busqueda al seleccionar una sugerencia.
   * @param {{name?: string, admin1?: string, country?: string}} place
   */
  function handleSuggestionClick(place) {
    const suggestedText = formatSuggestion(place);
    setCity(suggestedText);
    searchTemperature(suggestedText);
  }

  /**
   * Sincroniza el valor del input con estado local.
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  function handleInputChange(event) {
    const value = event.target.value;
    // Limitar a 100 caracteres en el input directamente
    if (value.length <= 100) {
      setCity(value);
    }
  }

  /**
   * Maneja el submit del formulario y dispara la consulta de clima.
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  function handleSubmit(event) {
    event.preventDefault();
    searchTemperature(city);
  }

  function handleStorageConsent(nextStatus) {
    setStorageConsentStatus(nextStatus);
    setStorageConsent(nextStatus);

    if (nextStatus !== STORAGE_CONSENT_STATUS.GRANTED) {
      clearRememberedCity();
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h1>Clima por ciudad</h1>
        <p className="subtitle">Ingresa una ciudad, por ejemplo: GRAND PRAIRIE</p>

        {storageConsent === STORAGE_CONSENT_STATUS.UNKNOWN && (
          <section className="privacy-banner" aria-label="Preferencias de privacidad">
            <p className="privacy-copy">
              Podemos recordar solo tu ultima ciudad en este dispositivo. No guardamos coordenadas ni resultados del clima.
            </p>
            <div className="privacy-actions">
              <button type="button" className="secondary-button" onClick={() => handleStorageConsent(STORAGE_CONSENT_STATUS.GRANTED)}>
                Aceptar
              </button>
              <button type="button" className="ghost-button" onClick={() => handleStorageConsent(STORAGE_CONSENT_STATUS.DENIED)}>
                Ahora no
              </button>
            </div>
          </section>
        )}

        <form className="form" onSubmit={handleSubmit}>
          <input
            value={city}
            onChange={handleInputChange}
            placeholder="Ciudad y país"
            aria-label="Ciudad y país"
            maxLength="100"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
        </form>

        {error && <p className="error">{sanitizeString(error)}</p>}

        <p className="privacy-note">
          {hasStorageConsent
            ? "Privacidad: solo se recuerda tu ultima ciudad en este dispositivo. Nunca guardamos tu ubicacion exacta."
            : "Privacidad: no guardamos tus busquedas ni tu ubicacion sin tu consentimiento."}
        </p>

        {suggestions.length > 0 && (
          <section className="suggestions" aria-label="Sugerencias de ciudad">
            <p className="suggestions-title">Quisiste decir:</p>
            <div className="suggestions-list">
              {suggestions.map((place) => {
                const label = formatSuggestion(place);
                const key = `${place.id || ""}-${place.latitude}-${place.longitude}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleSuggestionClick(place)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {result && (
          <article className="result">
            <h2>
              {sanitizeString(result.city)}, {sanitizeString(result.country)}
            </h2>
            <p className="weather-line">Temperatura actual: {result.temperature.toFixed(1)} °C</p>
            {typeof result.windSpeed === "number" && (
              <p className="weather-line">Viento: {result.windSpeed.toFixed(1)} km/h</p>
            )}
            {typeof result.humidity === "number" && (
              <p className="weather-line">Humedad: {result.humidity.toFixed(0)}%</p>
            )}
            <p className="weather-line">
              <span className="weather-icon" aria-hidden="true">
                {getWeatherIcon(result.description)}
              </span>
              <span>Condición: {sanitizeString(result.description)}</span>
            </p>
          </article>
        )}
      </section>
    </main>
  );
}
