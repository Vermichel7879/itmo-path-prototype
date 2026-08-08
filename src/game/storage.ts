import { createInitialState, gameSteps, type GameState } from "./reducer";

export const STORAGE_KEY = "itmo-path-prototype-state";

export function loadState(storage: Pick<Storage, "getItem"> = localStorage): GameState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (parsed.schemaVersion !== 1 || !parsed.currentStep || !gameSteps.includes(parsed.currentStep)) {
      return createInitialState();
    }
    return { ...createInitialState(), ...parsed } as GameState;
  } catch (error) {
    console.warn("Не удалось восстановить тестовую сессию", error);
    return createInitialState();
  }
}

export function saveState(state: GameState, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Не удалось сохранить тестовую сессию", error);
  }
}

export function clearState(storage: Pick<Storage, "removeItem"> = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}
