"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Info } from "lucide-react"

interface ElbowPlotProps {
  elbowPlotData: string
  optimalClusters: number
  usedPythonBackend?: boolean
}

export default function ElbowPlot({ elbowPlotData, optimalClusters, usedPythonBackend }: ElbowPlotProps) {
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(!elbowPlotData)
  }, [elbowPlotData])

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium text-white">Optimal Clustering</CardTitle>
        <CardDescription className="text-slate-400">
          {usedPythonBackend ? "Determined using the elbow method with Python" : "Using default clustering parameters"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!imageError && elbowPlotData ? (
          <div className="flex flex-col items-center">
            <img
              src={elbowPlotData || "/placeholder.svg"}
              alt="Elbow Plot"
              className="max-w-full rounded-md"
              onError={() => setImageError(true)}
            />
            <div className="mt-2 text-center">
              <span className="text-sm text-slate-400">Optimal number of clusters: </span>
              <span className="text-teal-400 font-medium">{optimalClusters}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-700/50 rounded-md">
            <Info className="h-10 w-10 text-slate-500 mb-2" />
            <h3 className="text-slate-300 font-medium mb-1">Elbow Plot Not Available</h3>
            <p className="text-slate-400 text-sm max-w-xs">
              {usedPythonBackend === false
                ? "Python backend is not available. Using default clustering with 5 clusters."
                : "The elbow plot could not be generated. Using optimal clustering with K-means."}
            </p>
            <div className="mt-4 text-center">
              <span className="text-sm text-slate-400">Using </span>
              <span className="text-teal-400 font-medium">{optimalClusters || 5}</span>
              <span className="text-sm text-slate-400"> clusters</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
