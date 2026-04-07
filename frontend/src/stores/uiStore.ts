import { create } from 'zustand';

type UiState = {
  largeText: boolean;
  simpleMode: boolean;
  setLargeText: (value: boolean) => void;
  setSimpleMode: (value: boolean) => void;
  toggleLargeText: () => void;
  toggleSimpleMode: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  largeText: false,
  simpleMode: false,
  setLargeText: (value) => set({ largeText: value }),
  setSimpleMode: (value) => set({ simpleMode: value }),
  toggleLargeText: () => set((state) => ({ largeText: !state.largeText })),
  toggleSimpleMode: () => set((state) => ({ simpleMode: !state.simpleMode })),
}));
