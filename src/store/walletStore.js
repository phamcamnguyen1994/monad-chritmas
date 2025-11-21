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
        // Check for MetaMask or other injected providers
        if (typeof window === 'undefined') {
          set({ error: 'Window object not available' })
          return false
        }

        // Try to find ethereum provider
        const ethereum = window.ethereum || (window.web3 && window.web3.currentProvider)
        
        if (!ethereum) {
          set({ 
            error: 'MetaMask not detected. Please install MetaMask extension or use a Web3-enabled browser.' 
          })
          return false
        }

        // Check if it's MetaMask specifically
        const isMetaMask = ethereum.isMetaMask || ethereum._metamask
        if (!isMetaMask) {
          console.warn('Non-MetaMask provider detected:', ethereum)
        }

        set({ isConnecting: true, error: null })

        try {
          // Request account access
          const accounts = await ethereum.request({
            method: 'eth_requestAccounts',
          })

          if (!accounts || accounts.length === 0) {
            set({ isConnecting: false, error: 'No accounts found. Please unlock MetaMask.' })
            return false
          }

          const address = accounts[0]
          // Get chainId - handle both string and number formats
          let chainId = ethereum.chainId
          if (typeof chainId === 'number') {
            chainId = `0x${chainId.toString(16)}`
          }

          // Check if on correct network
          if (chainId !== MONAD_TESTNET_CHAIN_ID) {
            // Try to switch network
            try {
              await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: MONAD_TESTNET_CHAIN_ID }],
              })
              // Update chainId after switch
              chainId = ethereum.chainId
              if (typeof chainId === 'number') {
                chainId = `0x${chainId.toString(16)}`
              }
            } catch (switchError) {
              // If network doesn't exist, add it
              if (switchError.code === 4902 || switchError.code === -32603) {
                try {
                  await ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [MONAD_TESTNET],
                  })
                  // Update chainId after adding
                  chainId = ethereum.chainId
                  if (typeof chainId === 'number') {
                    chainId = `0x${chainId.toString(16)}`
                  }
                } catch (addError) {
                  console.error('Failed to add Monad Testnet:', addError)
                  set({ 
                    isConnecting: false, 
                    error: 'Failed to add Monad Testnet. Please add it manually in MetaMask.' 
                  })
                  return false
                }
              } else if (switchError.code === 4001) {
                // User rejected the request
                set({ 
                  isConnecting: false, 
                  error: 'Network switch was rejected. Please switch to Monad Testnet manually.' 
                })
                return false
              } else {
                throw switchError
              }
            }
          }

          set({
            address,
            isConnected: true,
            chainId: chainId,
            isConnecting: false,
            error: null,
          })

          // Remove old listeners to prevent duplicates
          if (ethereum.removeListener) {
            if (accountsChangedHandler) {
              ethereum.removeListener('accountsChanged', accountsChangedHandler)
            }
            if (chainChangedHandler) {
              ethereum.removeListener('chainChanged', chainChangedHandler)
            }
          }

          // Set up account change handler
          accountsChangedHandler = (newAccounts) => {
            if (newAccounts.length === 0) {
              get().disconnect()
            } else {
              set({ address: newAccounts[0] })
            }
          }

          // Set up chain change handler
          chainChangedHandler = (newChainId) => {
            // Convert to hex string if needed
            if (typeof newChainId === 'number') {
              newChainId = `0x${newChainId.toString(16)}`
            }
            set({ chainId: newChainId })
            if (newChainId !== MONAD_TESTNET_CHAIN_ID) {
              set({ error: 'Please switch to Monad Testnet' })
            } else {
              set({ error: null })
            }
          }

          // Listen for account changes
          ethereum.on('accountsChanged', accountsChangedHandler)

          // Listen for chain changes
          ethereum.on('chainChanged', chainChangedHandler)

          return true
        } catch (error) {
          console.error('Wallet connection error:', error)
          let errorMessage = 'Failed to connect wallet'
          
          if (error.code === 4001) {
            errorMessage = 'Connection rejected. Please approve the connection request in MetaMask.'
          } else if (error.code === -32002) {
            errorMessage = 'Connection request already pending. Please check MetaMask.'
          } else if (error.message) {
            errorMessage = error.message
          }
          
          set({
            isConnecting: false,
            error: errorMessage,
          })
          return false
        }
      },

      // Disconnect wallet
      disconnect: () => {
        // Remove event listeners if they exist
        const ethereum = window.ethereum || (window.web3 && window.web3.currentProvider)
        if (ethereum && ethereum.removeListener) {
          if (accountsChangedHandler) {
            ethereum.removeListener('accountsChanged', accountsChangedHandler)
            accountsChangedHandler = null
          }
          if (chainChangedHandler) {
            ethereum.removeListener('chainChanged', chainChangedHandler)
            chainChangedHandler = null
          }
        }

        set({
          address: null,
          isConnected: false,
          chainId: null,
          error: null,
        })
      },

      // Check if already connected
      checkConnection: async () => {
        if (typeof window === 'undefined') {
          return false
        }

        const ethereum = window.ethereum || (window.web3 && window.web3.currentProvider)
        if (!ethereum) {
          return false
        }

        try {
          const accounts = await ethereum.request({
            method: 'eth_accounts',
          })

          if (accounts && accounts.length > 0) {
            const address = accounts[0]
            let chainId = ethereum.chainId
            if (typeof chainId === 'number') {
              chainId = `0x${chainId.toString(16)}`
            }

            set({
              address,
              isConnected: true,
              chainId,
            })

            // Remove old listeners to prevent duplicates
            if (ethereum.removeListener) {
              if (accountsChangedHandler) {
                ethereum.removeListener('accountsChanged', accountsChangedHandler)
              }
              if (chainChangedHandler) {
                ethereum.removeListener('chainChanged', chainChangedHandler)
              }
            }

            // Set up account change handler
            accountsChangedHandler = (newAccounts) => {
              if (newAccounts.length === 0) {
                get().disconnect()
              } else {
                set({ address: newAccounts[0] })
              }
            }

            // Set up chain change handler
            chainChangedHandler = (newChainId) => {
              if (typeof newChainId === 'number') {
                newChainId = `0x${newChainId.toString(16)}`
              }
              set({ chainId: newChainId })
              if (newChainId !== MONAD_TESTNET_CHAIN_ID) {
                set({ error: 'Please switch to Monad Testnet' })
              } else {
                set({ error: null })
              }
            }

            // Set up listeners
            ethereum.on('accountsChanged', accountsChangedHandler)
            ethereum.on('chainChanged', chainChangedHandler)

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

