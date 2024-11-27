// todo

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

import { MapService } from "./mapService.ts";

const map = new MapService("map");
map.movePlayerMarker(36.98949379578401, -122.06277128548504);
