// main.ts

document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.createElement('div');
    appContainer.id = 'app';
    document.body.appendChild(appContainer);

    const title = document.createElement('h1');
    title.textContent = 'Geocoin Carrier';
    appContainer.appendChild(title);

    const controlPanel = document.createElement('div');
    controlPanel.id = 'control-panel';
    appContainer.appendChild(controlPanel);

    const createButton = (id: string, text: string, onClick: () => void) => {
        const btn = document.createElement('button');
        btn.id = id;
        btn.textContent = text;
        btn.addEventListener('click', onClick);
        return btn;
    };

    controlPanel.appendChild(createButton('toggle-tracking', 'Toggle Tracking', () => {
        console.log('Toggling real-time position tracking');
    }));

    const resetState = () => {
        inventory = 0;
        caches = createCacheGrid([latitudeStart, longitudeStart]);
        initializeMarkers(); // Reinitialize markers with updated state
        saveGameState(inventory, caches); // Save state after reset
        updateInventoryDisplay(inventory);
        console.log('State has been reset');
    };

    controlPanel.appendChild(createButton('reset-state', 'Reset State', resetState));

    // Map Setup
    const latitudeStart = 36.9895;
    const longitudeStart = -122.0628;
    const cellSize = 0.0001;
    const gridSteps = 8; // 8 steps in the grid
    const cacheProbability = 0.1; // 10% cells will have caches

    const mapElement = document.createElement('div');
    mapElement.id = 'map';
    mapElement.style.height = '400px';
    mapElement.style.width = '100%';
    mapElement.style.backgroundColor = '#eaeaea';
    appContainer.appendChild(mapElement);

    const map = L.map(mapElement).setView([latitudeStart, longitudeStart], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    class SeededRandom {
        constructor(private seed: number) { }
        next(): number {
            this.seed = (this.seed * 9301 + 49297) % 233280;
            return this.seed / 233280.0;
        }
    }

    const randomGen = new SeededRandom(12345);

    interface Coin {
        type: string;
        value: number;
    }

    interface Cache {
        lat: number;
        lng: number;
        coins: Coin[];
    }

    const coinTypes = [
        { type: 'Copper', value: 1 },
        { type: 'Silver', value: 5 },
        { type: 'Gold', value: 10 }
    ];

    const generateCoins = (): Coin[] => {
        const numCoins = Math.floor(randomGen.next() * 3) + 1; // 1 to 3 coins
        return Array.from({ length: numCoins }, () => {
            return coinTypes[Math.floor(randomGen.next() * coinTypes.length)];
        });
    };

    const createCacheGrid = (center: [number, number]): Cache[] => {
        const caches: Cache[] = [];
        for (let i = -gridSteps; i <= gridSteps; i++) {
            for (let j = -gridSteps; j <= gridSteps; j++) {
                if (randomGen.next() < cacheProbability) {
                    const lat = center[0] + (i * cellSize);
                    const lng = center[1] + (j * cellSize);
                    const coins = generateCoins();
                    caches.push({ lat, lng, coins });
                }
            }
        }
        return caches;
    };

    let caches = createCacheGrid([latitudeStart, longitudeStart]);

    const updateInventoryDisplay = (inventory: number) => {
        const inventoryTitle = document.getElementById('inventory-title');
        if (inventoryTitle) {
            inventoryTitle.textContent = `Inventory: ${inventory} coins`;
        }
    };

    let inventory = 0;

    const initializeMarkers = () => {
        caches.forEach((cache, index) => {
            const marker = L.marker([cache.lat, cache.lng]).addTo(map);
            const updatePopup = () => {
                const totalCoins = cache.coins.length;
                let popupContent = `Cache location: ${totalCoins} coins<br>`;
                if (totalCoins > 0) {
                    popupContent += `<button id="collect-btn-${index}">Collect Coins</button>`;
                }
                marker.bindPopup(popupContent);
            };

            const collectCoins = () => {
                const totalCoinValue = cache.coins.reduce((sum, coin) => sum + coin.value, 0);
                inventory += totalCoinValue;
                cache.coins = []; // Empty the cache after collection
                updateInventoryDisplay(inventory);
                updatePopup();
                saveGameState(inventory, caches);
            };

            updatePopup();

            map.on("popupopen", function() {
                document.getElementById(`collect-btn-${index}`)?.addEventListener('click', collectCoins);
            });
        });
    };

    const saveGameState = (inventory: number, caches: Cache[]) => {
        localStorage.setItem('geocoinGameState', JSON.stringify({ inventory, caches }));
    };

    const loadGameState = (): { inventory: number, caches: Cache[] } | null => {
        const stateJSON = localStorage.getItem('geocoinGameState');
        return stateJSON ? JSON.parse(stateJSON) : null;
    };

    const cachedState = loadGameState();
    inventory = cachedState ? cachedState.inventory : 0;
    caches = cachedState ? cachedState.caches : createCacheGrid([latitudeStart, longitudeStart]);

    initializeMarkers();

    const inventoryDiv = document.createElement('div');
    inventoryDiv.id = 'inventory';
    appContainer.appendChild(inventoryDiv);

    const inventoryTitle = document.createElement('h3');
    inventoryTitle.id = 'inventory-title';
    inventoryDiv.appendChild(inventoryTitle);

    updateInventoryDisplay(inventory);
});