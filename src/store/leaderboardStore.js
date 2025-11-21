import { create } from 'zustand'
import { supabase } from '../utils/supabase'

export const useLeaderboardStore = create((set, get) => ({
  entries: [],
  loading: false,
  error: null,

  // Fetch leaderboard from Supabase
  fetchLeaderboard: async (limit = 10) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(limit)

      if (error) throw error

      // Transform data to match expected format
      const entries = (data || []).map((entry) => ({
        address: entry.address,
        score: entry.score || 0,
        badges: entry.badges || 0,
        timestamp: entry.created_at ? new Date(entry.created_at).getTime() : Date.now(),
        updatedAt: entry.updated_at ? new Date(entry.updated_at).getTime() : Date.now(),
      }))

      set({ entries, loading: false })
      return entries
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      set({ error: error.message, loading: false })
      return []
    }
  },

  // Add or update leaderboard entry in Supabase
  updateEntry: async (address, score, badges = 0) => {
    if (!address) return

    try {
      // Check if entry exists
      const { data: existing } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('address', address.toLowerCase())
        .single()

      if (existing) {
        // Update if score is higher
        if (score > existing.score) {
          const { error } = await supabase
            .from('leaderboard')
            .update({
              score,
              badges,
              updated_at: new Date().toISOString(),
            })
            .eq('address', address.toLowerCase())

          if (error) throw error
        }
      } else {
        // Insert new entry
        const { error } = await supabase.from('leaderboard').insert({
          address: address.toLowerCase(),
          score,
          badges,
        })

        if (error) throw error
      }

      // Refresh leaderboard
      get().fetchLeaderboard(100)
    } catch (error) {
      console.error('Error updating leaderboard entry:', error)
      set({ error: error.message })
    }
  },

  // Get leaderboard (top N) - from local state
  getLeaderboard: (limit = 10) => {
    const { entries } = get()
    return entries.slice(0, limit)
  },

  // Get user's rank from Supabase
  getUserRank: async (address) => {
    if (!address) return null

    try {
      // Get user's score
      const { data: userEntry, error: userError } = await supabase
        .from('leaderboard')
        .select('score')
        .eq('address', address.toLowerCase())
        .single()

      if (userError && userError.code !== 'PGRST116') throw userError // PGRST116 = no rows returned
      if (!userEntry) return null

      // Count how many have higher score (this is the rank - 1)
      const { count, error } = await supabase
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .gt('score', userEntry.score)

      if (error) throw error

      // Rank = number of people with higher score + 1
      return (count || 0) + 1
    } catch (error) {
      console.error('Error getting user rank:', error)
      return null
    }
  },

  // Get user's entry from Supabase
  getUserEntry: async (address) => {
    if (!address) return null

    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('address', address.toLowerCase())
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
      if (!data) return null

      return {
        address: data.address,
        score: data.score || 0,
        badges: data.badges || 0,
        timestamp: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
        updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
      }
    } catch (error) {
      console.error('Error getting user entry:', error)
      return null
    }
  },
}))

