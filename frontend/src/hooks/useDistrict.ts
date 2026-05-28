import { useState, useEffect } from "react"
import { api } from "../api/client"
import type { District, DistrictDetail } from "../types"

export function useDistricts() {
  const [districts, setDistricts] = useState<District[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getDistricts()
      .then(setDistricts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { districts, loading, error }
}

export function useDistrict(id: string | null) {
  const [detail, setDetail] = useState<DistrictDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api.getDistrict(id)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  return { detail, loading, error }
}