import { dAppsData } from '../utils/dappsData'

const COLOR_PALETTE = [
  '#38bdf8',
  '#f97316',
  '#a855f7',
  '#facc15',
  '#22c55e',
  '#ec4899',
]

const FALLBACK_DESCRIPTION = 'Khám phá hệ sinh thái Monad cùng Chog.'

const normalized = dAppsData.slice(0, 25).map((dapp, index) => {
  const color = COLOR_PALETTE[index % COLOR_PALETTE.length]
  return {
    id: dapp.id,
    name: dapp.name,
    description: dapp.description || FALLBACK_DESCRIPTION,
    category: Array.isArray(dapp.categories) && dapp.categories.length ? dapp.categories[0] : 'General',
    voteUrl: dapp.url || dapp.links?.[0] || '',
    collectUrl: dapp.socials?.[0] || '',
    color,
    tvlLabel: dapp.popularityScore ? `${Math.round(dapp.popularityScore / 10)}k` : 'n/a',
    userLabel: `${dapp.votes ?? 0}`,
  }
})

export default normalized

