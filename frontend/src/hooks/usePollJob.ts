import { useState, useEffect, useRef } from "react"
import { api } from "../api/client"
import type { JobStatus } from "../types"

export function usePollJob(jobId: string | null) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      const result = await api.pollJob(jobId)
      setStatus(result)
      if (result.status === "complete" || result.status === "failed") {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 3000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [jobId])

  return status
}