import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

/**
 * Suite principal de pruebas de integración de UI.
 *
 * Enfoque:
 * - Simular el flujo real de usuario (input + click).
 * - Mockear fetch para aislar la UI de Open-Meteo.
 * - Verificar render de estados, errores y resultado final.
 */
// Mock del fetch global
global.fetch = jest.fn();

describe("Weather App - Pruebas Funcionales", () => {
  beforeEach(() => {
    fetch.mockClear();
    window.localStorage.clear();
    delete globalThis.__WEATHER_APP_ENV__;
  });

  function createGeocodingResponse(results) {
    // Helper para mantener legibles los casos de geocoding.
    return {
      ok: true,
      json: async () => ({ results }),
    };
  }

  function createForecastResponse({ temperature = 22.5, weathercode = 2, humidity = 68, windSpeed = 12.4 } = {}) {
    // Helper para centralizar el formato de la respuesta de forecast.
    return {
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: temperature,
          weathercode,
          relative_humidity_2m: humidity,
          wind_speed_10m: windSpeed,
        },
      }),
    };
  }

  // ============ HAPPY PATH ============

  test("debe mostrar clima para una ciudad válida (Madrid)", async () => {
    // Arrange
    const mockGeocodingResponse = createGeocodingResponse([
      {
        name: "Madrid",
        country: "Spain",
        admin1: "Madrid",
        latitude: 40.4,
        longitude: -3.68,
        id: 2884,
      },
    ]);

    const mockForecastResponse = createForecastResponse({
      temperature: 22.5,
      weathercode: 2,
      humidity: 51,
      windSpeed: 9.7,
    });

    fetch
      .mockResolvedValueOnce(mockGeocodingResponse)
      .mockResolvedValueOnce(mockForecastResponse);

    // Act
    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "Madrid");
    await userEvent.click(button);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Madrid/i)).toBeInTheDocument();
      expect(screen.getByText(/22.5 °C/)).toBeInTheDocument();
      expect(screen.getByText(/Viento: 9.7 km\/h/i)).toBeInTheDocument();
      expect(screen.getByText(/Humedad: 51%/i)).toBeInTheDocument();
      expect(screen.getByText(/Parcialmente nublado/i)).toBeInTheDocument();
    });
  });

  test("debe pedir consentimiento antes de recordar una ciudad", () => {
    render(<App />);

    expect(screen.getByLabelText(/Preferencias de privacidad/i)).toBeInTheDocument();
    expect(screen.getByText(/No guardamos coordenadas ni resultados del clima/i)).toBeInTheDocument();
  });

  test("debe recordar la ultima ciudad solo cuando el usuario acepta", async () => {
    const mockGeocodingResponse = createGeocodingResponse([
      {
        name: "Madrid",
        country: "Spain",
        admin1: "Madrid",
        latitude: 40.4,
        longitude: -3.68,
        id: 2884,
      },
    ]);

    const mockForecastResponse = createForecastResponse({
      temperature: 22.5,
      weathercode: 2,
      humidity: 51,
      windSpeed: 9.7,
    });

    fetch
      .mockResolvedValueOnce(mockGeocodingResponse)
      .mockResolvedValueOnce(mockForecastResponse);

    const { unmount } = render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));

    const input = screen.getByPlaceholderText("Ciudad y país");
    await userEvent.clear(input);
    await userEvent.type(input, "Madrid");
    await userEvent.click(screen.getByText("Consultar"));

    await waitFor(() => {
      expect(screen.getByText(/22.5 °C/)).toBeInTheDocument();
    });

    expect(window.localStorage.getItem("weather-app:storage-consent")).toBe("granted");
    expect(window.localStorage.getItem("weather-app:last-city")).toBe("Madrid, Spain");

    unmount();
    render(<App />);

    expect(screen.getByDisplayValue("Madrid, Spain")).toBeInTheDocument();
  });

  test("debe mostrar sugerencias cuando hay múltiples ciudades (Springfield)", async () => {
    const mockGeocodingResponse = createGeocodingResponse([
      {
        name: "Springfield",
        country: "United States",
        admin1: "Illinois",
        latitude: 39.76,
        longitude: -89.65,
        id: 4250542,
      },
      {
        name: "Springfield",
        country: "United States",
        admin1: "Massachusetts",
        latitude: 42.1,
        longitude: -72.57,
        id: 4944167,
      },
    ]);

    const mockForecastResponse = createForecastResponse({
      temperature: 18.0,
      weathercode: 3,
    });

    fetch
      .mockResolvedValueOnce(mockGeocodingResponse)
      .mockResolvedValueOnce(mockForecastResponse);

    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "Springfield");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Quisiste decir/i)).toBeInTheDocument();
      expect(screen.getByText(/Springfield, Illinois, United States/i)).toBeInTheDocument();
    });
  });

  // ============ ERRORES DE ENTRADA ============

  test("debe mostrar error si el campo está vacío", async () => {
    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.click(button);

    expect(screen.getByText(/Ingresa una ciudad/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("debe mostrar error si el texto supera 100 caracteres", async () => {
    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const longText = "a".repeat(101);

    await userEvent.clear(input);
    await userEvent.type(input, longText);

    // El input no deberia aceptar mas de 100 caracteres.
    expect(input.value.length).toBeLessThanOrEqual(100);
  });

  // ============ ERRORES DE API GEOCODING ============

  test("debe mostrar error 'Ciudad no encontrada' si no hay resultados", async () => {
    const mockGeocodingResponse = createGeocodingResponse([]);

    fetch.mockResolvedValueOnce(mockGeocodingResponse);

    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "XyzNoExistCity123");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Ciudad no encontrada/i)).toBeInTheDocument();
    });
  });

  test("debe mostrar error si el servidor Geocoding falla (HTTP 500)", async () => {
    const mockFailResponse = {
      ok: false,
      status: 500,
    };

    fetch.mockResolvedValueOnce(mockFailResponse);

    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "Madrid");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/No se pudo consultar la ciudad/i)).toBeInTheDocument();
    });
  });

  // ============ ERRORES DE API FORECAST ============

  test("debe mostrar error si el servidor Forecast falla", async () => {
    const mockGeocodingResponse = createGeocodingResponse([
      {
        name: "Madrid",
        country: "Spain",
        latitude: 40.4,
        longitude: -3.68,
      },
    ]);

    const mockFailResponse = {
      ok: false,
      status: 500,
    };

    fetch
      .mockResolvedValueOnce(mockGeocodingResponse)
      .mockResolvedValueOnce(mockFailResponse);

    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "Madrid");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/No se pudo consultar el clima actual/i)).toBeInTheDocument();
    });
  });

  test("debe mostrar error si Forecast devuelve datos inválidos", async () => {
    const mockGeocodingResponse = createGeocodingResponse([
      {
        name: "Madrid",
        country: "Spain",
        latitude: 40.4,
        longitude: -3.68,
      },
    ]);

    const mockBadForecastResponse = {
      ok: true,
      json: async () => ({
        current: null,
      }),
    };

    fetch
      .mockResolvedValueOnce(mockGeocodingResponse)
      .mockResolvedValueOnce(mockBadForecastResponse);

    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "Madrid");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/API devolvio datos del clima invalidos/i)).toBeInTheDocument();
    });
  });

  // ============ ERRORES DE RED ============

  test("debe mostrar error si hay problema de red (TypeError)", async () => {
    fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "Madrid");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Problema de red/i)).toBeInTheDocument();
    });
  });

  test("debe mostrar comillas normales en errores sin renderizar entidades HTML", async () => {
    fetch.mockRejectedValueOnce(new Error('No se encontro ninguna ciudad con ese nombre: "tlakepaque".'));

    render(<App />);

    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "tlakepaque");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/"tlakepaque"/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/&quot;/i)).not.toBeInTheDocument();
  });

  // ============ ESTADOS DE LOADING ============

  test("debe mostrar 'Consultando...' mientras se cargan los datos", async () => {
    const mockGeocodingResponse = createGeocodingResponse([
      {
        name: "Madrid",
        country: "Spain",
        latitude: 40.4,
        longitude: -3.68,
      },
    ]);

    const mockForecastResponse = createForecastResponse({
      temperature: 22.5,
      weathercode: 2,
    });

    fetch
      .mockResolvedValueOnce(mockGeocodingResponse)
      .mockResolvedValueOnce(mockForecastResponse);

    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "Madrid");
    await userEvent.click(button);

    // Verifica el cambio de estado visible para el usuario.
    expect(screen.getByText("Consultando...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Consultar")).toBeInTheDocument();
    });
  });

  // ============ ICONOS DEL CLIMA ============

  test("debe mostrar ícono correcto para clima despejado", async () => {
    const mockGeocodingResponse = createGeocodingResponse([
      {
        name: "Athens",
        country: "Greece",
        latitude: 37.97,
        longitude: 23.73,
      },
    ]);

    const mockForecastResponse = createForecastResponse({
      temperature: 28.0,
      weathercode: 0,
    });

    fetch
      .mockResolvedValueOnce(mockGeocodingResponse)
      .mockResolvedValueOnce(mockForecastResponse);

    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "Athens");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("☀️")).toBeInTheDocument();
    });
  });

  test("debe mostrar ícono correcto para clima lluvioso", async () => {
    const mockGeocodingResponse = createGeocodingResponse([
      {
        name: "Seattle",
        country: "United States",
        latitude: 47.6,
        longitude: -122.33,
      },
    ]);

    const mockForecastResponse = createForecastResponse({
      temperature: 15.0,
      weathercode: 63,
    });

    fetch
      .mockResolvedValueOnce(mockGeocodingResponse)
      .mockResolvedValueOnce(mockForecastResponse);

    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "Seattle");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("🌧️")).toBeInTheDocument();
    });
  });

  // ============ SUGERENCIAS CLICKEABLES ============

  test("debe buscar automáticamente al hacer clic en una sugerencia", async () => {
    const mockGeocodingResponse = createGeocodingResponse([
      {
        name: "Springfield",
        country: "United States",
        admin1: "Illinois",
        latitude: 39.76,
        longitude: -89.65,
      },
      {
        name: "Springfield",
        country: "United States",
        admin1: "Massachusetts",
        latitude: 42.1,
        longitude: -72.57,
      },
    ]);

    const mockForecastResponse = createForecastResponse({
      temperature: 18.0,
      weathercode: 3,
    });

    fetch
      .mockResolvedValueOnce(mockGeocodingResponse)
      .mockResolvedValueOnce(mockForecastResponse)
      .mockResolvedValueOnce(mockGeocodingResponse)
      .mockResolvedValueOnce(mockForecastResponse);

    render(<App />);
    
    const input = screen.getByPlaceholderText("Ciudad y país");
    const button = screen.getByText("Consultar");

    await userEvent.clear(input);
    await userEvent.type(input, "Springfield");
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Massachusetts, United States/i)).toBeInTheDocument();
    });

    // Re-dispara el flujo usando la sugerencia elegida.
    const suggestionButton = screen.getByText(/Massachusetts, United States/i);
    await userEvent.click(suggestionButton);

    await waitFor(() => {
      expect(screen.getByText("Nublado")).toBeInTheDocument();
    });
  });
});
