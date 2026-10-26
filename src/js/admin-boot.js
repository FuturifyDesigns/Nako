import { registerServiceWorker } from "./install.js";
import { mountAdmin } from "./admin.js";

registerServiceWorker("../sw.js");
mountAdmin(document.querySelector("#admin"));
