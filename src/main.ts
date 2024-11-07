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
    headingContainer.style.backgroundColor = '#843B62';
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

    // reset variables -----------------------------------
    let coins: Coin[] = [];  // List of all coins
    let homeCaches: Cache[] = [];  // List of caches where coins belong

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
    inventoryContainer.style.backgroundColor = '#0B032D';
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

    //reset game state -----------------------------------
    const resetGameState = () => {

        const confirmation = window.confirm("Are you sure you want to erase all progress and reset the game state?");
    
        if (!confirmation) {
            console.log("Game reset canceled by the user.");
            return; // Exit the function if the user cancels
        }

        // Reset the player's position to the start coordinates
        latitudeStart = 36.9895;
        longitudeStart = -122.0628;
        playerPath = [];
        map.setView([latitudeStart, longitudeStart], map.getZoom()); 

        // Clear any markers or paths on the map (if using Leaflet or similar)
        if (playerPathPolyline) {
            map.removeLayer(playerPathPolyline);  // Remove any existing path polyline
        }

        // Return coins to their home caches (remove from inventory)
        inventory = {};

        // Reset caches to their initial state
        regenerateCaches();

        // Erase any sensitive location history
        geoWatchId = null;
        localStorage.clear(); // Clear local storage to remove location history

        console.log('Game state has been reset.');
    };

    const resetButton = document.createElement('button');
    resetButton.textContent = '🚮 Reset';
    resetButton.style.margin = '5px';
    resetButton.addEventListener('click', resetGameState);
    controlPanel.appendChild(resetButton);

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
        iconUrl: './src/assets/pin.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        tooltipAnchor: [0, -30]
    });

    // ui for inventory -----------------------------------
    const updateInventoryDisplay = () => {
        inventoryTitle.textContent = 'Current Inventory';
        inventoryContainer.innerHTML = ''; // Clear previous content

        for (const coinType in inventory) {
            if (inventory.hasOwnProperty(coinType)) {
                const coinCount = inventory[coinType];
                const item = document.createElement('div');
                item.textContent = `${coinType}: ${coinCount}`;
                inventoryContainer.appendChild(item);
            }
        }
    };


    // Initialize markers
    // Initialize markers
// Initialize markers
const initializeMarkers = () => {
    // Load the saved player position and caches from localStorage
    const savedPlayerPosition = localStorage.getItem('playerPosition');
    if (savedPlayerPosition) {
        const parsedPosition = JSON.parse(savedPlayerPosition);
        latitudeStart = parsedPosition.lat;
        longitudeStart = parsedPosition.lng;

        zoomLevel = parsedPosition.zoom || 13; // Default to 13 if no saved zoom
    }

    const savedCaches = localStorage.getItem('caches');
    const playerPosition = savedPlayerPosition
        ? JSON.parse(savedPlayerPosition)
        : { lat: latitudeStart, lng: longitudeStart };

    const caches = savedCaches ? JSON.parse(savedCaches) : [];

    const playerMarker = L.marker([latitudeStart, longitudeStart], { icon: playerIcon }).addTo(map)
        .bindTooltip('Player Location', { permanent: true, direction: 'top' });

    markers.push(playerMarker);

    // Initialize cache markers from saved data
    caches.forEach((cache, index) => {
        const marker = L.marker([cache.lat, cache.lng]).addTo(map);
        markers.push(marker);

        // Function to update the popup content dynamically
        // Function to update the popup content dynamically
        const updatePopup = () => {
            const gridCell = cache.gridCell; // Use cache.gridCell which is guaranteed to exist
            if (gridCell) {
                const { i, j } = gridCell;
                const coinDescriptions = cache.coins.map(coin => {
                    const serial = coin.serial !== undefined && coin.serial !== null ? coin.serial : 'N/A';
                    const coinGridCell = coin.gridCell;
                    const coinDescription = coinGridCell
                        ? `${coin.count} (ID: ${coinGridCell.i}:${coinGridCell.j}#${serial})`
                        : `${coin.type}: ${coin.count} (ID: N/A)`;

                    // Dynamically set the image source based on the coin type
                    const coinImageSrc = `./src/assets/${coin.type.toLowerCase()}.png`; // coin types are 'Copper', 'Silver', 'Gold', etc.
                    const coinImage = `<img src="${coinImageSrc}" alt="${coin.type}" style="width: 20px; height: 20px; margin-right: 5px;">`;

                    // Return the coin description with the image and button to center on cache
                    return `
                        <div>
                            <span class="clickable-coin" data-lat="${cache.lat}" data-lng="${cache.lng}" data-coin-id="${serial}">
                                ${coinImage} ${serial} - ${coinDescription}
                            </span>
                            <button class="center-map-btn" data-lat="${cache.lat}" data-lng="${cache.lng}">
                                Center on Cache
                            </button>
                        </div>
                    `;
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
            // Collect coins
            document.getElementById(`collect-btn-${index}`)?.addEventListener('click', () => {
                cache.coins.forEach(coin => {
                    inventory[coin.type] = (inventory[coin.type] || 0) + coin.count;
                });
                cache.coins = [];
                updateInventoryDisplay();
                updatePopup();
        
                saveGameState(inventory, caches, playerPosition);
            });

            // Deposit coins
            document.getElementById(`deposit-btn-${index}`)?.addEventListener('click', () => {
                coinTypes.forEach(coinType => {
                    const inventoryCount = inventory[coinType] || 0;
                    if (inventoryCount > 0) {
                        let cacheCoin = cache.coins.find(coin => coin.type === coinType);
                        if (!cacheCoin) {
                            cacheCoin = { type: coinType, count: 0, serial: -1, gridCell: cache.gridCell };
                            cache.coins.push(cacheCoin);
                        }
                        cacheCoin.count += inventoryCount;
                        inventory[coinType] = 0;
                    }
                });
                updateInventoryDisplay();
                updatePopup();

                saveGameState(inventory, caches, playerPosition);
            });

             // Handle clicking a coin identifier to center the map on its home cache
            const coinElements = document.querySelectorAll('.clickable-coin');
            coinElements.forEach((coinElement) => {
                coinElement.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    const lat = parseFloat(target.getAttribute('data-lat')!);
                    const lng = parseFloat(target.getAttribute('data-lng')!);

                    // Center the map on the cache location
                    map.setView([lat, lng], map.getZoom()); // Use current zoom level
                });
            });
        });
    });
};

    map.on('popupopen', () => {
        const centerMapButtons = document.querySelectorAll('.center-map-btn');
        centerMapButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Type guard: check if e.target is not null and is an HTMLElement
                const target = e.target as HTMLElement | null;
                if (target) {
                    const lat = parseFloat(target.getAttribute('data-lat')!); // Use non-null assertion because we already checked null
                    const lng = parseFloat(target.getAttribute('data-lng')!);

                    // Center the map on the cache location
                    map.setView([lat, lng], map.getZoom()); // Use current zoom level
                }
            });
        });
    });

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