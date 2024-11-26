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

    this.playerMarker = leaflet.marker([0, 0]);
  }

  movePlayerMarker(lat: number, lng: number) {
    this.playerMarker.setLatLng(leaflet.latLng(lat, lng));
  }
}
