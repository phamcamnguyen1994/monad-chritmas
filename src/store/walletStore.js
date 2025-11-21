import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Monad Testnet Chain ID
const MONAD_TESTNET_CHAIN_ID = '0x28' // 40 in decimal

const MONAD_TESTNET = {
  chainId: MONAD_TESTNET_CHAIN_ID,
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: ['https://monad-testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet-explorer.monad.xyz'],
}

export const useWalletStore = create(
  persist(
    (set, get) => ({
      address: null,
      isConnected: false,
      chainId: null,
      isConnecting: false,
      error: null,

      // Connect wallet
      connect: async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
          set({ error: 'MetaMask not installed. Please install MetaMask extension.' })
          return false
        }

        set({ isConnecting: true, error: null })

        try {
          // Request account access
          const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
          })

          if (accounts.length === 0) {
            set({ isConnecting: false, error: 'No accounts found' })
            return false
          }

          const address = accounts[0]
          const chainId = window.ethereum.chainId

          // Check if on correct network
          if (chainId !== MONAD_TESTNET_CHAIN_ID) {
            // Try to switch network
            try {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: MONAD_TESTNET_CHAIN_ID }],
              })
            } catch (switchError) {
              // If network doesn't exist, add it
              if (switchError.code === 4902) {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [MONAD_TESTNET],
                })
              } else {
                throw switchError
              }
            }
          }

          set({
            address,
            isConnected: true,
            chainId: window.ethereum.chainId,
            isConnecting: false,
            error: null,
          })

          // Listen for account changes
          window.ethereum.on('accountsChanged', (newAccounts) => {
            if (newAccounts.length === 0) {
              get().disconnect()
            } else {
              set({ address: newAccounts[0] })
            }
          })

          // Listen for chain changes
          window.ethereum.on('chainChanged', (newChainId) => {
            set({ chainId: newChainId })
            if (newChainId !== MONAD_TESTNET_CHAIN_ID) {
              set({ error: 'Please switch to Monad Testnet' })
            }
          })

          return true
        } catch (error) {
          console.error('Wallet connection error:', error)
          set({
            isConnecting: false,
            error: error.message || 'Failed to connect wallet',
          })
          return false
        }
      },

      // Disconnect wallet
      disconnect: () => {
        set({
          address: null,
          isConnected: false,
          chainId: null,
          error: null,
        })
      },

      // Check if already connected
      checkConnection: async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
          return false
        }

        try {
          const accounts = await window.ethereum.request({
            method: 'eth_accounts',
          })

          if (accounts.length > 0) {
            const address = accounts[0]
            const chainId = window.ethereum.chainId

            set({
              address,
              isConnected: true,
              chainId,
            })

            // Set up listeners
            window.ethereum.on('accountsChanged', (newAccounts) => {
              if (newAccounts.length === 0) {
                get().disconnect()
              } else {
                set({ address: newAccounts[0] })
              }
            })

            window.ethereum.on('chainChanged', (newChainId) => {
              set({ chainId: newChainId })
            })

            return true
          }
        } catch (error) {
          console.error('Check connection error:', error)
        }

        return false
      },
    }),
    {
      name: 'wallet-storage',
      partialize: (state) => ({
        address: state.address,
        isConnected: state.isConnected,
      }),
    }
  )
)

