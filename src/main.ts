document.addEventListener('DOMContentLoaded', () => {
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

    const createButton = (id: string, text: string, onClick: () => void) => {
        const btn = document.createElement('button');
        btn.id = id;
        btn.textContent = text;
        btn.style.margin = '5px';
        btn.addEventListener('click', onClick);
        return btn;
    };

    let markers: L.Marker[] = [];

    const resetState = () => {
        clearMarkers();
        inventory = {};
        caches = createCacheGrid([latitudeStart, longitudeStart]);
        initializeMarkers();
        saveGameState(inventory, caches);
        updateInventoryDisplay();
        console.log('State has been reset');
    };

    controlPanel.appendChild(createButton('toggle-tracking', 'Toggle Tracking', () => {
        console.log('Toggling real-time position tracking');
    }));

    controlPanel.appendChild(createButton('reset-state', 'Reset State', resetState));

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

    const latitudeStart = 36.9895;
    const longitudeStart = -122.0628;
    const cellSize = 0.0001;
    const gridSteps = 8;
    const cacheProbability = 0.1;

    const map = L.map(mapElement).setView([latitudeStart, longitudeStart], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    class SeededRandom {
        constructor(private seed: number) {}
        next(): number {
            this.seed = (this.seed * 9301 + 49297) % 233280;
            return this.seed / 233280.0;
        }
    }

    const randomGen = new SeededRandom(12345);

    interface Coin {
        type: string;
        count: number;
        serial: number;
        origin: { i: number; j: number };
    }

    interface Cache {
        lat: number;
        lng: number;
        coins: Coin[];
        gridCell: GridCell | null;
    }

    interface GridCell {
        i: number;
        j: number;
    }

    class FlyweightFactory {
        private static gridCellCache: { [key: string]: GridCell } = {};

        public static getGridCell(lat: number, lng: number): GridCell | null {
            const i = Math.floor(lat / cellSize);
            const j = Math.floor(lng / cellSize);
            const key = `${i}-${j}`;
            if (!this.gridCellCache[key]) {
                this.gridCellCache[key] = { i, j };
            }
            return this.gridCellCache[key];
        }
    }

    const coinTypes = ['Copper', 'Silver', 'Gold'];

    const generateCoins = (gridCell: GridCell | null): Coin[] => {
        if (!gridCell) {
            console.warn("generateCoins called with undefined gridCell");
            return [];
        }
        return coinTypes.map((coinType, serial) => ({
            type: coinType,
            count: Math.floor(randomGen.next() * 9) + 1,
            serial,
            origin: { i: gridCell.i, j: gridCell.j }
        }));
    };

    const createCacheGrid = (center: [number, number]): Cache[] => {
        const caches: Cache[] = [];
        for (let i = -gridSteps; i <= gridSteps; i++) {
            for (let j = -gridSteps; j <= gridSteps; j++) {
                if (randomGen.next() < cacheProbability) {
                    const lat = center[0] + (i * cellSize);
                    const lng = center[1] + (j * cellSize);
                    const gridCell = FlyweightFactory.getGridCell(lat, lng);
                    const coins = gridCell ? generateCoins(gridCell) : [];
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

    let inventory: { [key: string]: number } = {};

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

    const clearMarkers = () => {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
    };

    const updatePopup = (cache: Cache, marker: L.Marker, index: number) => {
        const { i, j } = cache.gridCell || { i: 0, j: 0 }; // Fallback to 0 if gridCell is undefined
        const coinDescriptions = cache.coins.map(coin =>
            `${coin.type}: ${coin.count} (Serial: ${coin.serial}, Origin: {i: ${coin.origin.i}, j: ${coin.origin.j}})`).join('<br>');
        let popupContent = `Cache location:<br>${coinDescriptions ? coinDescriptions : '0 coins'}<br>`;
        popupContent += `Grid Cell: {i: ${i}, j: ${j}}<br>`;
        popupContent += `<button id="collect-btn-${index}">Collect Coins</button>`;
        popupContent += `<button id="deposit-btn-${index}">Deposit Coins</button>`;
        marker.bindPopup(popupContent);
    };

    const initializeMarkers = () => {
        const playerMarker = L.marker([latitudeStart, longitudeStart], { icon: playerIcon }).addTo(map)
            .bindTooltip('Player Location', { permanent: true, direction: 'top' });

        markers.push(playerMarker);

        caches.forEach((cache, index) => {
            const marker = L.marker([cache.lat, cache.lng]).addTo(map);
            markers.push(marker);

            updatePopup(cache, marker, index);

            marker.on('popupopen', () => {
                document.getElementById(`collect-btn-${index}`)?.addEventListener('click', () => {
                    cache.coins.forEach(coin => {
                        inventory[coin.type] = (inventory[coin.type] || 0) + coin.count;
                    });
                    cache.coins = [];
                    updateInventoryDisplay();
                    updatePopup(cache, marker, index);
                    saveGameState(inventory, caches);
                });
                document.getElementById(`deposit-btn-${index}`)?.addEventListener('click', () => {
                    coinTypes.forEach(coinType => {
                        const inventoryCount = inventory[coinType] || 0;
                        if (inventoryCount > 0) {
                            let cacheCoin = cache.coins.find(coin => coin.type === coinType);
                            if (!cacheCoin) {
                                cacheCoin = { type: coinType, count: 0, serial: -1, origin: { i: cache.gridCell?.i ?? 0, j: cache.gridCell?.j ?? 0 } };
                                cache.coins.push(cacheCoin);
                            }
                            cacheCoin.count += inventoryCount;
                            inventory[coinType] = 0;
                        }
                    });
                    updateInventoryDisplay();
                    updatePopup(cache, marker, index);
                    saveGameState(inventory, caches);
                });
            });
        });
    };

    const saveGameState = (inventory: { [key: string]: number }, caches: Cache[]) => {
        localStorage.setItem('inventory', JSON.stringify(inventory));
        localStorage.setItem('caches', JSON.stringify(caches));
    };

    const loadGameState = () => {
        const savedInventory = localStorage.getItem('inventory');
        const savedCaches = localStorage.getItem('caches');
        if (savedInventory) inventory = JSON.parse(savedInventory);
        if (savedCaches) caches = JSON.parse(savedCaches);
    };

    loadGameState();
    initializeMarkers();
    updateInventoryDisplay();
});
