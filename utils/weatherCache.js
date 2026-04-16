/**
 * Sistema de caché multiplataforma para resultados meteorológicos.
 *
 * Características:
 * - TTL configurable (por defecto 1 hora).
 * - Funciona en navegador, Node.js y React Native.
 * - Auto-limpieza de entradas expiradas.
 * - Sin dependencias externas.
 *
 * Uso:
 * const cache = new WeatherCache({ ttlMs: 3600000 });
 * cache.set("Madrid", { temperature: 22 });
 * cache.get("Madrid"); // { temperature: 22 }
 */

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Almacena clima con expiración automática.
 * Multiplataforma: funciona en todos los runtimes.
 */
export class WeatherCache {
  constructor({ ttlMs = DEFAULT_TTL_MS } = {}) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  /**
   * Normaliza claves para búsquedas consistentes.
   * @param {string} key
   * @returns {string}
   */
  _normalizeKey(key) {
    return String(key || "").trim().toLowerCase();
  }

  /**
   * Inserta o reemplaza un valor con timestamp.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    const normalizedKey = this._normalizeKey(key);

    this.store.set(normalizedKey, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Obtiene un valor si existe y es válido.
   * @param {string} key
   * @returns {* | null}
   */
  get(key) {
    const normalizedKey = this._normalizeKey(key);
    const entry = this.store.get(normalizedKey);

    if (!entry) {
      return null;
    }

    // Validar que no haya expirado
    if (Date.now() > entry.expiresAt) {
      this.store.delete(normalizedKey);
      return null;
    }

    return entry.value;
  }

  /**
   * Verifica si una clave existe y es válida.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Elimina una entrada específica.
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    const normalizedKey = this._normalizeKey(key);
    return this.store.delete(normalizedKey);
  }

  /**
   * Limpia todas las entradas expiradas.
   * Llamar periodicamente para liberar memoria.
   * @returns {number} Cantidad de entradas removidas.
   */
  cleanup() {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed += 1;
      }
    }

    return removed;
  }

  /**
   * Vacía el caché completamente.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Retorna estado del caché para debugging.
   * @returns {{size: number, entries: Array}}
   */
  getStats() {
    const now = Date.now();
    const entries = Array.from(this.store.entries())
      .map(([key, entry]) => ({
        key,
        expired: now > entry.expiresAt,
        remainingMs: Math.max(0, entry.expiresAt - now),
      }));

    return {
      size: this.store.size,
      entries,
    };
  }
}

/**
 * Instancia global de caché para clima (1 hora).
 * Se reutiliza en toda la aplicación.
 */
export const globalWeatherCache = new WeatherCache({
  ttlMs: 60 * 60 * 1000, // 1 hora
});

/**
 * Helper funcional para integrar caché rápidamente.
 *
 * @param {string} key
 * @param {() => Promise<*>} fetcher
 * @returns {Promise<*>}
 *
 * @example
 * const data = await cacheOrFetch("Madrid", async () => {
 *   return await getWeather("Madrid");
 * });
 */
export async function cacheOrFetch(key, fetcher) {
  // Intentar traer del caché
  const cached = globalWeatherCache.get(key);
  if (cached !== null) {
    console.log(`[Cache HIT] ${key}`);
    return cached;
  }

  // No está en caché; fetcher
  console.log(`[Cache MISS] ${key}`);
  const data = await fetcher();

  // Guardar en caché
  globalWeatherCache.set(key, data);

  return data;
}

export default WeatherCache;
