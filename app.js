// Mock flight data source (no backend required)
const flights = [
  {
    id: "SY204",
    airline: "Skyline Air",
    route: "SFO → JFK",
    status: "enroute",
    lat: 39.5,
    lon: -103.4,
    altitude: 36000,
    speed: 510,
    heading: 78,
  },
  {
    id: "AT901",
    airline: "AtlasJet",
    route: "LAX → DFW",
    status: "ascending",
    lat: 34.4,
    lon: -111.6,
    altitude: 28000,
    speed: 460,
    heading: 95,
  },
  {
    id: "NW332",
    airline: "Northwind",
    route: "SEA → ORD",
    status: "enroute",
    lat: 42.3,
    lon: -118.2,
    altitude: 39000,
    speed: 520,
    heading: 102,
  },
  {
    id: "EK120",
    airline: "Eclipse",
    route: "MIA → BOS",
    status: "descending",
    lat: 33.1,
    lon: -77.8,
    altitude: 31000,
    speed: 480,
    heading: 42,
  },
  {
    id: "PN410",
    airline: "Polaris",
    route: "DEN → IAD",
    status: "ascending",
    lat: 37.7,
    lon: -98.4,
    altitude: 29500,
    speed: 470,
    heading: 70,
  },
  {
    id: "VR008",
    airline: "Voyager",
    route: "AUS → ATL",
    status: "enroute",
    lat: 33.5,
    lon: -92.2,
    altitude: 34500,
    speed: 500,
    heading: 88,
  },
];

const map = document.getElementById("map");
const telemetryList = document.getElementById("telemetryList");
const airlineFilter = document.getElementById("airlineFilter");
const flightSearch = document.getElementById("flightSearch");
const statusFilter = document.getElementById("statusFilter");
const altitudeFilter = document.getElementById("altitudeFilter");
const altitudeValue = document.getElementById("altitudeValue");
const activeFlights = document.getElementById("activeFlights");
const avgAltitude = document.getElementById("avgAltitude");
const toggleSim = document.getElementById("toggleSim");
const snapshotText = document.getElementById("snapshotText");

const featureCards = document.querySelectorAll(".feature-card");
const modules = document.querySelectorAll(".module");

const aircraftElements = new Map();
const flightState = flights.map((flight) => ({
  ...flight,
  targetHeading: flight.heading,
}));

const degToRad = Math.PI / 180;
let isPaused = false;

