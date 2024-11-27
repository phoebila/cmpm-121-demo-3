/*
The MapService class here is intended to handle all of the Leaflet dependencies for our game.
It doesn't store any game state; it just knows about player markers and other markers that can be clicked on.
*/

// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

export class MapService {
  playerMarker: leaflet.Marker;
  map: leaflet.Map;
  constructor(elementId: string) {
    this.map = leaflet.map(document.getElementById(elementId)!, {
      zoom: 13,
      minZoom: 10,
      maxZoom: 13,
      zoomControl: false,
      scrollWheelZoom: false,
    });

    this.map.setView([36.98949379578401, -122.06277128548504], 13);

    // add map tiles
    this.populateTiles();

    this.playerMarker = leaflet.marker([0, 0]);
    this.playerMarker.bindTooltip("That's you!");
    this.playerMarker.addTo(this.map);
  }

  movePlayerMarker(lat: number, lng: number) {
    this.playerMarker.setLatLng(leaflet.latLng(lat, lng));
  }

  populateTiles() {
    leaflet
      .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
      .addTo(this.map);
  }
}
