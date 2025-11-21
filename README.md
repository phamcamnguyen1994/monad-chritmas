# 🎄 Monad Christmas Sledding Adventure

An immersive 3D winter sledding game set in a snowy Monad ecosystem, where players explore, collect dApp badges, complete quests, and compete on the leaderboard. Built with React Three Fiber and featuring Monad's ecosystem integration.

## 🌟 Features

### 🎮 Core Gameplay
- **3D Winter World**: Procedurally generated snowy terrain with dynamic weather
- **Sledding Mechanics**: Smooth physics-based movement with WASD controls
- **Dynamic Weather**: Realistic snowstorms, wind effects, and day/night cycles
- **Interactive Environment**: Collect dApp badges, discover landmarks, and complete missions

### 🎯 Quest System
- **Collect DeFi dApps**: Find and collect 5 DeFi dApps to complete the quest
- **Travel Distance**: Travel 500 meters across the winter landscape
- **Discover Monad**: Visit the glowing Monad landmark at the center of the map
- **Delivery Missions**: Time-limited delivery challenges between dApps
- **Active Buffs**: Speed boost, jump boost, and shield power-ups

### 🏆 Leaderboard & Scoring
- **Persistent Leaderboard**: Global leaderboard powered by Supabase
- **Score System**: Earn points by collecting dApps, completing quests, and deliveries
- **Real-time Rankings**: See your position and compete with other players
- **Wallet Integration**: Connect MetaMask to save your progress

### 🎨 Visual Features
- **3D Models**: Custom GLB models for sleds, trees, gift boxes, animals, houses, and Monad landmarks
- **Dynamic Lighting**: Aurora effects, sparkles, and atmospheric lighting
- **Particle Effects**: Realistic snowfall, wind particles, and visual feedback
- **Smooth Animations**: Tree sway, Santa flybys, rotating Monad logos, and more

### 🔗 Monad Integration
- **Monad Landmark**: Central beacon with visual effects and special quest
- **dApp Discovery**: Explore and collect badges from real Monad ecosystem dApps
- **Monad Branding**: 3D Monad logos throughout the world
- **Network Support**: Connect to Monad Testnet via MetaMask

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **MetaMask** or compatible Web3 wallet
- **Monad Testnet** RPC access (automatically configured)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The game will be available at `http://localhost:3000`

## 🎮 Controls

| Key | Action |
|-----|--------|
| **W** | Move forward |
| **S** | Brake / reverse |
| **A / D** | Steer left / right |
| **Shift** | Hold for extra thrust |
| **L** or **Double-click** | Enable mouse look (full camera control) |
| **Esc** | Unlock cursor / exit mouse look |
| **Y** | Interact with nearby dApp |
| **M** | Open leaderboard |
| **Drag mouse** or **Touch screen** | Look around |

## 🛠️ Tech Stack

### Core Technologies
- **React 18** + **Vite** - Modern frontend framework
- **Three.js** - 3D graphics and rendering
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers and abstractions
- **@react-three/rapier** - Physics engine for collisions

### State Management
- **Zustand** - Lightweight state management
- **Persistent Storage** - LocalStorage for game progress

### Blockchain Integration
- **ethers.js v6** - Ethereum/Monad wallet interactions
- **MetaMask** - Web3 wallet connection
- **Monad Testnet** - Network support

### Backend & Data
- **Supabase** - Leaderboard persistence
- **PapaParse** - CSV parsing for dApp data
- **Alea** - Seeded random number generation
- **Simplex Noise** - Procedural terrain generation

### Audio & Effects
- **Web Audio API** - Ambient wind and snow sounds
- **Custom Shaders** - Aurora sky, sparkles, tree sway effects

## 📁 Project Structure

```
monad-christmas/
├── public/
│   ├── data/
│   │   ├── monad-dapps.csv          # dApp ecosystem data
│   │   └── moneco-sheet1.csv        # Additional dApp data
│   ├── images/
│   │   ├── monad-logo.glb           # 3D Monad logo
│   │   ├── monad-logo.png           # 2D Monad logo
│   │   ├── tower.glb                # Monad tower model
│   │   ├── santa.glb                # Santa Claus model
│   │   └── house.glb                # House model
│   └── models/
│       ├── chog-sled.glb            # Player sled model
│       ├── gift1-8.glb             # Gift box variants
│       ├── pine1-8.glb              # Pine tree variants
│       ├── animal*.glb              # Animal models (penguin, fox)
│       └── animal-models.json       # Animal model manifest
├── src/
│   ├── components/
│   │   ├── Experience.jsx           # Main 3D scene orchestrator
│   │   ├── WinterWorld.jsx         # Terrain, trees, houses
│   │   ├── ChogsSled.jsx            # Player sled controller
│   │   ├── GiftBox.jsx              # dApp gift box markers
│   │   ├── MonadLandmark.jsx        # Central Monad beacon
│   │   ├── GameplayHUD.jsx          # UI overlay
│   │   ├── QuestBoard.jsx           # Quest progress display
│   │   ├── Leaderboard.jsx          # Leaderboard UI
│   │   ├── WalletConnect.jsx        # MetaMask connection
│   │   ├── MiniMap.jsx              # Mini map display
│   │   ├── DappOverlay.jsx          # dApp detail overlay
│   │   ├── NotificationToast.jsx   # Toast notifications
│   │   ├── AmbientAudio.jsx         # Audio system
│   │   └── SledInputContext.jsx     # Input handling
│   ├── store/
│   │   ├── questStore.js            # Quest and game state
│   │   ├── walletStore.js           # Wallet connection state
│   │   ├── leaderboardStore.js      # Leaderboard state
│   │   └── notificationStore.js     # Notification state
│   ├── hooks/
│   │   └── useDappData.jsx          # dApp data fetching
│   ├── utils/
│   │   └── supabase.js              # Supabase client
│   ├── styles/
│   │   └── index.css                # Global styles
│   ├── App.jsx                       # Root component
│   └── main.jsx                      # Entry point
├── package.json
├── vite.config.js
└── README.md
```