const statusLabels = {
  enroute: "En-route",
  ascending: "Ascending",
  descending: "Descending",
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const createMarker = (flight) => {
  const marker = document.createElement("button");
  marker.className = `aircraft ${flight.status}`;
  marker.type = "button";
  marker.setAttribute("aria-label", `${flight.id} ${flight.route}`);

  const icon = document.createElement("span");
  icon.className = "aircraft-icon";

  const tooltip = document.createElement("div");
  tooltip.className = "aircraft-tooltip";
  tooltip.innerHTML = `
    <strong>${flight.id}</strong><br />
    ${flight.route}<br />
    ${flight.airline}<br />
    ${statusLabels[flight.status]} · ${flight.altitude.toLocaleString()} ft
  `;

  marker.appendChild(icon);
  marker.appendChild(tooltip);
  map.appendChild(marker);

  aircraftElements.set(flight.id, { marker, tooltip });
};

const buildAirlineFilter = () => {
  const airlines = [...new Set(flights.map((flight) => flight.airline))];
  airlines.forEach((airline) => {
    const option = document.createElement("option");
    option.value = airline;
    option.textContent = airline;
    airlineFilter.appendChild(option);
  });
};

const applyFilters = () => {
  const selectedAirline = airlineFilter.value;
  const searchTerm = flightSearch.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;
  const maxAltitude = Number(altitudeFilter.value);

  const filteredFlights = flightState.filter((flight) => {
    const matchesAirline = selectedAirline === "all" || flight.airline === selectedAirline;
    const matchesSearch = !searchTerm || flight.id.toLowerCase().includes(searchTerm);
    const matchesStatus = selectedStatus === "all" || flight.status === selectedStatus;
    const matchesAltitude = flight.altitude <= maxAltitude;

    return matchesAirline && matchesSearch && matchesStatus && matchesAltitude;
  });

  flightState.forEach((flight) => {
    const { marker } = aircraftElements.get(flight.id);
    marker.style.display = filteredFlights.includes(flight) ? "block" : "none";
  });

  updateTelemetry(filteredFlights);
  updateStats(filteredFlights);
};

const updateTelemetry = (flightsToShow) => {
  telemetryList.innerHTML = "";
  flightsToShow.forEach((flight) => {
    const item = document.createElement("div");
    item.className = "telemetry-item";
    item.innerHTML = `
      <strong>${flight.id} · ${flight.route}</strong>
      ${flight.airline}<br />
      <span class="badge ${flight.status}">${statusLabels[flight.status]}</span>
      ${flight.altitude.toLocaleString()} ft · ${flight.speed} kt · ${Math.round(flight.heading)}°
    `;
    telemetryList.appendChild(item);
  });
};

const updateStats = (flightsToShow) => {
  activeFlights.textContent = flightsToShow.length;
  const average = flightsToShow.length
    ? Math.round(
        flightsToShow.reduce((sum, flight) => sum + flight.altitude, 0) /
          flightsToShow.length
      )
    : 0;
  avgAltitude.textContent = flightsToShow.length
    ? `${average.toLocaleString()} ft`
    : "--";
  snapshotText.textContent = `${flightsToShow.length} aircraft currently in monitored airspace.`;
};

const updateAltitudeLabel = () => {
  altitudeValue.textContent = `${Number(altitudeFilter.value).toLocaleString()} ft`;
};

const updateMarkerPosition = (flight, width, height) => {
  const x = ((flight.lon + 180) / 360) * width;
  const y = ((90 - flight.lat) / 180) * height;
  const { marker, tooltip } = aircraftElements.get(flight.id);

  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.setProperty("--heading", `${flight.heading}deg`);
  tooltip.innerHTML = `
    <strong>${flight.id}</strong><br />
    ${flight.route}<br />
    ${flight.airline}<br />
    ${statusLabels[flight.status]} · ${flight.altitude.toLocaleString()} ft · ${flight.speed} kt
  `;
};

const driftFlight = (flight, deltaSeconds) => {
  const driftChance = Math.random();
  if (driftChance > 0.985) {
    flight.targetHeading = clamp(flight.heading + (Math.random() - 0.5) * 20, 0, 360);
  }

  const headingDiff = ((flight.targetHeading - flight.heading + 540) % 360) - 180;
  flight.heading = (flight.heading + headingDiff * 0.02 + 360) % 360;

  const speedPerSecond = flight.speed / 3600;
  const distance = speedPerSecond * deltaSeconds;
  const headingRad = flight.heading * degToRad;

  flight.lat += distance * Math.cos(headingRad) * 0.5;
  flight.lon += distance * Math.sin(headingRad) * 0.7;

  flight.lat = clamp(flight.lat, -70, 70);
  flight.lon = ((flight.lon + 180) % 360) - 180;

  const altitudeShift = (Math.random() - 0.5) * 60;
  flight.altitude = clamp(flight.altitude + altitudeShift, 24000, 43000);
};

const animate = () => {
  let lastTime = performance.now();

  const step = (time) => {
    const deltaSeconds = (time - lastTime) / 1000;
    lastTime = time;

    const { width, height } = map.getBoundingClientRect();
    flightState.forEach((flight) => {
      if (!isPaused) {
        driftFlight(flight, deltaSeconds);
      }
      updateMarkerPosition(flight, width, height);
    });

    requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
};

const initializeRadar = () => {
  flights.forEach((flight) => createMarker(flight));
  buildAirlineFilter();
  updateAltitudeLabel();
  applyFilters();
  animate();
};

featureCards.forEach((card) => {
  card.addEventListener("click", () => {
    featureCards.forEach((item) => item.classList.remove("is-active"));
    modules.forEach((module) => module.classList.remove("is-active"));

    const target = card.dataset.module;
    card.classList.add("is-active");
    document.getElementById(target).classList.add("is-active");
  });
});

[airlineFilter, flightSearch, statusFilter, altitudeFilter].forEach((input) => {
  input.addEventListener("input", () => {
    updateAltitudeLabel();
    applyFilters();
  });
});

toggleSim.addEventListener("click", () => {
  isPaused = !isPaused;
  toggleSim.textContent = isPaused ? "Resume Motion" : "Pause Motion";
});

window.addEventListener("resize", () => applyFilters());

initializeRadar();
