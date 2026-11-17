
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Replace with your existing public Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiYWxrYXJpbSIsImEiOiJjbXdrY2NpMDQwNWZ4Mnlva3YyMnh3czh5In0.MLNim6vXuctQaTZNXjyBKQ';

// =====================================
// STEP 1: INITIALIZE MAP
// =====================================

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// Select SVG overlay
const svg = d3.select('#map').select('svg');

// Convert station coordinates to map pixels
function getCoords(station) {
  const point = new mapboxgl.LngLat(
    +station.lon,
    +station.lat
  );

  const { x, y } = map.project(point);

  return { cx: x, cy: y };
}

// Wait until map is loaded
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
  // STEP 3 & 4: BLUEBIKES TRAFFIC
  // =====================================

  try {
    // Load station JSON
    const jsonurl =
      'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';

    const jsonData = await d3.json(jsonurl);

    let stations = jsonData.data.stations;

    console.log('Loaded JSON Data:', jsonData);
    console.log('Stations Array:', stations);

    // =====================================
    // STEP 4.1: LOAD TRAFFIC CSV
    // =====================================

    const trips = await d3.csv(
      'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv'
    );

    console.log('Loaded Trips:', trips);
    console.log('Total trip records:', trips.length);

    // =====================================
    // STEP 4.2: CALCULATE TRAFFIC
    // =====================================

    // Count departures by station
    const departures = d3.rollup(
      trips,
      (v) => v.length,
      (d) => d.start_station_id
    );

    // Count arrivals by station
    const arrivals = d3.rollup(
      trips,
      (v) => v.length,
      (d) => d.end_station_id
    );

    // Add traffic properties to stations
    stations = stations.map((station) => {
      const id = station.short_name;

      station.arrivals = arrivals.get(id) ?? 0;
      station.departures = departures.get(id) ?? 0;
      station.totalTraffic =
        station.arrivals + station.departures;

      return station;
    });

    console.log('Stations with Traffic:', stations);

    // =====================================
    // STEP 4.3: CREATE RADIUS SCALE
    // =====================================

    const radiusScale = d3
      .scaleSqrt()
      .domain([
        0,
        d3.max(stations, (d) => d.totalTraffic) || 1
      ])
      .range([0, 25]);

    // Create SVG circles
    const circles = svg
      .selectAll('circle')
      .data(stations)
      .enter()
      .append('circle')
      .attr('r', (d) => radiusScale(d.totalTraffic))
      .attr('fill', 'steelblue')
      .attr('fill-opacity', 0.6)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .each(function (d) {

        // =====================================
        // STEP 4.4: ADD TOOLTIPS
        // =====================================

        d3.select(this)
          .append('title')
          .text(
            `${d.name}
${d.totalTraffic} trips
(${d.departures} departures, ${d.arrivals} arrivals)`
          );
      });

    // =====================================
    // UPDATE MARKER POSITIONS
    // =====================================

    function updatePositions() {
      circles
        .attr('cx', (d) => getCoords(d).cx)
        .attr('cy', (d) => getCoords(d).cy);
    }

    // Initial positioning
    updatePositions();

    // Keep circles aligned when moving map
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);

  } catch (error) {
    console.error('Error loading Bluebikes data:', error);
  }

});
