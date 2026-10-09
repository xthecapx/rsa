import { JSDOM } from "jsdom";

// Use browser storage, even when Node exposes its own
// experimental localStorage property without a configured backing file.
const browser = new JSDOM("", { url: "http://localhost" }).window;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: browser.localStorage,
});
Object.defineProperty(globalThis, "Storage", {
  configurable: true,
  writable: true,
  value: browser.Storage,
});
