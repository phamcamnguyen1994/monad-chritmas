import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useQuestStore = create(
  persist(
    (set, get) => ({
      discoveredDapps: [],
      activeDapp: null,
      dappPlacements: {},
      playerPosition: { x: 0, z: 0 },
      playerSpeed: 0,
      score: 0, // Total score
      quests: {
        collectDeFi: { target: 5, progress: 0, completed: false },
        distance: { target: 500, progress: 0, completed: false },
        discoverMonad: { target: 1, progress: 0, completed: false },
      },
      monadDiscovered: false,
      unlockedCosmetics: [],

  // [NEW] Delivery Mission State
  deliveryMission: {
    active: false,
    targetId: null,
    sourceId: null,
    startTime: 0,
    deadline: 0,
  },

  // [NEW] Active Power-ups (expiry timestamps)
  activeBuffs: {
    speed: 0,
    jump: 0,
    shield: 0,
  },

  // [NEW] Nearby dApp for interaction
  nearbyDapp: null, // { id: string, distance: number }

  collectDapp: (dappId, category) =>
    set((state) => {
      if (state.discoveredDapps.includes(dappId)) return state

      const discoveredDapps = [...state.discoveredDapps, dappId]
      const quests = { ...state.quests }
      let scoreIncrease = 10 // Base points for collecting a dApp

      if (category === 'DeFi') {
        const current = quests.collectDeFi ?? { target: 5, progress: 0, completed: false }
        const progress = current.progress + 1
        const wasCompleted = current.completed
        quests.collectDeFi = {
          ...current,
          progress,
          completed: progress >= current.target,
        }
        // Bonus points if quest completed
        if (!wasCompleted && quests.collectDeFi.completed) {
          scoreIncrease += 50
        }
      }

      return {
        discoveredDapps,
        quests,
        activeDapp: dappId,
        score: state.score + scoreIncrease,
      }
    }),

  // Add score points
  addScore: (points) =>
    set((state) => ({
      score: state.score + points,
    })),

  activateDapp: (dappId) =>
    set({
      activeDapp: dappId,
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
      score: 0,
      quests: {
        collectDeFi: { target: 5, progress: 0, completed: false },
        distance: { target: 500, progress: 0, completed: false },
        discoverMonad: { target: 1, progress: 0, completed: false },
      },
      monadDiscovered: false,
      unlockedCosmetics: [],
      deliveryMission: { active: false, targetId: null, sourceId: null, startTime: 0, deadline: 0 },
      activeBuffs: { speed: 0, jump: 0, shield: 0 },
    }),

  // [NEW] Delivery Actions
  startDelivery: (sourceId, targetId, durationSeconds) =>
    set({
      deliveryMission: {
        active: true,
        sourceId,
        targetId,
        startTime: Date.now(),
        deadline: Date.now() + durationSeconds * 1000,
      },
    }),

  completeDelivery: () =>
    set((state) => {
      if (!state.deliveryMission.active) return {}
      // Reward 100 points for completing delivery
      return {
        deliveryMission: { active: false, targetId: null, sourceId: null, startTime: 0, deadline: 0 },
        score: state.score + 100,
      }
    }),

  failDelivery: () =>
    set({
      deliveryMission: { active: false, targetId: null, sourceId: null, startTime: 0, deadline: 0 },
    }),

  // [NEW] Buff Actions
  activateBuff: (type, durationSeconds) =>
    set((state) => ({
      activeBuffs: {
        ...state.activeBuffs,
        [type]: Date.now() + durationSeconds * 1000,
      },
    })),

  setNearbyDapp: (dappInfo) => set({ nearbyDapp: dappInfo }),

  // Monad Quest: Discover the Monad Landmark
  discoverMonad: () =>
    set((state) => {
      if (state.monadDiscovered) return state
      const quests = { ...state.quests }
      const current = quests.discoverMonad ?? { target: 1, progress: 0, completed: false }
      const wasCompleted = current.completed
      quests.discoverMonad = {
        ...current,
        progress: 1,
        completed: true,
      }
      // Big bonus for discovering Monad!
      const scoreIncrease = wasCompleted ? 0 : 200
      return {
        monadDiscovered: true,
        quests,
        score: state.score + scoreIncrease,
      }
    }),
    }),
    {
      name: 'quest-storage',
      partialize: (state) => ({
        discoveredDapps: state.discoveredDapps,
        score: state.score,
        quests: state.quests,
        unlockedCosmetics: state.unlockedCosmetics,
      }),
    }
  )
)

