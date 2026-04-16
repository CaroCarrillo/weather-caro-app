/**
 * getWeatherByCity.js
 *
 * Función para principiantes que consulta el clima de una ciudad.
 *
 * Cómo funciona:
 *   1. Recibe el nombre de una ciudad (texto).
 *   2. Consulta la Geocoding API de Open-Meteo para obtener latitud y longitud.
 *   3. Usa esas coordenadas para consultar el clima actual.
 *   4. Devuelve un objeto con el nombre de la ciudad, temperatura y descripción.
 *
 * Ejemplo de uso:
 *
 *   import { getWeatherByCity } from "./services/getWeatherByCity";
 *
 *   const resultado = await getWeatherByCity("Madrid, Spain");
 *   console.log(resultado);
 *   // {
 *   //   ciudad: "Madrid",
 *   //   pais: "Spain",
 *   //   temperatura: 22.5,
 *   //   descripcion: "Despejado"
 *   // }
 */

// ─── Constantes ──────────────────────────────────────────────────────────────

/** URL base de la API de geocodificación (texto → coordenadas) */
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

/** URL base de la API del clima (coordenadas → temperatura y código de clima) */
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Tiempo máximo de espera para cada petición (en milisegundos) */
const TIMEOUT_MS = 8000;

// ─── Tabla de descripciones del clima ────────────────────────────────────────

/**
 * Open-Meteo usa códigos WMO (estándar internacional) para describir el clima.
 * Esta tabla lo convierte a texto legible en español.
 * Fuente: https://open-meteo.com/en/docs
 */
const DESCRIPCION_CLIMA = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Neblina con escarcha",
  51: "Llovizna leve",
  53: "Llovizna moderada",
  55: "Llovizna intensa",
  61: "Lluvia leve",
  63: "Lluvia moderada",
  65: "Lluvia intensa",
  71: "Nevada leve",
  73: "Nevada moderada",
  75: "Nevada intensa",
  80: "Chubascos leves",
  81: "Chubascos moderados",
  82: "Chubascos intensos",
  95: "Tormenta eléctrica",
  96: "Tormenta con granizo leve",
  99: "Tormenta con granizo intenso",
};

// ─── Funciones auxiliares ─────────────────────────────────────────────────────

/**
 * Lanza un error si la petición HTTP tarda demasiado.
 * Útil para no dejar al usuario esperando infinitamente.
 *
 * @param {string} url - Dirección a consultar.
 * @param {number} ms  - Milisegundos máximos de espera.
 * @returns {Promise<Response>}
 */
