// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css"; // Leaflet styles
import "./style.css"; // Your custom styles
import "./leafletWorkaround.ts"; // Fix for missing marker images
import luck from "./luck.ts"; // Deterministic RNG

export class MapService {
  private map: leaflet.Map;
  private playerMarker: leaflet.Marker;
  private playerPoints: number = 0;

  private readonly TILE_DEGREES = 1e-4;
  private readonly CACHE_SPAWN_PROBABILITY = 0.1;

  private playerInventory: { id: string; collected: boolean }[] = [];

  constructor(
    elementId: string,
    initialCenter: leaflet.LatLng,
    zoomLevel: number,
  ) {
    // Initialize map
    this.map = leaflet.map(document.getElementById(elementId)!, {
      center: initialCenter,
      zoom: zoomLevel,
      minZoom: zoomLevel,
      maxZoom: zoomLevel,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    // Add tiles
    leaflet
      .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
      .addTo(this.map);

    // Initialize player marker
    this.playerMarker = leaflet.marker(initialCenter);
    this.playerMarker.bindTooltip("That's you!");
    this.playerMarker.addTo(this.map);
  }

  // Move the player marker
  movePlayerMarker(lat: number, lng: number) {
    this.playerMarker.setLatLng(leaflet.latLng(lat, lng));
  }

  // Spawn a cache at specific cell coordinates
  private spawnCache(i: number, j: number) {
    const bounds = leaflet.latLngBounds([
      [
        this.playerMarker.getLatLng().lat + i * this.TILE_DEGREES,
        this.playerMarker.getLatLng().lng + j * this.TILE_DEGREES,
      ],
      [
        this.playerMarker.getLatLng().lat + (i + 1) * this.TILE_DEGREES,
        this.playerMarker.getLatLng().lng + (j + 1) * this.TILE_DEGREES,
      ],
    ]);

    const rect = leaflet.rectangle(bounds);
    rect.addTo(this.map);

    // Generate a deterministic number of coins for this cache
    const numCoins = Math.floor(luck([i, j, "coinCount"].toString()) * 5) + 1;

    // Cache to track coins
    const cacheCoins: { id: string; collected: boolean }[] = Array.from(
      { length: numCoins },
      (_, k) => ({
        id: `${i},${j},${k}`, // Unique identifier for each coin
        collected: false,
      }),
    );

    // Bind a popup with cache details
    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");

      // Cache description
      popupDiv.innerHTML = `
        <div>Cache at "${i},${j}".</div>
        <div>Coins available:</div>
        <div id="coin-list"></div>
        <div>
          Player Inventory: <span id="inventory">${this.playerInventory.length}</span>
        </div>
      `;

      const coinListDiv = popupDiv.querySelector<HTMLDivElement>("#coin-list")!;

      // Add coins to the popup
      cacheCoins.forEach((coin) => {
        const coinDiv = document.createElement("div");
        coinDiv.textContent = `Coin ${coin.id}`;
        const collectButton = document.createElement("button");
        collectButton.textContent = "Collect";
        const depositButton = document.createElement("button");
        depositButton.textContent = "Deposit";

        // Disable buttons as appropriate
        collectButton.disabled = coin.collected ||
          this.playerInventory.length >= 5; // Limit inventory to 5
        depositButton.disabled = !coin.collected &&
          !this.playerInventory.some((c) => c.id === coin.id);

        // Collect Coin
        collectButton.addEventListener("click", () => {
          if (!coin.collected && this.playerInventory.length < 5) {
            coin.collected = true;
            this.playerInventory.push(coin);
            collectButton.disabled = true;
            depositButton.disabled = false;

            // Update inventory count
            popupDiv.querySelector<HTMLSpanElement>("#inventory")!.textContent =
              this.playerInventory.length.toString();
          }
        });

        // Deposit Coin
        depositButton.addEventListener("click", () => {
          const coinIndex = this.playerInventory.findIndex((c) =>
            c.id === coin.id
          );
          if (coinIndex !== -1) {
            this.playerInventory.splice(coinIndex, 1); // Remove coin from inventory
            coin.collected = false;
            collectButton.disabled = false;
            depositButton.disabled = true;

            // Update inventory count
            popupDiv.querySelector<HTMLSpanElement>("#inventory")!.textContent =
              this.playerInventory.length.toString();
          }
        });

        coinDiv.appendChild(collectButton);
        coinDiv.appendChild(depositButton);
        coinListDiv.appendChild(coinDiv);
      });

      return popupDiv;
    });
  }

  // Explore the neighborhood for spawning caches
  exploreNeighborhood(size: number) {
    for (let i = -size; i < size; i++) {
      for (let j = -size; j < size; j++) {
        if (luck([i, j].toString()) < this.CACHE_SPAWN_PROBABILITY) {
          this.spawnCache(i, j);
        }
      }
    }
  }
}
