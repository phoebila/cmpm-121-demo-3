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

    // Generate deterministic cache point value
    let pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);

    // Generate a deterministic number of coins for this cache
    const numCoins = Math.floor(luck([i, j, "coinCount"].toString()) * 5) + 1;

    // Create an array to track collected coins
    const collectedCoins: boolean[] = Array(numCoins).fill(false);

    // Bind a popup with cache details
    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");

      // Cache description
      popupDiv.innerHTML = `
        <div>There is a cache here at "${i},${j}".</div>
        <div>Value: <span id="value">${pointValue}</span></div>
        <div>Coins available:</div>
        <div id="coin-list"></div>
        <button id="poke">Poke Cache</button>
      `;

      const coinListDiv = popupDiv.querySelector<HTMLDivElement>("#coin-list")!;

      // Add coins to the popup
      for (let k = 0; k < numCoins; k++) {
        const coinButton = document.createElement("button");
        coinButton.textContent = `Coin ${k + 1}`;
        coinButton.disabled = collectedCoins[k]; // Disable if already collected
        coinButton.addEventListener("click", () => {
          if (!collectedCoins[k]) {
            collectedCoins[k] = true;
            coinButton.disabled = true;

            // Increment player's points
            this.playerPoints += 1;

            alert(
              `You collected Coin ${k + 1}! Total Points: ${this.playerPoints}`,
            );
          }
        });

        coinListDiv.appendChild(coinButton);
      }

      // "Poke Cache" functionality
      popupDiv
        .querySelector<HTMLButtonElement>("#poke")!
        .addEventListener("click", () => {
          if (pointValue > 0) {
            pointValue--;
            popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
              pointValue.toString();
          }
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
