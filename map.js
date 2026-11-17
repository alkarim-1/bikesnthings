
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// =====================================
// STEP 1: INITIALIZE MAP
// =====================================

mapboxgl.accessToken = 'pk.eyJ1IjoiYWxrYXJpbSIsImEiOiJjbXdrY2NpMDQwNWZ4Mnlva3YyMnh3czh5In0.MLNim6vXuctQaTZNXjyBKQ';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

const svg = d3.select('#map').select('svg');

// =====================================
// STEP 3: PROJECT STATION COORDINATES
// =====================================

function getCoords(station) {
  const point = new mapboxgl.LngLat(
    +station.lon,
    +station.lat
  );

  const { x, y } = map.project(point);

  return { cx: x, cy: y };
}

// =====================================
// STEP 5.2: FORMAT THE SELECTED TIME
// =====================================

function formatTime(minutes) {
  const date = new Date(2024, 2, 1, 0, minutes);

  return date.toLocaleString('en-US', {
    timeStyle: 'short'
  });
}

// =====================================
// STEP 5.3: COMPUTE STATION TRAFFIC
// =====================================

function computeStationTraffic(stations, trips) {

  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  return stations.map((station) => {
    const id = station.short_name;

    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;

    station.totalTraffic =
      station.arrivals + station.departures;

    return station;
  });
}

// Convert trip timestamps to minutes since midnight
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Filter trips within one hour of selected time
function filterTripsByTime(trips, timeFilter) {

  if (timeFilter === -1) {
    return trips;
  }

  return trips.filter((trip) => {

    const startedMinutes =
      minutesSinceMidnight(trip.started_at);

    const endedMinutes =
      minutesSinceMidnight(trip.ended_at);

    // Account for times around midnight
    const withinOneHour = (minutes) => {
      const difference = Math.abs(
        minutes - timeFilter
      );

      return Math.min(
        difference,
        1440 - difference
      ) <= 60;
    };

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
  // LOAD BLUEBIKES DATA
  // =====================================

  try {

    const jsonData = await d3.json(
      'https://dsc106.com/labs/lab07/data/bluebikes-stations.json'
    );

    // Parse trip dates when loading the CSV
    const trips = await d3.csv(
      'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
      (trip) => {
        trip.started_at = new Date(trip.started_at);
        trip.ended_at = new Date(trip.ended_at);
        return trip;
      }
    );

    console.log('Loaded Trips:', trips);
    console.log('Total Trips:', trips.length);

    // Calculate initial traffic with no filtering
    const stations = computeStationTraffic(
      jsonData.data.stations,
      trips
    );

    console.log('Stations with Traffic:', stations);

    // =====================================
    // STEP 4: CIRCLE RADIUS SCALE
    // =====================================

    const radiusScale = d3
      .scaleSqrt()
      .domain([
        0,
        d3.max(stations, (d) => d.totalTraffic) || 1
      ])
      .range([0, 25]);

    // Create circles using station ID as key
    const circles = svg
      .selectAll('circle')
      .data(stations, (d) => d.short_name)
      .enter()
      .append('circle')
      .attr('r', (d) => radiusScale(d.totalTraffic))
      .attr('fill', 'steelblue')
      .attr('fill-opacity', 0.6)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
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
    // KEEP CIRCLES ALIGNED WITH MAP
    // =====================================

    function updatePositions() {
      circles
        .attr('cx', (d) => getCoords(d).cx)
        .attr('cy', (d) => getCoords(d).cy);
    }

    updatePositions();

    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);

    // =====================================
    // STEP 5.2: SELECT SLIDER ELEMENTS
    // =====================================

    const timeSlider =
      document.getElementById('time-slider');

    const selectedTime =
      document.getElementById('selected-time');

    const anyTimeLabel =
      document.getElementById('any-time');

    // =====================================
    // STEP 5.3: UPDATE CIRCLE SIZES
    // =====================================

    function updateScatterPlot(timeFilter) {

      // Filter trips by selected time
      const filteredTrips = filterTripsByTime(
        trips,
        timeFilter
      );

      // Recalculate traffic
      const filteredStations = computeStationTraffic(
        stations,
        filteredTrips
      );

      // Increase marker sizes while filtering
      if (timeFilter === -1) {
        radiusScale.range([0, 25]);
      } else {
        radiusScale.range([3, 50]);
      }

      // Update existing station circles
      circles
        .data(filteredStations, (d) => d.short_name)
        .attr('r', (d) => radiusScale(d.totalTraffic))
        .select('title')
        .text(
          (d) =>
            `${d.name}
${d.totalTraffic} trips
(${d.departures} departures, ${d.arrivals} arrivals)`
        );
    }

    // =====================================
    // STEP 5.2: UPDATE TIME DISPLAY
    // =====================================

    function updateTimeDisplay() {

      const timeFilter = Number(timeSlider.value);

      if (timeFilter === -1) {
        selectedTime.textContent = '';
        anyTimeLabel.style.display = 'block';
      } else {
        selectedTime.textContent =
          formatTime(timeFilter);

        anyTimeLabel.style.display = 'none';
      }

      updateScatterPlot(timeFilter);
    }

    // Update whenever slider moves
    timeSlider.addEventListener(
      'input',
      updateTimeDisplay
    );

    // Initialize slider state
    updateTimeDisplay();

  } catch (error) {
    console.error(
      'Error loading Bluebikes data:',
      error
    );
  }

});
