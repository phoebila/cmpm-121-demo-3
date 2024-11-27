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
  private readonly CACHE_SPAWN_PROBABILITY = 0.1;
  private readonly CACHE_RADIUS = 10; // Radius to control cache visibility

  private currentLat: number = 36.98949379578401;
  private currentLng: number = -122.06277128548504;

  private playerInventory: {
    id: string;
    collected: boolean;
    home: { i: number; j: number };
  }[] = [];
  private visibleCaches: Map<string, leaflet.Rectangle> = new Map(); // Track visible cache locations with their markers

  // Flyweight Factory to cache grid cells
  private static gridCellCache: Map<string, { i: number; j: number }> =
    new Map();

  private mementoManager: CacheMementoManager = new CacheMementoManager(); // Manager to handle cache mementos

  private isTrackingPosition: boolean = false; // Track if position tracking is enabled
  private geoLocationWatchId: number | null = null; // Store geolocation watch ID

  private movementHistory: leaflet.LatLng[] = []; // Track movement history as a list of LatLng
  private movementPolyline: leaflet.Polyline; // Leaflet Polyline to render movement history

  private isResetting: boolean = false;

  constructor(
    elementId: string,
    initialCenter: leaflet.LatLng,
    zoomLevel: number,
  ) {
    // Step 1: Default map center
    let mapCenter = initialCenter;

    // Step 2: Load the saved state and update mapCenter if a saved position exists
    const savedStateLoaded = this.loadGameState(); // Sets currentLat and currentLng
    if (savedStateLoaded) {
      mapCenter = leaflet.latLng(this.currentLat, this.currentLng); // Overwrite map center with saved position
    }

    // Initialize map
    this.map = leaflet.map(document.getElementById(elementId)!, {
      center: mapCenter, // Use restored position or fallback to initialCenter
      zoom: zoomLevel,
      minZoom: zoomLevel,
      maxZoom: zoomLevel,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    // Initialize player's movement polyline
    this.movementPolyline = leaflet.polyline(this.movementHistory, {
      color: "red", // Path color
      weight: 3, // Line thickness
      opacity: 0.7, // Transparency
    }).addTo(this.map);

    // Add tiles to the map
    leaflet
      .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
      .addTo(this.map);

    // Step 3: Initialize the player's marker
    this.playerMarker = leaflet.marker(mapCenter); // Align marker with restored map center
    this.playerMarker.bindTooltip("That's you!");
    this.playerMarker.addTo(this.map);

    // Step 4: Add event listener for the geolocation toggle
    const geoButton = document.getElementById("sensor")!;
    geoButton.addEventListener("click", () => this.toggleGeolocationTracking());

    // Step 4.5: Adding reset button
    const resetButton = document.getElementById("reset")!;
    resetButton.addEventListener("click", () => this.resetGameState());
    // Add confirmation before resetting
    resetButton.addEventListener("click", () => {
      const confirmed = confirm(
        "Are you sure you want to erase your game state? This action cannot be undone.",
      );
      if (confirmed) {
        this.resetGameState();
      } else {
        console.log("Game reset canceled by the user.");
      }
    });

    // Step 5: Add button listeners for player movement
    this.addButtonListeners();

    // Step 7: Explore the initial neighborhood
    this.exploreNeighborhood(this.CACHE_RADIUS);

    // Step 8: Periodically save game state
    setInterval(() => this.saveGameState(), 5000);
  }

  private resetGameState() {
    this.isResetting = true; // Disable cache spawning during the reset

    // Perform the reset steps
    this.playerInventory = [];
    this.mementoManager.reset();
    this.visibleCaches.forEach((cache) => cache.remove());
    this.visibleCaches.clear();
    this.movementHistory = [];
    if (this.movementPolyline) {
      this.movementPolyline.setLatLngs([]);
    }
    this.currentLat = 36.98949379578401;
    this.currentLng = -122.06277128548504;
    this.movePlayerMarker(this.currentLat, this.currentLng);
    localStorage.removeItem("gameState");

    this.isResetting = false; // Re-enable normal behavior post-reset
    console.log("Game state reset complete.");
  }

  // Save player state and cache states
  private saveGameState() {
    const gameState = {
      playerPosition: {
        lat: this.currentLat,
        lng: this.currentLng,
      },
      playerInventory: this.playerInventory,
      visibleCaches: Array.from(this.visibleCaches.entries()).map(
        ([key, rect]) => {
          // Save lat/lng of the rectangle bounds
          const bounds = rect.getBounds(); // Get the LatLngBounds instance

          return {
            cacheKey: key,
            bounds: {
              southWest: bounds.getSouthWest(), // Save SW corner (lat/lng)
              northEast: bounds.getNorthEast(), // Save NE corner (lat/lng)
            },
          };
        },
      ),
      movementHistory: this.movementHistory, // Add movement history here
    };

    localStorage.setItem("gameState", JSON.stringify(gameState));
    console.log("Game state saved:", gameState);
  }

  private restoreMovementHistory(
    gameState: { movementHistory: { lat: number; lng: number }[] },
  ) {
    this.movementHistory = (gameState.movementHistory || []).map(
      (point: { lat: number; lng: number }) =>
        leaflet.latLng(point.lat, point.lng),
    );

    if (this.movementPolyline) {
      this.movementPolyline.setLatLngs(this.movementHistory);
    }
  }

  // Load game state
  private loadGameState(): boolean {
    const savedState = localStorage.getItem("gameState");
    if (savedState) {
      const gameState = JSON.parse(savedState);

      // Validate gameState structure
      if (
        !gameState.playerPosition ||
        typeof gameState.playerPosition.lat !== "number" ||
        typeof gameState.playerPosition.lng !== "number"
      ) {
        console.error("Invalid game state! Using default values.");
        return false;
      }

      // Restore player position
      this.currentLat = gameState.playerPosition.lat;
      this.currentLng = gameState.playerPosition.lng;

      // Restore inventory
      this.playerInventory = gameState.playerInventory || [];

      // Restore movement history
      this.restoreMovementHistory(gameState);

      // Restore visible caches
      gameState.visibleCaches.forEach(
        (
          cache: {
            cacheKey: string;
            bounds: {
              southWest: { lat: number; lng: number };
              northEast: { lat: number; lng: number };
            };
          },
        ) => {
          if (
            cache.bounds && cache.bounds.southWest && cache.bounds.northEast
          ) {
            const bounds = leaflet.latLngBounds(
              leaflet.latLng(
                cache.bounds.southWest.lat,
                cache.bounds.southWest.lng,
              ),
              leaflet.latLng(
                cache.bounds.northEast.lat,
                cache.bounds.northEast.lng,
              ),
            );

            // Add rectangle to the map and track it
            const rect = leaflet.rectangle(bounds);
            this.visibleCaches.set(cache.cacheKey, rect); // Track in memory
          }
        },
      );

      console.log("Game state successfully loaded:", gameState);
      return true; // State restored successfully
    }

    console.log("No saved game state found, initializing with defaults.");
    return false; // No saved state
  }

  // Toggle geolocation tracking when 🌐 button is clicked
  private toggleGeolocationTracking() {
    if (this.isTrackingPosition) {
      // Stop geolocation tracking
      if (this.geoLocationWatchId !== null) {
        navigator.geolocation.clearWatch(this.geoLocationWatchId);
      }
      this.isTrackingPosition = false;
      console.log("Geolocation tracking stopped.");
    } else {
      // Start geolocation tracking
      this.geoLocationWatchId = navigator.geolocation.watchPosition(
        (position) => this.updatePosition(position),
        (error) => console.error("Geolocation error: ", error),
        { enableHighAccuracy: true, maximumAge: 1000 },
      );
      this.isTrackingPosition = true;
      console.log("Geolocation tracking started.");
    }
  }

  // Update position based on geolocation
  private updatePosition(position: GeolocationPosition) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    if (this.currentLat !== lat || this.currentLng !== lng) {
      this.currentLat = lat;
      this.currentLng = lng;

      // Add to movement history and update the polyline
      this.movementHistory.push(
        leaflet.latLng(this.currentLat, this.currentLng),
      );
      this.movementPolyline.setLatLngs(this.movementHistory);

      this.movePlayerMarker(lat, lng);
      this.updateCacheVisibility(); // Update caches based on new position
    }
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
  ): { id: string; collected: boolean; home: { i: number; j: number } }[] {
    const memento = this.mementoManager.restoreMemento(cacheKey);
    return memento
      ? memento.coins.map((coin) => ({
        ...coin,
        home: this.latLngToGrid(this.currentLat, this.currentLng),
      }))
      : []; // Return saved coins with home or an empty array if not found
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
    // Add the new position to the movement history
    this.movementHistory.push(leaflet.latLng(lat, lng));

    // Update the polyline with the new path
    this.movementPolyline.setLatLngs(this.movementHistory);

    // Set the player's marker position
    this.playerMarker.setLatLng(leaflet.latLng(lat, lng));
    this.map.panTo(leaflet.latLng(lat, lng)); // Optionally pan to the new position
    this.updateCacheVisibility(); // Update the cache visibility on move

    // Save the state after moving the player
    this.saveGameState();
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
    this.saveGameState(); // Automatic save after movement
  }

  private centerMapOnCache(i: number, j: number) {
    const { lat, lng } = this.gridToLatLng(i, j); // Convert grid cell to coordinates
    this.map.setView(leaflet.latLng(lat, lng), this.map.getZoom()); // Center the map at the location
    console.log(`Centered map on cache at (${i}, ${j})`);
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
      length: Math.floor(luck([i, j, "coinCount"].toString()) * 3) + 1,
    }, (_, k) => ({
      id: `${i}:${j}#${k}`,
      collected: false,
      home: { i, j }, // Track coin's home cache
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

        const coinName = document.createElement("span");
        coinName.textContent = `Coin ${coin.id}`;
        coinName.style.cursor = "pointer";
        coinName.style.color = "blue";
        coinName.style.textDecoration = "underline";

        // Add event listener to pan map to the cache location
        coinName.addEventListener("click", () => {
          const { i, j } = coin.home; // Get the coin's home location
          this.centerMapOnCache(i, j);
        });

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
            this.playerInventory.push({ ...coin, home: { i, j } });
            this.saveGameState();
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
            this.saveGameState();
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
    if (this.isResetting) return; // Skip cache updates if resetting
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
