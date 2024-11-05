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

    let markers: L.Marker[] = [];

    const resetState = () => {
        inventory = {};
        caches = createCacheGrid([latitudeStart, longitudeStart]);
        clearMarkers();
        initializeMarkers();
        saveGameState(inventory, caches);
        updateInventoryDisplay();
        console.log('State has been reset');
    };

    controlPanel.appendChild(createButton('reset-state', 'Reset State', resetState));

    // Map Setup
    const latitudeStart = 36.9895;
    const longitudeStart = -122.0628;
    const cellSize = 0.0001;
    const gridSteps = 8;
    const cacheProbability = 0.1;

    const mapElement = document.createElement('div');
    mapElement.id = 'map';
    mapElement.style.height = '400px';
    mapElement.style.width = '100%';
    appContainer.appendChild(mapElement);

    const map = L.map(mapElement).setView([latitudeStart, longitudeStart], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
    }

    interface Cache {
        lat: number;
        lng: number;
        coins: Coin[];
    }

    const coinTypes = ['Copper', 'Silver', 'Gold'];

    const generateCoins = (): Coin[] => {
        return coinTypes.map(coinType => ({
            type: coinType,
            count: Math.floor(randomGen.next() * 9) + 1
        }));
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

    const playerIcon = L.icon({
        iconUrl: 'https://example.com/path-to-player-icon.png',
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

    const initializeMarkers = () => {
        const playerMarker = L.marker([latitudeStart, longitudeStart], { icon: playerIcon }).addTo(map)
            .bindTooltip('Player Location', { permanent: true, direction: 'top' });
        
        markers.push(playerMarker);

        caches.forEach((cache, index) => {
            const marker = L.marker([cache.lat, cache.lng]).addTo(map);
            markers.push(marker);

            const updatePopup = () => {
                const coinDescriptions = cache.coins.map(coin => `${coin.type}: ${coin.count}`).join('<br>');
                let popupContent = `Cache location:<br>${coinDescriptions ? coinDescriptions : '0 coins'}<br>`;
                if (cache.coins.length > 0) {
                    popupContent += `<button id="collect-btn-${index}">Collect Coins</button>`;
                }
                popupContent += `<button id="deposit-btn-${index}">Deposit Coins</button>`;
                marker.bindPopup(popupContent);
            };

            const collectCoins = () => {
                cache.coins.forEach(coin => {
                    inventory[coin.type] = (inventory[coin.type] || 0) + coin.count;
                });
                cache.coins = [];
                updateInventoryDisplay();
                updatePopup();
                saveGameState(inventory, caches);
            };

            const depositCoins = () => {
                coinTypes.forEach(coinType => {
                    const inventoryCount = inventory[coinType] || 0;
                    if (inventoryCount > 0) {
                        let cacheCoin = cache.coins.find(coin => coin.type === coinType);
                        if (!cacheCoin) {
                            cacheCoin = { type: coinType, count: 0 };
                            cache.coins.push(cacheCoin);
                        }
                        cacheCoin.count += inventoryCount;
                        inventory[coinType] = 0;
                    }
                });
                updateInventoryDisplay();
                updatePopup();
                saveGameState(inventory, caches);
            };

            updatePopup();

            map.on("popupopen", () => {
                document.getElementById(`collect-btn-${index}`)?.addEventListener('click', collectCoins);
                document.getElementById(`deposit-btn-${index}`)?.addEventListener('click', depositCoins);
            });
        });
    };

    const saveGameState = (inventory: { [key: string]: number }, caches: Cache[]) => {
        localStorage.setItem('geocoinGameState', JSON.stringify({ inventory, caches }));
    };

    const loadGameState = (): { inventory: { [key: string]: number }, caches: Cache[] } | null => {
        const stateJSON = localStorage.getItem('geocoinGameState');
        return stateJSON ? JSON.parse(stateJSON) : null;
    };

    const cachedState = loadGameState();
    if (cachedState) {
        coinTypes.forEach(coinType => {
            inventory[coinType] = cachedState.inventory[coinType] || 0;
        });
        caches = cachedState.caches;
    }

    initializeMarkers();

    const inventoryDiv = document.createElement('div');
    inventoryDiv.id = 'inventory';
    appContainer.appendChild(inventoryDiv);

    const inventoryTitle = document.createElement('h3');
    inventoryTitle.id = 'inventory-title';
    inventoryDiv.appendChild(inventoryTitle);

    updateInventoryDisplay();
});