import { WeatherCache, cacheOrFetch, globalWeatherCache } from "../utils/weatherCache";

describe("WeatherCache", () => {
  let cache;

  beforeEach(() => {
    // Crear cache con TTL muy corto para tests rapidos
    cache = new WeatherCache({ ttlMs: 100 });
    globalWeatherCache.clear();
  });

  // ============ SET / GET ============

  test("debe guardar y recuperar un valor", () => {
    cache.set("Madrid", { temperature: 22 });
    expect(cache.get("Madrid")).toEqual({ temperature: 22 });
  });

  test("debe normalizar claves (case-insensitive)", () => {
    cache.set("MADRID", { temperature: 22 });
    expect(cache.get("madrid")).toEqual({ temperature: 22 });
    expect(cache.get("MaDrId")).toEqual({ temperature: 22 });
  });

  test("debe devolver null para claves inexistentes", () => {
    expect(cache.get("NoExiste")).toBeNull();
  });

  // ============ EXPIRACION ============

  test("debe devolver null si la entrada expiro", async () => {
    cache.set("Barcelona", { temperature: 20 });
    expect(cache.get("Barcelona")).toEqual({ temperature: 20 });

    // Esperar a que expire (TTL = 100ms)
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(cache.get("Barcelona")).toBeNull();
  });

  test("debe remover automaticamente entradas expiradas al get", async () => {
    cache.set("Valencia", { temperature: 25 });
    await new Promise((resolve) => setTimeout(resolve, 150));

    cache.get("Valencia"); // Intenta acceder a expirado
    expect(cache.store.has("valencia")).toBe(false); // Fue removido
  });

  // ============ HAS / DELETE ============

  test("debe verificar existencia con has()", () => {
    cache.set("Paris", { temperature: 15 });
    expect(cache.has("Paris")).toBe(true);
    expect(cache.has("London")).toBe(false);
  });

  test("debe eliminar entradas con delete()", () => {
    cache.set("Berlin", { temperature: 18 });
    expect(cache.has("Berlin")).toBe(true);

    cache.delete("Berlin");
    expect(cache.has("Berlin")).toBe(false);
  });

  // ============ CLEANUP ============

  test("debe limpiar entradas expiradas", async () => {
    cache.set("Rome", { temperature: 24 });
    cache.set("Milan", { temperature: 23 });

    await new Promise((resolve) => setTimeout(resolve, 150));

    const removed = cache.cleanup();
    expect(removed).toBe(2);
    expect(cache.store.size).toBe(0);
  });

  test("cleanup debe ignorar entradas validas", async () => {
    cache.set("Athens", { temperature: 28 });

    // Esperar 50ms (menos que TTL de 100ms)
    await new Promise((resolve) => setTimeout(resolve, 50));

    const removed = cache.cleanup();
    expect(removed).toBe(0);
    expect(cache.has("Athens")).toBe(true);
  });

  // ============ CLEAR ============

  test("debe vaciar todo el cache con clear()", () => {
    cache.set("Tokyo", { temperature: 16 });
    cache.set("Seoul", { temperature: 12 });

    cache.clear();
    expect(cache.store.size).toBe(0);
  });

  // ============ STATS ============

  test("debe retornar estadisticas correctas", async () => {
    cache.set("Singapore", { temperature: 32 });
    cache.set("Bangkok", { temperature: 30 });

    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.entries).toHaveLength(2);
    expect(stats.entries[0].expired).toBe(false);
  });

  // ============ cacheOrFetch ============

  test("cacheOrFetch debe consultar fetcher si no hay cache", async () => {
    const mockFetcher = jest.fn(async () => ({ temperature: 25 }));

    const result = await cacheOrFetch("Dublin", mockFetcher);

    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ temperature: 25 });
  });

  test("cacheOrFetch debe retornar cache sin llamar fetcher", async () => {
    globalWeatherCache.set("Cork", { temperature: 14 });
    const mockFetcher = jest.fn();

    const result = await cacheOrFetch("Cork", mockFetcher);

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(result).toEqual({ temperature: 14 });
  });

  test("cacheOrFetch debe guardar resultado en cache", async () => {
    const mockFetcher = jest.fn(async () => ({ temperature: 19 }));

    await cacheOrFetch("Galway", mockFetcher);

    expect(globalWeatherCache.has("Galway")).toBe(true);
  });

  // ============ EDGE CASES ============

  test("debe manejar keys vacios", () => {
    cache.set("", { temperature: 20 });
    expect(cache.get("")).toEqual({ temperature: 20 });
  });

  test("debe manejar valores null/undefined", () => {
    cache.set("Test", null);
    expect(cache.get("Test")).toBeNull();

    cache.set("Test2", undefined);
    expect(cache.get("Test2")).toBeUndefined();
  });

  test("debe soportar objetos complejos", () => {
    const complexData = {
      city: "NewYork",
      forecast: [
        { day: 1, temp: 20 },
        { day: 2, temp: 22 },
      ],
    };

    cache.set("NewYork", complexData);
    expect(cache.get("NewYork")).toEqual(complexData);
  });
});
