// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css"; // Leaflet styles
import "./style.css"; // Your custom styles
import "./leafletWorkaround.ts"; // Fix for missing marker images
import luck from "./luck.ts"; // Deterministic RNG

import { CacheMemento } from "./CacheMemento.ts";
import { CacheMementoManager } from "./CacheMementoManager.ts";

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

  private mementoManager: CacheMementoManager = new CacheMementoManager(); // Manager to handle cache mementos

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

  // Method to save cache state
  private saveCacheState(
    cacheKey: string,
    coins: { id: string; collected: boolean }[],
  ) {
    const memento = new CacheMemento(cacheKey, coins);
    this.mementoManager.saveMemento(cacheKey, memento); // Store the memento
  }

  // Method to restore cache state
  private restoreCacheState(
    cacheKey: string,
  ): { id: string; collected: boolean }[] {
    const memento = this.mementoManager.restoreMemento(cacheKey);
    return memento ? memento.coins : []; // Return saved coins or an empty array if not found
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
  // Updated spawnCache method
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

    // Try to restore the cache's state (coins collected)
    const restoredCoins = this.restoreCacheState(cacheKey);

    // If no restored state, generate new coins
    const cacheCoins = restoredCoins.length ? restoredCoins : Array.from({
      length: Math.floor(luck([i, j, "coinCount"].toString()) * 5) + 1,
    }, (_, k) => ({
      id: `${i}:${j}#${k}`,
      collected: false,
    }));

    // Save this cache's state
    this.saveCacheState(cacheKey, cacheCoins);

    // Bind a popup with cache details
    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");

      popupDiv.innerHTML = `
      <div>Cache at "${i},${j}".</div>
      <div>Coins available:</div>
      <div id="coin-list"></div>
      <div>
        Player Inventory: <span id="inventory">${this.playerInventory.length}</span>
      </div>
    `;

      const coinListDiv = popupDiv.querySelector<HTMLDivElement>("#coin-list")!;

      cacheCoins.forEach((coin) => {
        const coinDiv = document.createElement("div");
        coinDiv.textContent = `Coin ${coin.id}`;
        const collectButton = document.createElement("button");
        collectButton.textContent = "Collect";
        const depositButton = document.createElement("button");
        depositButton.textContent = "Deposit";

        // If the coin is collected, disable the collect button and enable deposit
        depositButton.disabled = !coin.collected &&
          !this.playerInventory.some((c) => c.id === coin.id);
        collectButton.disabled = coin.collected;

        collectButton.addEventListener("click", () => {
          if (!coin.collected) {
            coin.collected = true;
            this.playerInventory.push(coin);
            collectButton.disabled = true;
            depositButton.disabled = false;
            popupDiv.querySelector<HTMLSpanElement>("#inventory")!.textContent =
              this.playerInventory.length.toString();
          }
        });

        depositButton.addEventListener("click", () => {
          const coinIndex = this.playerInventory.findIndex((c) =>
            c.id === coin.id
          );
          if (coinIndex !== -1) {
            this.playerInventory.splice(coinIndex, 1);
            coin.collected = false;
            collectButton.disabled = false;
            depositButton.disabled = true;
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

    this.visibleCaches.set(cacheKey, rect);
  }

  // Update cache visibility and spawn caches in the neighborhood
  private updateCacheVisibility() {
    const playerLatLng = this.playerMarker.getLatLng();
    const { i: playerI, j: playerJ } = this.latLngToGrid(
      playerLatLng.lat,
      playerLatLng.lng,
    );

    // Remove old caches too far away but preserve their state in the memento manager
    const keysToRemove: string[] = [];
    this.visibleCaches.forEach((cache, key) => {
      const [i, j] = key.split(":").map(Number);
      const distance = Math.abs(i - playerI) + Math.abs(j - playerJ);
      if (distance > this.CACHE_RADIUS) {
        cache.remove(); // Remove visually from the map
        keysToRemove.push(key);
      }
    });

    // Clean up the visible cache map after removal
    keysToRemove.forEach((key) => this.visibleCaches.delete(key));

    // Re-spawn caches in the neighborhood
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
        // Check if cache already exists in memory (memento manager) before spawning
        const cacheKey = `${i}:${j}`;
        if (
          !this.visibleCaches.has(cacheKey) &&
          luck([i, j].toString()) < this.CACHE_SPAWN_PROBABILITY
        ) {
          this.spawnCache(i, j); // Spawn new cache if probability meets
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
        if (luck([i, j].toString()) < this.CACHE_SPAWN_PROBABILITY) {
          this.spawnCache(i, j);
        }
      }
    }
  }
}
