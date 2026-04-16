import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

globalThis.__WEATHER_APP_ENV__ = {
  geocodingUrl: import.meta.env.VITE_OPEN_METEO_GEOCODING_URL,
  forecastUrl: import.meta.env.VITE_OPEN_METEO_FORECAST_URL,
  requestTimeoutMs: import.meta.env.VITE_WEATHER_REQUEST_TIMEOUT_MS,
  weatherApiKey: import.meta.env.VITE_WEATHER_API_KEY,
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
