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
  private readonly CACHE_SPAWN_PROBABILITY = 0.01;
  private readonly CACHE_RADIUS = 10; // Radius to control cache visibility

  private currentLat: number;
  private currentLng: number;

  private playerInventory: { id: string; collected: boolean }[] = [];
  private visibleCaches: Map<string, leaflet.Rectangle> = new Map(); // Track visible cache locations with their markers

  // Flyweight Factory to cache grid cells
  private static gridCellCache: Map<string, { i: number; j: number }> =
    new Map();

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
    this.currentLat = initialCenter.lat;
    this.currentLng = initialCenter.lng;
    this.playerMarker = leaflet.marker(initialCenter);
    this.playerMarker.bindTooltip("That's you!");
    this.playerMarker.addTo(this.map);

    // Add event listeners for directional movement buttons
    this.addButtonListeners();

    // Explore the neighborhood when initialized
    this.exploreNeighborhood(this.CACHE_RADIUS);
  }

  // Flyweight Factory for creating or reusing grid cells
  private static getGridCell(i: number, j: number): { i: number; j: number } {
    const key = `${i},${j}`;
    if (!MapService.gridCellCache.has(key)) {
      MapService.gridCellCache.set(key, { i, j });
    }
    return MapService.gridCellCache.get(key)!;
  }

  // Convert latitude and longitude to grid cell indices {i, j}
  private latLngToGrid(lat: number, lng: number): { i: number; j: number } {
    const i = Math.floor(lat / this.TILE_DEGREES);
    const j = Math.floor(lng / this.TILE_DEGREES);
    return MapService.getGridCell(i, j); // Return shared grid cell instance
  }

  // Convert grid cell indices {i, j} to latitude and longitude
  private gridToLatLng(i: number, j: number): { lat: number; lng: number } {
    const lat = i * this.TILE_DEGREES;
    const lng = j * this.TILE_DEGREES;
    return { lat, lng };
  }

  // Move the player marker
  movePlayerMarker(lat: number, lng: number) {
    this.playerMarker.setLatLng(leaflet.latLng(lat, lng));
    this.map.panTo(leaflet.latLng(lat, lng)); // Optionally pan to the new position
    this.updateCacheVisibility(); // Update the cache visibility on move
  }

  // Add event listeners for movement buttons
  private addButtonListeners() {
    // Get references to the directional buttons
    const northButton = document.getElementById("north")!;
    const southButton = document.getElementById("south")!;
    const westButton = document.getElementById("west")!;
    const eastButton = document.getElementById("east")!;

    // Add click event listeners
    northButton.addEventListener("click", () => this.movePlayer("north"));
    southButton.addEventListener("click", () => this.movePlayer("south"));
    westButton.addEventListener("click", () => this.movePlayer("west"));
    eastButton.addEventListener("click", () => this.movePlayer("east"));
  }

  // Move the player based on direction
  private movePlayer(direction: string) {
    switch (direction) {
      case "north":
        this.currentLat += this.TILE_DEGREES; // Move north (increase latitude)
        break;
      case "south":
        this.currentLat -= this.TILE_DEGREES; // Move south (decrease latitude)
        break;
      case "west":
        this.currentLng -= this.TILE_DEGREES; // Move west (decrease longitude)
        break;
      case "east":
        this.currentLng += this.TILE_DEGREES; // Move east (increase longitude)
        break;
    }

    // Update the player marker's position
    this.movePlayerMarker(this.currentLat, this.currentLng);
  }

  // Spawn a cache at specific cell coordinates
  private spawnCache(i: number, j: number) {
    const { lat, lng } = this.gridToLatLng(i, j);
    const bounds = leaflet.latLngBounds([
      [lat, lng],
      [lat + this.TILE_DEGREES, lng + this.TILE_DEGREES],
    ]);

    const cacheKey = `${i}:${j}`;

    if (this.visibleCaches.has(cacheKey)) return; // Prevent duplicate caches

    const rect = leaflet.rectangle(bounds);
    rect.addTo(this.map);

    // Generate a deterministic number of coins for this cache
    const numCoins = Math.floor(luck([i, j, "coinCount"].toString()) * 5) + 1;

    // Cache to track coins with unique identities
    const cacheCoins: { id: string; collected: boolean }[] = Array.from(
      { length: numCoins },
      (_, k) => ({
        id: `${i}:${j}#${k}`, // Format as i:j#serial
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
        depositButton.disabled = !coin.collected &&
          !this.playerInventory.some((c) => c.id === coin.id);

        // Collect Coin
        collectButton.addEventListener("click", () => {
          if (!coin.collected) {
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
    this.visibleCaches.set(cacheKey, rect); // Store the cache reference
  }

  // Update cache visibility and spawn caches in the neighborhood
  private updateCacheVisibility() {
    const playerLatLng = this.playerMarker.getLatLng();
    const { i: playerI, j: playerJ } = this.latLngToGrid(
      playerLatLng.lat,
      playerLatLng.lng,
    );

    // Remove old caches that are too far away
    const keysToRemove: string[] = [];
    this.visibleCaches.forEach((cache, key) => {
      const [i, j] = key.split(":").map(Number);
      const distance = Math.abs(i - playerI) + Math.abs(j - playerJ);
      if (distance > this.CACHE_RADIUS) {
        cache.remove(); // Remove the cache from the map
        keysToRemove.push(key); // Mark it for removal
      }
    });

    // Remove old caches from the visibleCaches map
    keysToRemove.forEach((key) => this.visibleCaches.delete(key));

    // Explore new caches around the player if within spawn probability
    for (
      let i = playerI - this.CACHE_RADIUS;
      i <= playerI + this.CACHE_RADIUS;
      i++
    ) {
      for (
        let j = playerJ - this.CACHE_RADIUS;
        j <= playerJ + this.CACHE_RADIUS;
        j++
      ) {
        if (Math.random() < this.CACHE_SPAWN_PROBABILITY) {
          this.spawnCache(i, j); // Spawn cache at new position
        }
      }
    }
  }

  // Explore the neighborhood for spawning caches
  exploreNeighborhood(size: number) {
    const playerLatLng = this.playerMarker.getLatLng();
    const { i: playerI, j: playerJ } = this.latLngToGrid(
      playerLatLng.lat,
      playerLatLng.lng,
    );

    for (let di = -size; di <= size; di++) {
      for (let dj = -size; dj <= size; dj++) {
        const i = playerI + di;
        const j = playerJ + dj;

        // Only spawn cache if a random number is less than the cache spawn probability
        if (Math.random() < this.CACHE_SPAWN_PROBABILITY) {
          this.spawnCache(i, j);
        }
      }
    }
  }
}
