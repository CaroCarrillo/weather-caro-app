const cityQuery = process.argv.slice(2).join(" ").trim();

if (!cityQuery) {
  console.error("Uso: npm run weather:cli -- \"Nombre de ciudad\"");
  process.exit(1);
}

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

async function geocodeCity(query) {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=1&language=es&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("No se pudo buscar la ciudad.");
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`No se encontraron resultados para: ${query}`);
  }

  return data.results[0];
}

async function getTemperature(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m",
    timezone: "auto",
  });

  const response = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("No se pudo obtener la temperatura.");
  }

  const data = await response.json();
  return data.current.temperature_2m;
}

async function main() {
  try {
    const place = await geocodeCity(cityQuery);
    const temperature = await getTemperature(place.latitude, place.longitude);

    console.log(`Ciudad: ${place.name}, ${place.country}`);
    console.log(`Temperatura actual: ${temperature} °C`);
  } catch (error) {
    console.error("Error:", error.message || error);
    process.exit(1);
  }
}

main();
