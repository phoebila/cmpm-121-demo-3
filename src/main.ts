// todo

// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

import { MapService } from "./mapService.ts";

const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

const map = new MapService("map", OAKES_CLASSROOM, 19);
map.movePlayerMarker(36.98949379578401, -122.06277128548504);
map.exploreNeighborhood(8); // Explore a 16x16 grid around the player
