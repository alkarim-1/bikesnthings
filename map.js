
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Import D3
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiYWxrYXJpbSIsImEiOiJjbXdrY2NpMDQwNWZ4Mnlva3YyMnh3czh5In0.MLNim6vXuctQaTZNXjyBKQ';

// Initialize the map
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

// Wait for map to load
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
  // STEP 3: BLUEBIKES STATIONS
  // =====================================

  try {
    // Fetch station information
    const jsonurl =
      'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';

    const jsonData = await d3.json(jsonurl);

    console.log('Loaded JSON Data:', jsonData);

    // Extract station array
    const stations = jsonData.data.stations;

    console.log('Stations Array:', stations);

    // Create SVG circles for each station
    const circles = svg
      .selectAll('circle')
      .data(stations)
      .enter()
      .append('circle')
      .attr('r', 5)
      .attr('fill', 'steelblue')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8);

    // Update circle positions
    function updatePositions() {
      circles
        .attr('cx', (d) => getCoords(d).cx)
        .attr('cy', (d) => getCoords(d).cy);
    }

    // Initial position update
    updatePositions();

    // Update markers when map moves
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);

  } catch (error) {
    console.error('Error loading Bluebikes stations:', error);
  }

});
