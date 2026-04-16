import { getWeather } from "./weatherApi";

/**
 * Compatibilidad retroactiva para código legado.
 * Usa el nuevo servicio centralizado y mantiene el contrato antiguo.
 */
export async function getWeatherByCity(nombreCiudad) {
  const { result } = await getWeather(nombreCiudad);

  return {
    ciudad: result.city,
    pais: result.country,
    temperatura: result.temperature,
    descripcion: result.description,
  };
}
