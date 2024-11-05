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
    const cellSize = 0.0001;
    const gridSteps = 8;
    const cacheProbability = 0.1;

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

    // Add directional buttons to the control panel
    const directionPanel = document.createElement('div');
    directionPanel.id = 'direction-panel';
    controlPanel.appendChild(directionPanel);

    directionPanel.appendChild(createDirectionButton('north', '⬆️', () => movePlayer(0, 1)));
    directionPanel.appendChild(createDirectionButton('west', '⬅️', () => movePlayer(-1, 0)));
    directionPanel.appendChild(createDirectionButton('south', '⬇️', () => movePlayer(0, -1)));
    directionPanel.appendChild(createDirectionButton('east', '➡️', () => movePlayer(1, 0)));

    const cacheVisibilityRadius = 0.002; // Define a radius for cache visibility (adjust as needed)
    // Function to clear all existing markers from the map
    const clearMarkers = () => {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
    };

    // Function to regenerate caches based on the player's position
    const regenerateCaches = () => {
        // Clear existing markers and caches
        clearMarkers();
        caches = createCacheGrid([latitudeStart, longitudeStart]); // Regenerate caches based on new position
        initializeMarkers(); // Reinitialize markers on the map
    };

    // Update the movePlayer function to regenerate caches when the player moves
    const movePlayer = (deltaX: number, deltaY: number) => {
        latitudeStart += deltaY * cellSize; // Adjust latitude for north/south movement
        longitudeStart += deltaX * cellSize; // Adjust longitude for east/west movement

        // Update the map's view to the new location
        map.setView([latitudeStart, longitudeStart], 17);

        // Regenerate caches based on new player position
        regenerateCaches();

        console.log(`Moved to: ${latitudeStart}, ${longitudeStart}`);
    };

    // Leaflet map setup -----------------------------------
    const map = L.map(mapElement).setView([latitudeStart, longitudeStart], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

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
                // Check if the cache is within the visibility radius
                const distance = Math.sqrt(Math.pow(lat - latitudeStart, 2) + Math.pow(lng - longitudeStart, 2));
                if (distance <= cacheVisibilityRadius && randomGen.next() < cacheProbability) {
                    const gridCell = FlyweightFactory.getGridCell(lat, lng);
                    const coins = generateCoins(gridCell);
                    caches.push({ lat, lng, coins, gridCell });
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

    // main func, initialize markers -----------------------------------
    const initializeMarkers = () => {
        const playerMarker = L.marker([latitudeStart, longitudeStart], { icon: playerIcon }).addTo(map)
            .bindTooltip('Player Location', { permanent: true, direction: 'top' });

        markers.push(playerMarker);

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
                    saveGameState(inventory, caches);
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
                    saveGameState(inventory, caches);
                });
            });
        });
    };

    // save and load game state -----------------------------------
    const saveGameState = (inventory: { [key: string]: number }, caches: Cache[]) => {
        localStorage.setItem('inventory', JSON.stringify(inventory));
        localStorage.setItem('caches', JSON.stringify(caches));
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
});
