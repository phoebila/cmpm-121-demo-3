// main.ts

// thanks Brace and ChatGPT for help !!!!
// got rid of reset button and tracking player location
document.addEventListener('DOMContentLoaded', () => {
    // basic setup for app -----------------------------------
    const appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);

    const headingContainer = document.createElement('div');
    headingContainer.id = 'heading-container';
    headingContainer.style.backgroundColor = '#4A90E2';
    headingContainer.style.color = 'white';
    headingContainer.style.padding = '10px';
    headingContainer.style.textAlign = 'center';
    appContainer.appendChild(headingContainer);

    const title = document.createElement('h1');
    title.textContent = 'Geocoin Carrier';
    headingContainer.appendChild(title);

    const controlPanel = document.createElement('div');
    controlPanel.id = 'control-panel';
    headingContainer.appendChild(controlPanel);

    let markers: L.Marker[] = [];
    let inventory: { [key: string]: number } = {};
    let latitudeStart = 36.9895;
    let longitudeStart = -122.0628;
    let playerPosition = { lat: latitudeStart, lng: longitudeStart };
    let zoomLevel = 150; // Default zoom level
    const cellSize = 0.0001;
    const gridSteps = 8;
    const cacheProbability = 0.1;

    // player pathing -----------------------------------
    let playerPath: L.LatLng[] = [];
    let playerPathPolyline: L.Polyline | null = null;

    const mapContainer = document.createElement('div');
    mapContainer.id = 'map-container';
    mapContainer.style.margin = '10px 0';
    mapContainer.style.backgroundColor = '#F1F1F1';
    mapContainer.style.border = '1px solid #CCCCCC';
    appContainer.appendChild(mapContainer);

    const mapElement = document.createElement('div');
    mapElement.id = 'map';
    mapElement.style.height = '400px';
    mapElement.style.width = '100%';
    mapContainer.appendChild(mapElement);

    const inventoryContainer = document.createElement('div');
    inventoryContainer.id = 'inventory-container';
    inventoryContainer.style.backgroundColor = '#FFAC45';
    inventoryContainer.style.padding = '10px';
    inventoryContainer.style.color = 'white';
    appContainer.appendChild(inventoryContainer);

    const inventoryTitle = document.createElement('h3');
    inventoryTitle.id = 'inventory-title';
    inventoryContainer.appendChild(inventoryTitle);

    // directional setup -----------------------------------
    // Create directional buttons
    const createDirectionButton = (direction: string, text: string, onClick: () => void) => {
        const btn = document.createElement('button');
        btn.id = `move-${direction}`;
        btn.textContent = text;
        btn.style.margin = '5px'; // Keep margin inline for buttons
        btn.addEventListener('click', onClick);
        return btn;
    };

    // Add directional buttons to the control panel -----------------------------------
    const directionPanel = document.createElement('div');
    directionPanel.id = 'direction-panel';
    controlPanel.appendChild(directionPanel);

    // Movement increment constant
    const movementIncrement = 1; // Adjust this value for desired movement speed

    // Add directional buttons to the control panel -----------------------------------
    // Use movementIncrement for more noticeable movement
    directionPanel.appendChild(createDirectionButton('north', '⬆️', () => movePlayer(0, movementIncrement)));
    directionPanel.appendChild(createDirectionButton('west', '⬅️', () => movePlayer(-movementIncrement, 0)));
    directionPanel.appendChild(createDirectionButton('south', '⬇️', () => movePlayer(0, -movementIncrement)));
    directionPanel.appendChild(createDirectionButton('east', '➡️', () => movePlayer(movementIncrement, 0)));

    // part d, geolocation -----------------------------------
    // Initialize a variable to store the geolocation watch ID
    let geoWatchId: number | null = null;

    // Function to handle geolocation updates
    const updatePositionWithGeolocation = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;

        // Update player's position
        latitudeStart = latitude;
        longitudeStart = longitude;

        // Update map view to new geolocation position
        map.setView([latitudeStart, longitudeStart], map.getZoom()); // Use current zoom level


        // Regenerate caches based on new position
        regenerateCaches();
        console.log(`Geolocation updated: ${latitude}, ${longitude}`);
    };

    // Function to toggle geolocation tracking
    const toggleGeolocation = () => {
        if (geoWatchId !== null) {
            // Stop watching geolocation if already enabled
            navigator.geolocation.clearWatch(geoWatchId);
            geoWatchId = null;
            console.log("Geolocation tracking disabled.");
        } else {
            // Start watching geolocation
            if (navigator.geolocation) {
                geoWatchId = navigator.geolocation.watchPosition(
                    updatePositionWithGeolocation,
                    (error) => console.error("Geolocation error:", error),
                    { enableHighAccuracy: true }
                );
                console.log("Geolocation tracking enabled.");
            } else {
                alert("Geolocation is not supported by this browser.");
            }
        }
    };

    // Create and add the geolocation button to the control panel
    const geolocationButton = document.createElement('button');
    geolocationButton.textContent = '🌐';
    geolocationButton.style.margin = '5px';
    geolocationButton.addEventListener('click', toggleGeolocation);
    controlPanel.appendChild(geolocationButton);

    const cacheVisibilityRadius = 0.002; // Define a radius for cache visibility (adjust as needed)
    // Function to clear all existing markers from the map
    const clearMarkers = () => {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
    };

    // Update the regenerateCaches function to save the states before regenerating
    // Update regenerateCaches to save player position as well
    const regenerateCaches = () => {
        saveGameState(inventory, caches, { lat: latitudeStart, lng: longitudeStart }); // Save player position
        clearMarkers();
        caches = createCacheGrid([latitudeStart, longitudeStart]);
        restoreCacheStates();
        initializeMarkers();
    };

    
    // Function to update the player’s movement and the polyline
    const movePlayer = (deltaX: number, deltaY: number) => {
        // Update player's position based on movement deltas
        latitudeStart += deltaY * cellSize;
        longitudeStart += deltaX * cellSize;

        // Create a new LatLng object for the updated player position
        const newPlayerPosition = L.latLng(latitudeStart, longitudeStart);

        // Add the new player position to the path array
        playerPath.push(newPlayerPosition);

        // Update the map's view with the new coordinates and current zoom level
        map.setView([latitudeStart, longitudeStart], map.getZoom()); 

        // Regenerate caches based on the player's new position
        regenerateCaches(); 

        // Redraw the polyline to reflect the updated movement history
        updatePlayerPath();

        // Log the new position to the console
        console.log(`Moved to: ${latitudeStart}, ${longitudeStart}`);
    };

    // Function to update the player path polyline -----------------------------------
    function updatePlayerPath() {
        // Remove the existing polyline
        if (playerPathPolyline) {
            playerPathPolyline.remove();
        }
    
        // Add a new polyline to represent the movement history
        playerPathPolyline = L.polyline(playerPath, {
            color: 'blue',  // Polyline color
            weight: 4,      // Line width
            opacity: 0.6    // Line opacity
        }).addTo(map);
    }

    // MEMENTO PATTERN -----------------------------------
    class CacheMemento {
        constructor(public lat: number, public lng: number, public coins: Coin[]) {}
    }
    
    class CacheOriginator {
        constructor(private cache: Cache) {}
    
        createMemento(): CacheMemento {
            return new CacheMemento(this.cache.lat, this.cache.lng, this.cache.coins.map(coin => ({ ...coin })));
        }
    
        restore(memento: CacheMemento) {
            this.cache.lat = memento.lat;
            this.cache.lng = memento.lng;
            this.cache.coins = memento.coins;
        }
    }

    let cacheMementos: { [key: string]: CacheMemento } = {};

    // Function to save the state of caches
    const saveCacheStates = () => {
        caches.forEach((cache) => {
            const key = `${cache.gridCell.i}-${cache.gridCell.j}`;
            const originator = new CacheOriginator(cache);
            cacheMementos[key] = originator.createMemento();
        });
    };

    // Function to restore cache states
    const restoreCacheStates = () => {
        caches.forEach((cache) => {
            const key = `${cache.gridCell.i}-${cache.gridCell.j}`;
            const memento = cacheMementos[key];
            if (memento) {
                const originator = new CacheOriginator(cache);
                originator.restore(memento);
            }
        });
    };

    // Leaflet map setup -----------------------------------
     // Initialize the map with the saved or default player position
     const map = L.map('map').setView([latitudeStart, longitudeStart], zoomLevel);

     // Add your tile layer (e.g., OpenStreetMap)
     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // random seed func for cache and coin generation -----------------------------------
    class SeededRandom {
        constructor(private seed: number) {}
        next(): number {
            this.seed = (this.seed * 9301 + 49297) % 233280;
            return this.seed / 233280.0;
        }
    }

    const randomGen = new SeededRandom(12345);

    // interfaces for items -----------------------------------
    interface Coin {
        type: string;
        count: number;
        serial: number;
        gridCell: GridCell; // Add gridCell property to Coin
    }

    interface Cache {
        lat: number;
        lng: number;
        coins: Coin[];
        gridCell: GridCell;
    }

    interface GridCell {
        i: number;
        j: number;
    }

    // flyweight pattern for grid cells -----------------------------------
    class FlyweightFactory {
        private static gridCellCache: { [key: string]: GridCell } = {};

        public static getGridCell(lat: number, lng: number): GridCell {
            const i = Math.floor(lat / cellSize);
            const j = Math.floor(lng / cellSize);
            const key = `${i}-${j}`;
            if (!this.gridCellCache[key]) {
                this.gridCellCache[key] = { i, j };
            }
            return this.gridCellCache[key];
        }
    }

    // coin setup -----------------------------------
    const coinTypes = ['Copper', 'Silver', 'Gold'];

    const generateCoins = (gridCell: GridCell): Coin[] => {
        return coinTypes.map((coinType, serial) => ({
            type: coinType,
            count: Math.floor(randomGen.next() * 9) + 1,
            serial: serial,
            gridCell: gridCell // Ensure gridCell is included
        }));
    };

    // Function to create cache grid based on the player's position
    const createCacheGrid = (center: [number, number]): Cache[] => {
        const caches: Cache[] = [];
        for (let i = -gridSteps; i <= gridSteps; i++) {
            for (let j = -gridSteps; j <= gridSteps; j++) {
                const lat = center[0] + (i * cellSize);
                const lng = center[1] + (j * cellSize);
                const distance = Math.sqrt(Math.pow(lat - latitudeStart, 2) + Math.pow(lng - longitudeStart, 2));
                if (distance <= cacheVisibilityRadius && randomGen.next() < cacheProbability) {
                    const gridCell = FlyweightFactory.getGridCell(lat, lng);
                    // Check if the cache already exists to restore its state
                    const existingCache = caches.find(c => c.gridCell.i === gridCell.i && c.gridCell.j === gridCell.j);
                    if (existingCache) {
                        // Restore state from memento if exists
                        const memento = cacheMementos[`${gridCell.i}-${gridCell.j}`];
                        if (memento) {
                            existingCache.lat = memento.lat;
                            existingCache.lng = memento.lng;
                            existingCache.coins = memento.coins;
                        }
                        caches.push(existingCache);
                    } else {
                        const coins = generateCoins(gridCell);
                        caches.push({ lat, lng, coins, gridCell });
                    }
                }
            }
        }
        return caches;
    };

    let caches = createCacheGrid([latitudeStart, longitudeStart]);

    const playerIcon = L.icon({
        iconUrl: './project/pin.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        tooltipAnchor: [0, -30]
    });

    // ui for inventory -----------------------------------
    const updateInventoryDisplay = () => {
        const inventoryTitle = document.getElementById('inventory-title');
        if (inventoryTitle) {
            const content = coinTypes.map(coinType => {
                const count = inventory[coinType] || 0;
                return `${coinType}: ${count}`;
            }).join(', ');
            inventoryTitle.textContent = `Inventory: ${content}`;
        }
    };


    // Initialize markers
   // main func, initialize markers -----------------------------------
    const initializeMarkers = () => {
        // Load the saved player position and caches from localStorage
        const savedPlayerPosition = localStorage.getItem('playerPosition');
        if (savedPlayerPosition) {
            const parsedPosition = JSON.parse(savedPlayerPosition);
            latitudeStart = parsedPosition.lat;
            longitudeStart = parsedPosition.lng;

            // Optionally adjust the zoom level here based on saved settings or preferences
            zoomLevel = parsedPosition.zoom || 13; // Default to 13 if no saved zoom
        }
    
        const savedCaches = localStorage.getItem('caches');

        // Parse the saved data, or fallback to defaults
        const playerPosition = savedPlayerPosition
            ? JSON.parse(savedPlayerPosition)
            : { lat: latitudeStart, lng: longitudeStart }; // Default player position if none found

        const caches = savedCaches ? JSON.parse(savedCaches) : []; // Empty array if no saved caches

        // Create the player marker at the saved or default position
        const playerMarker = L.marker([latitudeStart, longitudeStart], { icon: playerIcon }).addTo(map)
        .bindTooltip('Player Location', { permanent: true, direction: 'top' });

        markers.push(playerMarker);

        // Initialize cache markers from saved data
        caches.forEach((cache, index) => {
            const marker = L.marker([cache.lat, cache.lng]).addTo(map);
            markers.push(marker);

            const updatePopup = () => {
                const gridCell = cache.gridCell; // Use cache.gridCell which is guaranteed to exist
                if (gridCell) {
                    const { i, j } = gridCell; // Safely extract i and j
                    const coinDescriptions = cache.coins.map(coin => {
                        // Ensure coin.gridCell is valid before accessing its properties
                        const coinGridCell = coin.gridCell;
                        return coinGridCell
                            ? `${coin.type}: ${coin.count} (ID: ${coinGridCell.i}:${coinGridCell.j}#${coin.serial})`
                            : `${coin.type}: ${coin.count} (ID: N/A)`;
                    }).join('<br>');
                    let popupContent = `Cache location:<br>${coinDescriptions ? coinDescriptions : '0 coins'}<br>`;
                    popupContent += `Grid Cell: {i: ${i}, j: ${j}}<br>`;
                    popupContent += `<button id="collect-btn-${index}">Collect Coins</button>`;
                    popupContent += `<button id="deposit-btn-${index}">Deposit Coins</button>`;
                    marker.bindPopup(popupContent);
                }
            };

            updatePopup();

            marker.on('popupopen', () => {
                document.getElementById(`collect-btn-${index}`)?.addEventListener('click', () => {
                    cache.coins.forEach(coin => {
                        inventory[coin.type] = (inventory[coin.type] || 0) + coin.count;
                    });
                    cache.coins = [];
                    updateInventoryDisplay();
                    updatePopup();
                    // Pass the player position and updated caches when calling saveGameState
                    saveGameState(inventory, caches, playerPosition);
                });

                document.getElementById(`deposit-btn-${index}`)?.addEventListener('click', () => {
                    coinTypes.forEach(coinType => {
                        const inventoryCount = inventory[coinType] || 0;
                        if (inventoryCount > 0) {
                            let cacheCoin = cache.coins.find(coin => coin.type === coinType);
                            if (!cacheCoin) {
                                cacheCoin = { type: coinType, count: 0, serial: -1, gridCell: cache.gridCell }; // Ensure gridCell is stored
                                cache.coins.push(cacheCoin);
                            }
                            cacheCoin.count += inventoryCount;
                            inventory[coinType] = 0;
                        }
                    });
                    updateInventoryDisplay();
                    updatePopup();
                    // Pass the player position and updated caches when calling saveGameState
                    saveGameState(inventory, caches, playerPosition);
                });
            });
        });
    };

    // save and load game state -----------------------------------
    const saveGameState = (inventory: { [key: string]: number }, caches: Cache[], playerPosition: { lat: number, lng: number }) => {
        localStorage.setItem('inventory', JSON.stringify(inventory));
        localStorage.setItem('caches', JSON.stringify(caches));
        localStorage.setItem('playerPosition', JSON.stringify(playerPosition)); // Save player position
    };

    const loadGameState = () => {
        const savedInventory = localStorage.getItem('inventory');
        const savedCaches = localStorage.getItem('caches');
        if (savedInventory) {
            inventory = JSON.parse(savedInventory);
        }
        if (savedCaches) {
            caches = JSON.parse(savedCaches);
            caches.forEach(cache => {
                cache.coins = cache.coins.map((coin: any) => ({
                    ...coin,
                    gridCell: FlyweightFactory.getGridCell(cache.lat, cache.lng) // Ensure gridCell is re-assigned
                }));
            });
        }
    };

    loadGameState();
    initializeMarkers();
    updateInventoryDisplay();

    // auto saving -----------------------------------
    setInterval(() => {
        const playerPosition = { lat: latitudeStart, lng: longitudeStart };
        saveGameState(inventory, caches, playerPosition);
        console.log('Game state auto-saved');
    }, 60000); // Save every 60 seconds
});