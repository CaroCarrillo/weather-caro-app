// Límites de seguridad
const LIMITS = {
  QUERY_MAX_LENGTH: 100,
  CITY_NAME_MAX_LENGTH: 100,
  COUNTRY_MAX_LENGTH: 100,
  ADMIN_MAX_LENGTH: 100,
  VARIANTS_MAX: 5,
  SUGGESTIONS_MAX: 5,
};

/**
 * Valida ciudadQuery para prevenir inyecciones
 * @param {string} query
 * @returns {Object} { valid: boolean, error: string|null, sanitized: string }
 */
export function validateCityQuery(query) {
  if (!query || typeof query !== "string") {
    return { valid: false, error: "Entrada inválida.", sanitized: "" };
  }

  const trimmed = query.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Campo requerido.", sanitized: "" };
  }

  if (trimmed.length > LIMITS.QUERY_MAX_LENGTH) {
    return {
      valid: false,
      error: `Máximo ${LIMITS.QUERY_MAX_LENGTH} caracteres.`,
      sanitized: "",
    };
  }

  // Solo permitir: letras, números, espacios, comas, guiones
  if (!/^[a-zA-Z0-9\s,\-áéíóúñ]*$/i.test(trimmed)) {
    return { valid: false, error: "Caracteres no permitidos.", sanitized: "" };
  }

  return { valid: true, error: null, sanitized: trimmed };
}

/**
 * Valida datos de un lugar desde la API
 * @param {Object} place
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validatePlace(place) {
  const errors = [];

  if (!place || typeof place !== "object") {
    errors.push("Lugar inválido.");
    return { valid: false, errors };
  }

  // Validar strings
  if (typeof place.name !== "string" || place.name.length > LIMITS.CITY_NAME_MAX_LENGTH) {
    errors.push("Nombre de ciudad inválido.");
  }

  if (place.country && (typeof place.country !== "string" || place.country.length > LIMITS.COUNTRY_MAX_LENGTH)) {
    errors.push("País inválido.");
  }

  if (place.admin1 && (typeof place.admin1 !== "string" || place.admin1.length > LIMITS.ADMIN_MAX_LENGTH)) {
    errors.push("Región inválida.");
  }

  // Validar números
  if (typeof place.latitude !== "number" || isNaN(place.latitude) || place.latitude < -90 || place.latitude > 90) {
    errors.push("Latitud inválida.");
  }

  if (typeof place.longitude !== "number" || isNaN(place.longitude) || place.longitude < -180 || place.longitude > 180) {
    errors.push("Longitud inválida.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida temperatura desde la API
 * @param {any} temp
 * @returns {Object} { valid: boolean, error: string|null, value: number }
 */
export function validateTemperature(temp) {
  if (typeof temp !== "number" || isNaN(temp)) {
    return { valid: false, error: "Temperatura inválida.", value: null };
  }

  // Rango razonable: -100 a 60 °C
  if (temp < -100 || temp > 60) {
    return { valid: false, error: "Temperatura fuera de rango.", value: null };
  }

  return { valid: true, error: null, value: temp };
}

/**
 * Sanitiza string para UI (escapa caracteres especiales)
 * @param {string} str
 * @returns {string}
 */
export function sanitizeString(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .slice(0, 150); // Límite extra de seguridad
}

/**
 * Valida respuesta completa de API
 * @param {any} data
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateAPIResponse(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    errors.push("Respuesta de API inválida.");
    return { valid: false, errors };
  }

  if (!Array.isArray(data.results)) {
    errors.push("Formato de API no esperado.");
  }

  return { valid: errors.length === 0, errors };
}
