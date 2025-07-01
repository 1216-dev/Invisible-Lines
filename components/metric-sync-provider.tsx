"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { DataContext } from "@/lib/data-context"

interface MetricSyncContextType {
  primaryMetric: string
  secondaryMetric: string
  setPrimaryMetric: (metric: string) => void
  setSecondaryMetric: (metric: string) => void
  availableMetrics: string[]
}

const MetricSyncContext = createContext<MetricSyncContextType | null>(null)

export function useMetricSync() {
  const context = useContext(MetricSyncContext)
  if (!context) {
    throw new Error("useMetricSync must be used within a MetricSyncProvider")
  }
  return context
}

export function MetricSyncProvider({ children }: { children: React.ReactNode }) {
  const { processedData } = useContext(DataContext)
  const [primaryMetric, setPrimaryMetric] = useState<string>("")
  const [secondaryMetric, setSecondaryMetric] = useState<string>("")
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([])

  // Initialize available metrics from processed data
  useEffect(() => {
    if (processedData && processedData.length > 0) {
      const firstItem = processedData[0]
      const metrics = Object.keys(firstItem).filter(
        (key) => key.includes("raw value") || key.includes("Income") || key === "POPESTIMATE2023",
      )

      setAvailableMetrics(metrics)

      // Set default metrics if not already set
      if (!primaryMetric && metrics.length > 0) {
        setPrimaryMetric(metrics.find((m) => m.includes("Income")) || metrics[0])
      }

      if (!secondaryMetric && metrics.length > 1) {
        setSecondaryMetric(metrics.find((m) => m.includes("Obesity")) || metrics[1])
      }
    }
  }, [processedData, primaryMetric, secondaryMetric])

  const value = {
    primaryMetric,
    secondaryMetric,
    setPrimaryMetric,
    setSecondaryMetric,
    availableMetrics,
  }

  return <MetricSyncContext.Provider value={value}>{children}</MetricSyncContext.Provider>
}