## 🎯 Gameplay Guide

### Getting Started
1. **Connect Wallet**: Click "Connect Wallet" to link your MetaMask
2. **Enable Mouse Look**: Press **L** or double-click for full camera control
3. **Start Exploring**: Use **WASD** to move around the winter world
4. **Collect Badges**: Approach gift boxes and press **Y** to collect dApp badges
5. **Complete Quests**: Check the quest board (top-left) for objectives
6. **Visit Monad Landmark**: Head to the center to discover the Monad beacon

### Quests
- **Collect DeFi dApps**: Find 5 DeFi dApps marked with gift boxes
- **Travel Distance**: Explore the map and travel 500 meters
- **Discover Monad**: Reach the glowing Monad landmark at the center
- **Delivery Missions**: Complete time-limited deliveries between dApps

### Scoring
- **Collect dApp**: +10 points
- **Complete quest**: +50 bonus points
- **Complete delivery**: Points based on time remaining
- **Discover Monad**: Special reward

### Leaderboard
- Press **M** to open the leaderboard
- View top players and your ranking
- Scores are saved to Supabase when connected with wallet

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Setup

1. Create a Supabase project
2. Create a `leaderboard` table:
   ```sql
   CREATE TABLE leaderboard (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     wallet_address TEXT NOT NULL,
     score INTEGER NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   CREATE INDEX idx_leaderboard_score ON leaderboard(score DESC);
   CREATE INDEX idx_leaderboard_wallet ON leaderboard(wallet_address);
   ```
3. Add your Supabase credentials to `.env`

### dApp Data

dApp information is loaded from `public/data/monad-dapps.csv`. To update:
1. Edit the CSV file with new dApp data
2. Restart the development server
3. The game will automatically load the updated data

### Adding 3D Models

The game supports automatic model loading:

- **Gift boxes**: Place `gift1.glb` through `gift8.glb` in `public/models/`
- **Pine trees**: Place `pine1.glb` through `pine8.glb` in `public/models/`
- **Animals**: Place `animal*.glb` files in `public/models/` and update `public/models/animal-models.json`
- **Other models**: Place in `public/images/` or `public/models/` as needed

## 🎨 Customization

### Terrain
Edit `src/components/WinterWorld.jsx`:
- `TERRAIN_SIZE`: Map size
- `terrainAmplitude`: Height variation
- `TREE_COUNT`: Number of trees

### Weather
Edit `src/components/Experience.jsx`:
- `storm` probability and duration
- `windBase` and `windGust`: Wind strength
- `snowIntensity`: Snow particle density

### Quests
Edit `src/store/questStore.js`:
- Quest targets and rewards
- New quest types
- Scoring multipliers

## 🚢 Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Netlify

```bash
# Build first
npm run build

# Deploy dist/ folder to Netlify
```

### Environment Variables

Make sure to set these in your deployment platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 🐛 Troubleshooting

### Models not loading
- Check that GLB files are in `public/models/` or `public/images/`
- Verify file names match expected patterns
- Check browser console for 404 errors

### Wallet connection issues
- Ensure MetaMask is installed
- Check that you're on Monad Testnet
- Try refreshing the page

### Leaderboard not working
- Verify Supabase credentials in `.env`
- Check Supabase table structure
- Ensure wallet is connected

### Performance issues
- Reduce `TREE_COUNT` in `WinterWorld.jsx`
- Lower `SNOW_PARTICLE_COUNT` in `Experience.jsx`
- Disable some visual effects if needed

## 📝 Development Notes

### Adding New Quests
1. Add quest definition to `questStore.js`
2. Update `QuestBoard.jsx` to display the quest
3. Add quest completion logic where appropriate

### Custom dApp Markers
Edit `src/components/Experience.jsx`:
- Modify `chooseRepresentation()` for different marker types
- Add new marker components as needed

### Audio System
The game uses Web Audio API for ambient sounds. Edit `src/components/AmbientAudio.jsx` to customize:
- Wind intensity based on speed
- Snow crunch sounds
- Gift collection chimes

## 🤝 Contributing

This project is built for the Monad ecosystem. Contributions welcome!

## 📄 License

MIT License - Open Source

## 🙏 Credits

- **Monad** - The blockchain platform
- **Three.js** - 3D graphics library
- **React Three Fiber** - React renderer for Three.js
- **Supabase** - Backend infrastructure
- **Community** - All Monad developers and contributors

## 🔮 Future Enhancements

- [ ] Multiplayer support
- [ ] More quest types
- [ ] Seasonal events
- [ ] NFT integration for collectibles
- [ ] Social features
- [ ] Mobile optimization

---

Built with ❤️ for Monad

**#MonadMission9** 🚀
