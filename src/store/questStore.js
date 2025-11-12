import { create } from 'zustand'

export const useQuestStore = create((set, get) => ({
  discoveredDapps: [],
  activeDapp: null,
  dappPlacements: {},
  playerPosition: { x: 0, z: 0 },
  playerSpeed: 0,
  quests: {
    collectDeFi: { target: 5, progress: 0, completed: false },
    distance: { target: 500, progress: 0, completed: false },
  },
  unlockedCosmetics: [],

  collectDapp: (dappId, category) =>
    set((state) => {
      if (state.discoveredDapps.includes(dappId)) return state

      const discoveredDapps = [...state.discoveredDapps, dappId]
      const quests = { ...state.quests }

      if (category === 'DeFi') {
        const current = quests.collectDeFi ?? { target: 5, progress: 0, completed: false }
        const progress = current.progress + 1
        quests.collectDeFi = {
          ...current,
          progress,
          completed: progress >= current.target,
        }
      }

      return {
        discoveredDapps,
        quests,
        activeDapp: dappId,
      }
    }),

  closeActiveDapp: () =>
    set({
      activeDapp: null,
    }),

  setDappPlacements: (placements) =>
    set({
      dappPlacements: placements,
    }),

  setPlayerPosition: (position) =>
    set({
      playerPosition: position,
    }),

  setPlayerSpeed: (speed) =>
    set({
      playerSpeed: speed,
    }),

  addDistance: (distance) =>
    set((state) => {
      const quests = { ...state.quests }
      const current = quests.distance ?? { target: 500, progress: 0, completed: false }
      const progress = current.progress + distance
      quests.distance = {
        ...current,
        progress,
        completed: progress >= current.target,
      }
      return { quests }
    }),

  unlockCosmetic: (cosmeticId) =>
    set((state) => {
      if (state.unlockedCosmetics.includes(cosmeticId)) return state
      return {
        unlockedCosmetics: [...state.unlockedCosmetics, cosmeticId],
      }
    }),

  resetProgress: () =>
    set({
      discoveredDapps: [],
      activeDapp: null,
      dappPlacements: {},
      playerPosition: { x: 0, z: 0 },
      playerSpeed: 0,
      quests: {
        collectDeFi: { target: 5, progress: 0, completed: false },
        distance: { target: 500, progress: 0, completed: false },
      },
      unlockedCosmetics: [],
    }),
}))

