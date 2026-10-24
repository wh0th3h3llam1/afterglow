import { openDatabase } from "./db";
import { createStore } from "./store";

const globalForStore = globalThis as typeof globalThis & { afterglowStore?: ReturnType<typeof createStore> };

export function getStore() {
  if (!globalForStore.afterglowStore) {
    const opened = openDatabase();
    globalForStore.afterglowStore = createStore(opened.db);
  }
  return globalForStore.afterglowStore;
}
