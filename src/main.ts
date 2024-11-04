// Example: Fetch from a CDN that provides Leaflet in ES module format
import 'https://unpkg.com/leaflet@1.9.3/dist/leaflet.js';

// Temporary manual declaration if needed
// Deno does not natively support the Node @types/* flow
declare var L: any; // This can act as a stop-gap to get around the type error


// Entry point
document.addEventListener('DOMContentLoaded', () => {
    // App container -----------------------------------------------------
    const appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);
  
    // Title --------------------------------------------------------------
    const title = document.createElement('h1');
    title.textContent = 'Geocoin Carrier';
    appContainer.appendChild(title);
  
    // Control Panel ------------------------------------------------------
    const controlPanel = document.createElement('div');
    controlPanel.id = 'control-panel';
    appContainer.appendChild(controlPanel);
  
    const toggleTrackingBtn = document.createElement('button');
    toggleTrackingBtn.id = 'toggle-tracking';
    toggleTrackingBtn.textContent = 'Toggle Tracking';
    toggleTrackingBtn.addEventListener('click', () => {
      console.log('Toggling real-time position tracking');
      // Implement toggle functionality here
    });
    controlPanel.appendChild(toggleTrackingBtn);
  
    const resetStateBtn = document.createElement('button');
    resetStateBtn.id = 'reset-state';
    resetStateBtn.textContent = 'Reset State';
    resetStateBtn.addEventListener('click', () => {
      console.log('Resetting state');
      // Implement reset functionality here
    });
    controlPanel.appendChild(resetStateBtn);
  
    // Map --------------------------------------------------------------
    // using leaflet.js
    const mapElement = document.createElement('div');
    mapElement.id = 'map';
    mapElement.style.height = '400px';
    mapElement.style.width = '100%';
    mapElement.style.backgroundColor = '#eaeaea';
    appContainer.appendChild(mapElement);

    // Initialize the Leaflet map
    const map = L.map(mapElement).setView([51.505, -0.09], 13);

    // Add a tile layer from OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Represent the player's initial position
    const playerMarker = L.marker([51.505, -0.09]).addTo(map)
        .bindPopup('You are here');

    // Example cache positions
    const caches = [
        {lat: 51.5, lng: -0.1},
        {lat: 51.51, lng: -0.08},
        {lat: 51.509, lng: -0.07},
    ];

    caches.forEach(cache => {
        L.marker([cache.lat, cache.lng]).addTo(map)
            .bindPopup('Cache location');
    });
  
    // Cache Details ------------------------------------------------------
    const cacheDetails = document.createElement('div');
    cacheDetails.id = 'cache-details';
    appContainer.appendChild(cacheDetails);
  
    const cacheDetailsTitle = document.createElement('h3');
    cacheDetailsTitle.textContent = 'Cache Details';
    cacheDetails.appendChild(cacheDetailsTitle);
  
    const collectCoinBtn = document.createElement('button');
    collectCoinBtn.id = 'collect-coin';
    collectCoinBtn.textContent = 'Collect Coin';
    collectCoinBtn.addEventListener('click', () => {
      console.log('Collecting coin');
      // Implement collecting logic here
    });
    cacheDetails.appendChild(collectCoinBtn);
  
    const depositCoinBtn = document.createElement('button');
    depositCoinBtn.id = 'deposit-coin';
    depositCoinBtn.textContent = 'Deposit Coin';
    depositCoinBtn.addEventListener('click', () => {
      console.log('Depositing coin');
      // Implement depositing logic here
    });
    cacheDetails.appendChild(depositCoinBtn);
  
    // Inventory ----------------------------------------------------------
    const inventory = document.createElement('div');
    inventory.id = 'inventory';
    appContainer.appendChild(inventory);
  
    const inventoryTitle = document.createElement('h3');
    inventoryTitle.textContent = 'Inventory';
    inventory.appendChild(inventoryTitle);
  
    // Placeholder for inventory items
    // Implement inventory display logic here
  });