async function fetchConTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const respuesta = await fetch(url, { signal: controller.signal });
    return respuesta;
  } catch (error) {
    // Si el timeout se disparó, el error tiene el nombre "AbortError"
    if (error.name === "AbortError") {
      throw new Error("La petición tardó demasiado. Verifica tu conexión a internet.");
    }
    // Cualquier otro error de red
    throw new Error("No se pudo contactar al servidor. Verifica tu conexión a internet.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Paso 1: Busca las coordenadas de una ciudad por su nombre.
 *
 * @param {string} nombreCiudad - Texto que escribió el usuario, p.ej. "Madrid, Spain".
 * @returns {Promise<{nombre: string, pais: string, latitud: number, longitud: number}>}
 */
async function obtenerCoordenadas(nombreCiudad) {
  // Validar que el nombre no esté vacío ni sea demasiado largo
  const texto = nombreCiudad.trim();
  if (!texto) {
    throw new Error("El nombre de la ciudad no puede estar vacío.");
  }
  if (texto.length > 100) {
    throw new Error("El nombre de la ciudad es demasiado largo (máximo 100 caracteres).");
  }
  // Solo permitir letras, números, espacios, comas y guiones
  if (!/^[a-zA-Z0-9\s,\-áéíóúüñÁÉÍÓÚÜÑ]+$/.test(texto)) {
    throw new Error("El nombre contiene caracteres no válidos.");
  }

  // Construir la URL con encodeURIComponent para evitar inyecciones en la URL
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(texto)}&count=1&language=es&format=json`;

  const respuesta = await fetchConTimeout(url, TIMEOUT_MS);

  // Si el servidor devolvió un error HTTP (4xx, 5xx)
  if (!respuesta.ok) {
    throw new Error(`Error del servidor al buscar la ciudad (código ${respuesta.status}).`);
  }

  const datos = await respuesta.json();

  // Si la API no devolvió ciudades
  if (!datos.results || datos.results.length === 0) {
    throw new Error(`No se encontró ninguna ciudad con ese nombre: "${texto}".`);
  }

  const lugar = datos.results[0];

  // Validar que los datos tengan el formato esperado
  if (
    typeof lugar.latitude !== "number" ||
    typeof lugar.longitude !== "number" ||
    lugar.latitude < -90 || lugar.latitude > 90 ||
    lugar.longitude < -180 || lugar.longitude > 180
  ) {
    throw new Error("Los datos de ubicación recibidos no son válidos.");
  }

  return {
    nombre: lugar.name,
    pais: lugar.country || "",
    latitud: lugar.latitude,
    longitud: lugar.longitude,
  };
}

/**
 * Paso 2: Obtiene temperatura y código del clima con latitud y longitud.
 *
 * @param {number} latitud
 * @param {number} longitud
 * @returns {Promise<{temperatura: number, codigoClima: number}>}
 */
async function obtenerClima(latitud, longitud) {
  // Construir parámetros de la URL de forma segura con URLSearchParams
  const parametros = new URLSearchParams({
    latitude: String(latitud),
    longitude: String(longitud),
    current: "temperature_2m,weathercode",
    timezone: "auto",
  });

  const url = `${FORECAST_URL}?${parametros.toString()}`;
  const respuesta = await fetchConTimeout(url, TIMEOUT_MS);

  if (!respuesta.ok) {
    throw new Error(`Error del servidor al obtener el clima (código ${respuesta.status}).`);
  }

  const datos = await respuesta.json();
  const temperatura = datos.current?.temperature_2m;
  const codigoClima = datos.current?.weathercode;

  // Validar que la temperatura sea un número real dentro de rango esperado
  if (typeof temperatura !== "number" || isNaN(temperatura) || temperatura < -100 || temperatura > 60) {
    throw new Error("La temperatura recibida no es válida.");
  }

  return {
    temperatura,
    codigoClima: typeof codigoClima === "number" ? codigoClima : null,
  };
}

// ─── Función principal exportada ──────────────────────────────────────────────

/**
 * Consulta el clima actual de una ciudad.
 *
 * @param {string} nombreCiudad - Nombre de la ciudad a buscar.
 * @returns {Promise<{ciudad: string, pais: string, temperatura: number, descripcion: string}>}
 *
 * @throws {Error} Si el nombre es inválido, la ciudad no existe, o hay fallo de red/API.
 *
 * @example
 * const clima = await getWeatherByCity("Bogota, Colombia");
 * console.log(clima);
 * // { ciudad: "Bogotá", pais: "Colombia", temperatura: 14.2, descripcion: "Parcialmente nublado" }
 */
export async function getWeatherByCity(nombreCiudad) {
  // Paso 1: buscar coordenadas
  const lugar = await obtenerCoordenadas(nombreCiudad);

  // Paso 2: obtener clima con esas coordenadas
  const { temperatura, codigoClima } = await obtenerClima(lugar.latitud, lugar.longitud);

  // Paso 3: convertir código de clima en texto legible
  const descripcion = DESCRIPCION_CLIMA[codigoClima] ?? "Información no disponible";

  // Paso 4: devolver el resultado final
  return {
    ciudad: lugar.nombre,
    pais: lugar.pais,
    temperatura,
    descripcion,
  };
}
