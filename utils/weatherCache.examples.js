/**
 * Ejemplos de uso de WeatherCache para applica clima.
 *
 * Muestra patrones reales en navegador, Node, React Native.
 */

import { WeatherCache, cacheOrFetch, globalWeatherCache } from "./weatherCache";

// ============ Ejemplo 1: Uso básico ============

const cache = new WeatherCache({ ttlMs: 60 * 60 * 1000 }); // 1 hora

// Guardar resultado de API
cache.set("Madrid", {
  city: "Madrid",
  country: "Spain",
  temperature: 22.5,
  humidity: 51,
  windSpeed: 9.7,
});

// Obtener del caché
const result = cache.get("Madrid");
console.log(result); // { city: "Madrid", country: "Spain", ... }

// Verificar si existe
console.log(cache.has("Madrid")); // true
console.log(cache.has("Barcelona")); // false

// ============ Ejemplo 2: Integración con función async ============

async function getWeatherWithCache(cityName) {
  return await cacheOrFetch(cityName, async () => {
    // Simular llamada a API
    const response = await fetch(`/api/weather/${cityName}`);
    return await response.json();
  });
}

// Primera llamada: consulta la API
// getWeatherWithCache("Paris"); // [Cache MISS]

// Segunda llamada (dentro de 1 hora): obtiene del caché
// getWeatherWithCache("Paris"); // [Cache HIT]

// ============ Ejemplo 3: Limpieza periódica ============

// Ejecutar cada 30 minutos para liberar memoria
const cleanupInterval = setInterval(() => {
  const removed = globalWeatherCache.cleanup();
  console.log(`Cleanup: se removieron ${removed} entradas expiradas`);
}, 30 * 60 * 1000);

// Para detener:
// clearInterval(cleanupInterval);

// ============ Ejemplo 4: Debugging del estado ============

globalWeatherCache.set("London", { temperature: 15 });
globalWeatherCache.set("Berlin", { temperature: 18 });

const stats = globalWeatherCache.getStats();
console.log(stats);
// {
//   size: 2,
//   entries: [
//     { key: "london", expired: false, remainingMs: 3599500 },
//     { key: "berlin", expired: false, remainingMs: 3599600 }
//   ]
// }

// ============ Ejemplo 5: Usarlo en un hook React ============

// import { useEffect, useState } from "react";
// import { cacheOrFetch } from "../utils/weatherCache";
//
// export function useWeatherWithCache(cityName) {
//   const [data, setData] = useState(null);
//   const [loading, setLoading] = useState(false);
//
//   useEffect(() => {
//     setLoading(true);
//     cacheOrFetch(cityName, async () => {
//       return await fetch(`/api/weather/${cityName}`).then(r => r.json());
//     })
//       .then(result => {
//         setData(result);
//         setLoading(false);
//       })
//       .catch(err => {
//         console.error(err);
//         setLoading(false);
//       });
//   }, [cityName]);
//
//   return { data, loading };
// }

export default {};
