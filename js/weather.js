const status = (message, className = "weather-message") => {
  const target = document.getElementById("weather-content");
  if (!target) return;
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = message;
  target.replaceChildren(paragraph);
};

const weatherDescriptions = {
  0: ["Clear sky", "☀"], 1: ["Mostly clear", "🌤"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁"],
  45: ["Foggy", "≋"], 48: ["Rime fog", "≋"], 51: ["Light drizzle", "☂"], 53: ["Drizzle", "☂"], 55: ["Heavy drizzle", "☂"],
  61: ["Light rain", "☂"], 63: ["Rain", "☂"], 65: ["Heavy rain", "☂"], 71: ["Light snow", "❄"], 73: ["Snow", "❄"], 75: ["Heavy snow", "❄"],
  80: ["Rain showers", "☂"], 81: ["Showers", "☂"], 82: ["Heavy showers", "☂"], 95: ["Thunderstorm", "ϟ"], 96: ["Thunderstorm", "ϟ"], 99: ["Thunderstorm", "ϟ"]
};

export async function fetchWeather(location) {
  const query = location.trim().slice(0, 80);
  if (!query) { status("Enter a city to search."); return; }
  status("Finding location…");
  try {
    const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
    if (!geoResponse.ok) throw new Error(`Location search failed (HTTP ${geoResponse.status}).`);
    const geo = await geoResponse.json();
    const place = geo.results?.[0];
    if (!place) { status(`No matching location found for “${query}”.`); return; }
    status("Loading current conditions…");
    const params = new URLSearchParams({ latitude: place.latitude, longitude: place.longitude, current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m", timezone: "auto" });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error(`Weather request failed (HTTP ${response.status}).`);
    const data = await response.json();
    const current = data.current;
    if (!current) throw new Error("The weather service returned no current conditions.");
    const [description, icon] = weatherDescriptions[current.weather_code] || ["Conditions unavailable", "◌"];
    const target = document.getElementById("weather-content");
    if (!target) return;
    const wrapper = document.createElement("div"); wrapper.className = "weather-data";
    const symbol = document.createElement("span"); symbol.className = "weather-symbol"; symbol.textContent = icon;
    const primary = document.createElement("div");
    const temperature = document.createElement("div"); temperature.className = "weather-temp"; temperature.textContent = `${Math.round(current.temperature_2m)}°`;
    const label = document.createElement("div"); label.className = "weather-location"; label.textContent = `${place.name}${place.country ? `, ${place.country}` : ""} · ${description}`;
    primary.append(temperature, label);
    const meta = document.createElement("div"); meta.className = "weather-meta";
    const feels = document.createElement("span"); feels.textContent = `FEELS ${Math.round(current.apparent_temperature)}°`;
    const wind = document.createElement("span"); wind.textContent = `WIND ${Math.round(current.wind_speed_10m)} KM/H`;
    const humidity = document.createElement("span"); humidity.textContent = `HUMIDITY ${current.relative_humidity_2m}%`;
    meta.append(feels, wind, humidity); wrapper.append(symbol, primary, meta); target.replaceChildren(wrapper);
  } catch (error) {
    status(`${error.message} Check your connection and try again.`, "weather-message");
  }
}
