// CacheMementoManager.ts
import { CacheMemento } from "./CacheMemento.ts";

export class CacheMementoManager {
  private cacheMementos: Map<string, CacheMemento> = new Map();

  // Save the state of a cache
  saveMemento(cacheKey: string, memento: CacheMemento) {
    this.cacheMementos.set(cacheKey, memento);
  }

  // Restore the state of a cache
  restoreMemento(cacheKey: string): CacheMemento | undefined {
    return this.cacheMementos.get(cacheKey);
  }

  // Add this to CacheMementoManager
  reset() {
    this.cacheMementos.clear(); // Clear all cached mementos
  }
}
