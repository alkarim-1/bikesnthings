// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Verify Mapbox is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);

// Set your Mapbox access token
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