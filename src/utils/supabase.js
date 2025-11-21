import { createClient } from '@supabase/supabase-js'

// Supabase configuration
// Lấy từ environment variables hoặc hardcode (không khuyến khích cho production)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Leaderboard table schema:
// CREATE TABLE leaderboard (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   address TEXT NOT NULL UNIQUE,
//   score INTEGER NOT NULL DEFAULT 0,
//   badges INTEGER NOT NULL DEFAULT 0,
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );
//
// CREATE INDEX idx_leaderboard_score ON leaderboard(score DESC);
// CREATE INDEX idx_leaderboard_address ON leaderboard(address);

