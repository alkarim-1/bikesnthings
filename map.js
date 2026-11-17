
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// =====================================
// STEP 1: INITIALIZE MAP
// =====================================

// Replace with your existing Mapbox public token
mapboxgl.accessToken = 'pk.eyJ1IjoiYWxrYXJpbSIsImEiOiJjbXdrY2NpMDQwNWZ4Mnlva3YyMnh3czh5In0.MLNim6vXuctQaTZNXjyBKQ';

// Initialize the Mapbox map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// Select the SVG overlay inside the map
const svg = d3.select('#map').select('svg');

// =====================================
// STEP 6: TRAFFIC FLOW COLOR SCALE
// =====================================

// Quantize departure ratios into 3 categories
const stationFlow = d3
  .scaleQuantize()
  .domain([0, 1])
  .range([0, 0.5, 1]);

// Determine departure ratio for each station
function getDepartureRatio(station) {
  if (station.totalTraffic === 0) {
    return 0.5;
  }

  return stationFlow(
    station.departures / station.totalTraffic
  );
}

// =====================================
// STEP 3: PROJECT STATION COORDINATES
// =====================================

// Convert longitude and latitude to pixel positions
function getCoords(station) {
  const point = new mapboxgl.LngLat(
    +station.lon,
    +station.lat
  );

  const { x, y } = map.project(point);

  return {
    cx: x,
    cy: y
  };
}

// =====================================
// STEP 5: TIME HELPERS
// =====================================

// Format minutes since midnight as readable time
function formatTime(minutes) {
  const date = new Date(2024, 2, 1, 0, minutes);

  return date.toLocaleString('en-US', {
    timeStyle: 'short'
  });
}

// Convert a Date object to minutes since midnight
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// =====================================
// STEP 4 & 5: COMPUTE STATION TRAFFIC
// =====================================

// Calculate arrivals, departures, and total traffic
function computeStationTraffic(stations, trips) {

  // Count departures
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  // Count arrivals
  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Add traffic properties to every station
  return stations.map((station) => {
    const id = station.short_name;

    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;

    station.totalTraffic =
      station.arrivals + station.departures;

    return station;
  });
}

// =====================================
// STEP 5: FILTER TRIPS BY TIME
// =====================================

// Return trips within 60 minutes of selected time
function filterTripsByTime(trips, timeFilter) {

  // -1 means no filtering
  if (timeFilter === -1) {
    return trips;
  }

  return trips.filter((trip) => {

    const startedMinutes =
      minutesSinceMidnight(trip.started_at);

    const endedMinutes =
      minutesSinceMidnight(trip.ended_at);

    // Handle time differences across midnight
    function withinOneHour(minutes) {
      const difference = Math.abs(
        minutes - timeFilter
      );

      return Math.min(
        difference,
        1440 - difference
      ) <= 60;
    }

    return (
      withinOneHour(startedMinutes) ||
      withinOneHour(endedMinutes)
    );
  });
}

// =====================================
// WAIT FOR MAP TO LOAD
// =====================================

map.on('load', async () => {

  // =====================================
  // STEP 2: BOSTON BIKE LANES
  // =====================================

  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });

  // =====================================
  // STEP 2: CAMBRIDGE BIKE LANES
  // =====================================

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://data.cambridgema.gov/resource/9aey-9g9p.geojson',
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });

  // =====================================
  // STEP 3 & 4: LOAD BLUEBIKES DATA
  // =====================================

  try {

    // Load station information
    const jsonData = await d3.json(
      'https://dsc106.com/labs/lab07/data/bluebikes-stations.json'
    );

    // Load traffic CSV and parse timestamps
    const trips = await d3.csv(
      'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
      (trip) => {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);

        return trip;
      }
    );

    console.log('Loaded Trips:', trips);
    console.log('Total Trip Records:', trips.length);

    // Calculate traffic for all stations
    const stations = computeStationTraffic(
      jsonData.data.stations,
      trips
    );

    console.log('Stations with Traffic:', stations);

    // =====================================
    // STEP 4: CIRCLE RADIUS SCALE
    // =====================================

    // Square-root scale maps traffic to circle radius
    const radiusScale = d3
      .scaleSqrt()
      .domain([
        0,
        d3.max(stations, (d) => d.totalTraffic) || 1
      ])
      .range([0, 25]);

    // =====================================
    // STEP 3, 4 & 6: CREATE STATION CIRCLES
    // =====================================

    const circles = svg
      .selectAll('circle')
      .data(stations, (d) => d.short_name)
      .enter()
      .append('circle')

      // Circle size based on traffic
      .attr('r', (d) => radiusScale(d.totalTraffic))

      // Circle appearance
      .attr('fill-opacity', 0.6)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)

      // Circle color based on traffic direction
      .style('--departure-ratio', (d) =>
        getDepartureRatio(d)
      )

      // Tooltips
      .each(function (d) {
        d3.select(this)
          .append('title')
          .text(
            `${d.name}
${d.totalTraffic} trips
(${d.departures} departures, ${d.arrivals} arrivals)`
          );
      });

    // =====================================
    // STEP 3: UPDATE STATION POSITIONS
    // =====================================

    function updatePositions() {
      circles
        .attr('cx', (d) => getCoords(d).cx)
        .attr('cy', (d) => getCoords(d).cy);
    }

    // Position markers when first created
    updatePositions();

    // Keep station markers aligned with map
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);

    // =====================================
    // STEP 5: SELECT TIME SLIDER ELEMENTS
    // =====================================

    const timeSlider =
      document.getElementById('time-slider');

    const selectedTime =
      document.getElementById('selected-time');

    const anyTimeLabel =
      document.getElementById('any-time');

    // =====================================
    // STEP 5 & 6: UPDATE MAP VISUALIZATION
    // =====================================

    function updateScatterPlot(timeFilter) {

      // Get trips matching the selected time
      const filteredTrips = filterTripsByTime(
        trips,
        timeFilter
      );

      // Recalculate station traffic
      const filteredStations = computeStationTraffic(
        stations,
        filteredTrips
      );

      // Adjust scale based on filter state
      if (timeFilter === -1) {
        radiusScale.range([0, 25]);
      } else {
        radiusScale.range([3, 50]);
      }

      // Update circles without recreating them
      circles
        .data(filteredStations, (d) => d.short_name)

        // Update circle sizes
        .attr('r', (d) =>
          d.totalTraffic === 0
            ? 0
            : radiusScale(d.totalTraffic)
        )

        // Update circle colors
        .style('--departure-ratio', (d) =>
          getDepartureRatio(d)
        )

        // Update tooltip values
        .select('title')
        .text(
          (d) =>
            `${d.name}
${d.totalTraffic} trips
(${d.departures} departures, ${d.arrivals} arrivals)`
        );
    }

    // =====================================
    // STEP 5: UPDATE TIME DISPLAY
    // =====================================

    function updateTimeDisplay() {

      const timeFilter = Number(timeSlider.value);

      if (timeFilter === -1) {

        // No time filtering
        selectedTime.textContent = '';
        anyTimeLabel.style.display = 'block';

      } else {

        // Display selected time
        selectedTime.textContent =
          formatTime(timeFilter);

        anyTimeLabel.style.display = 'none';
      }

      // Update circle sizes, colors, and tooltips
      updateScatterPlot(timeFilter);
    }

    // Listen for slider changes
    timeSlider.addEventListener(
      'input',
      updateTimeDisplay
    );

    // Initialize the slider and visualization
    updateTimeDisplay();

  } catch (error) {
    console.error(
      'Error loading Bluebikes data:',
      error
    );
  }

});
