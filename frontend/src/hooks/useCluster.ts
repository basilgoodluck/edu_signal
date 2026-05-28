import { useState, useEffect } from "react"
import { api } from "../api/client"
import type { District, Intervention } from "../types"

export function useCluster(clusterId: number | null) {
  const [peers, setPeers] = useState<District[]>([])
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (clusterId === null) return
    setLoading(true)
    Promise.all([
      api.getClusterPeers(clusterId),
      api.getClusterInterventions(clusterId),
    ])
      .then(([p, i]) => {
        setPeers(p)
        setInterventions(i)
      })
      .finally(() => setLoading(false))
  }, [clusterId])

  return { peers, interventions, loading }
}