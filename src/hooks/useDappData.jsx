import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'

const DappDataContext = createContext(null)

const DATA_URL = '/data/monad-dapps.csv'

function normaliseRow(row) {
  const rawName = row.name ?? row.NAME ?? row.Name
  const name = rawName?.trim()
  const category = (row.category ?? row['PJ TYPE'] ?? row['Category'] ?? 'Other').toString().trim()
  const subCategory = (row.subCategory ?? row.TAGS ?? row['SubCategory'] ?? '').toString().trim()
  const description =
    row.description ??
    row.INFO ??
    row['Info'] ??
    'Khám phá dự án Monad – chi tiết đang cập nhật.'
  const website = row.website ?? row.WEB ?? row.Web ?? ''
  const twitter = row.twitter ?? row.X ?? row['Twitter'] ?? ''
  const tvl = Number(row.tvlUsd || row.tvl || 0)
  const users24h = Number(row.users24h || row.users || 0)
  const onlyMonad = (row['ONLY on Monad'] ?? '').toString().trim().toLowerCase()
  const statusRaw = (row.status ?? row.Status ?? '').toString().trim().toLowerCase()
  const warning =
    (row['🟥 = sus / website link broken / dead pjs'] ??
      row['🟥'] ??
      '').toString().toLowerCase()
  const status =
    warning.includes('sus') || warning.includes('dead')
      ? 'sus'
      : statusRaw || (onlyMonad === 'yes' ? 'exclusive' : 'live')
  const logo = row.logo ?? row.LOGO ?? row['Logo'] ?? ''
  const tags = subCategory
    ? subCategory
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    : []
  const id =
    row.id ||
    (name ? `${name}-${category}`.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined)
  return {
    id,
    name: name ?? 'Unnamed dapp',
    category,
    subCategory,
    description,
    website: website?.trim() ?? '',
    twitter: twitter?.trim() ?? '',
    tvlUsd: tvl,
    users24h,
    status,
    logo,
    tags,
    raw: row,
  }
}

export function DappDataProvider({ children }) {
  const [dapps, setDapps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(DATA_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch dapp data: ${response.status}`)
        return response.text()
      })
      .then((csv) => {
        const parsed = Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
        })
        if (parsed.errors?.length) {
          console.warn('Failed to parse some rows', parsed.errors)
        }
        const items = parsed.data
          .map(normaliseRow)
          .filter((item) => item?.name && item?.id)
        if (!cancelled) {
          setDapps(items)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) {
          setError(err)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(() => {
    const map = new Map()
    dapps.forEach((dapp) => {
      const key = dapp.category || 'Other'
      const entry = map.get(key) ?? { id: key, name: key, items: [] }
      entry.items.push(dapp)
      map.set(key, entry)
    })
    return Array.from(map.values())
  }, [dapps])

  const trending = useMemo(() => {
    return [...dapps]
      .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
      .slice(0, 5)
  }, [dapps])

  const value = useMemo(
    () => ({
      dapps,
      categories,
      trending,
      loading,
      error,
    }),
    [dapps, categories, trending, loading, error]
  )

  return <DappDataContext.Provider value={value}>{children}</DappDataContext.Provider>
}

export function useDappData() {
  const context = useContext(DappDataContext)
  if (!context) {
    throw new Error('useDappData must be used within DappDataProvider')
  }
  return context
}

