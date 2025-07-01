"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, Download, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import ChoroplethMap from "@/components/choropleth-map"
import PCAScatterPlot from "@/components/pca-scatter-plot"
import ClusterDistribution from "@/components/cluster-distribution"
import BrushableScatterPlot from "@/components/brushable-scatter-plot"
import DataUploader from "@/components/data-uploader"
import { DataContext } from "@/lib/data-context"
import { preloadTopoJSON } from "@/data/data-loader"
import { useState, useCallback, useEffect, useMemo } from "react"
import { performPCA, performClustering } from "@/lib/data-processing"
import ParallelCoordinates from "@/components/parallel-coordinates"
import CorrelationMatrix from "@/components/correlation-matrix"
import BackendUrlDisplay from "@/components/backend-url-display"
import { MetricSyncProvider } from "@/components/metric-sync-provider"

export default function Dashboard() {
  const [rawData, setRawData] = useState<any[]>([])
  const [processedData, setProcessedData] = useState<any[]>([])
  const [pcaData, setPcaData] = useState<any[]>([])
  const [clusters, setClusters] = useState<number[]>([])
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [highlightedFIPS, setHighlightedFIPS] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<string>("")
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [aggregationLevel, setAggregationLevel] = useState<"county" | "state" | "region">("county")
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([])
  const [compositeBurdenIndex, setCompositeBurdenIndex] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState("dashboard") // Start with dashboard tab active
  const [activeVisTab, setActiveVisTab] = useState("map")
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<string>("No data loaded")
  const [topoJSONLoaded, setTopoJSONLoaded] = useState(false)
  const [backendAvailable, setBackendAvailable] = useState<boolean>(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [fetchAttempts, setFetchAttempts] = useState(0)
  const [optimalClusters, setOptimalClusters] = useState<number>(3)

  // Preload TopoJSON data for faster map rendering
  useEffect(() => {
    const loadTopoJSON = async () => {
      try {
        await preloadTopoJSON()
        setTopoJSONLoaded(true)
      } catch (error) {
        console.error("Failed to preload TopoJSON:", error)
      }
    }

    loadTopoJSON()
  }, [])

  // Load sample data on initial render
  useEffect(() => {
    const loadSampleData = async () => {
      try {
        setIsLoading(true)
        setProcessingProgress(10)
        setBackendError(null)

        // Simulate progress
        const progressInterval = setInterval(() => {
          setProcessingProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval)
              return prev
            }
            return prev + 5
          })
        }, 200)

        // Process sample data using API route with fallback
        try {
          console.log("Attempting to fetch from API route")

          // Process sample data using API route with fallback
          const response = await fetch("/api/process-url", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/cleaned_dataset_2-UWN8P1ItixdnrCkG2bk0MF1s9ppxys.csv",
              aggregationLevel,
            }),
          })

          clearInterval(progressInterval)
          setProcessingProgress(100)

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || `Server responded with ${response.status}`)
          }

          const data = await response.json()

          // Check if we got data from the Python backend
          setBackendAvailable(!!data.usedPythonBackend)

          // Store backend error if there was one
          if (data.pythonBackendAttempted && data.pythonBackendError) {
            setBackendError(data.pythonBackendError)
            console.warn("Python backend error:", data.pythonBackendError)
          }

          // Update state with processed data
          handleProcessedData(data, "Sample County Health Dataset")
        } catch (fetchError) {
          console.error("Error fetching from API:", fetchError)
          setBackendError(fetchError instanceof Error ? fetchError.message : "Unknown error")
          throw fetchError
        }
      } catch (error) {
        console.error("Error loading sample data:", error)
        setError("Error loading sample data. Please try uploading your own data.")
        setIsLoading(false)
      }
    }

    loadSampleData()
  }, [])

  // Handle processed data from Python backend
  const handleProcessedData = (data: any, source: string) => {
    setProcessedData(data.processedData || [])
    setRawData(data.rawData || data.processedData || [])

    // Set available metrics
    const metrics = data.metrics || []
    setAvailableMetrics(metrics)
    setSelectedMetric(metrics[0] || "")

    // Set default features for PCA and clustering
    const defaultFeatures = metrics
      .filter(
        (m) =>
          !m.includes("FIPS") &&
          !m.includes("Name") &&
          !m.includes("State") &&
          !m.includes("Region") &&
          m.includes("raw value"),
      )
      .slice(0, 5)

    setSelectedFeatures(defaultFeatures)

    // Set other data
    setCompositeBurdenIndex(data.healthBurdenIndex || {})

    // If we have PCA and clustering from the backend, use it
    if (data.pcaResult && data.clusterAssignments) {
      setPcaData(data.pcaResult || [])
      setClusters(data.clusterAssignments || [])
    } else {
      // Otherwise, calculate it client-side
      recalculatePCAAndClustering(data.processedData, defaultFeatures)
    }

    setDataSource(`${source} (${data.processedData?.length || 0} records)`)
    setDataLoaded(true)
    setIsLoading(false)
    setActiveTab("dashboard") // Automatically switch to dashboard after data is loaded
  }

  // Function to recalculate PCA and clustering when metrics change
  const recalculatePCAAndClustering = useCallback(
    (data: any[], features: string[]) => {
      if (!data || data.length === 0 || !features || features.length === 0) return

      setIsRecalculating(true)

      // Use setTimeout to avoid blocking the UI
      setTimeout(() => {
        try {
          // Perform PCA
          const { pcaResult } = performPCA(data, features)
          setPcaData(pcaResult)

          // Perform clustering
          const { clusterAssignments } = performClustering(pcaResult, optimalClusters)
          setClusters(clusterAssignments)
        } catch (error) {
          console.error("Error recalculating PCA and clustering:", error)
        } finally {
          setIsRecalculating(false)
        }
      }, 100)
    },
    [optimalClusters],
  )

  // Effect to recalculate PCA and clustering when selected metric changes
  useEffect(() => {
    if (dataLoaded && !backendAvailable && selectedMetric) {
      // Only include the selected metric and a few other important metrics
      const importantMetrics = [
        selectedMetric,
        "Adult Obesity raw value",
        "Physical Inactivity raw value",
        "Poor or Fair Health raw value",
        "Median Household Income raw value",
      ]

      // Filter to only include metrics that exist in the data
      const availableImportantMetrics = importantMetrics.filter((metric) => availableMetrics.includes(metric))

      // Use at least 3 metrics, add more if needed
      let featuresToUse = [...new Set(availableImportantMetrics)]
      if (featuresToUse.length < 3) {
        const additionalMetrics = availableMetrics
          .filter((m) => !featuresToUse.includes(m) && m.includes("raw value"))
          .slice(0, 3 - featuresToUse.length)
        featuresToUse = [...featuresToUse, ...additionalMetrics]
      }

      setSelectedFeatures(featuresToUse)
      recalculatePCAAndClustering(processedData, featuresToUse)
    }
  }, [selectedMetric, dataLoaded, backendAvailable, availableMetrics, processedData, recalculatePCAAndClustering])

  // Handle user uploaded data
  const handleDataUploaded = (data: any) => {
    setError(null)
    setBackendAvailable(!!data.usedPythonBackend)
    handleProcessedData(data, "User uploaded data")
  }

  // Handle selection across visualizations
  const handleSelection = useCallback((indices: number[], addToSelection = false) => {
    setSelectedIndices((prevIndices) => {
      if (addToSelection) {
        return [...new Set([...prevIndices, ...indices])]
      }
      return indices
    })
  }, [])

  // Handle highlighting with FIPS code for cross-visualization highlighting
  const handleHighlight = useCallback(
    (index: number | null, fips: string | null = null) => {
      // Only update if the values are different to prevent unnecessary re-renders
      if (index !== highlightedIndex || fips !== highlightedFIPS) {
        setHighlightedIndex(index)
        setHighlightedFIPS(fips || (index !== null ? processedData[index]?.FIPS : null))
      }
    },
    [processedData, highlightedIndex, highlightedFIPS],
  )

  const clearSelection = useCallback(() => {
    setSelectedIndices([])
  }, [])

  // Handle aggregation level change
  const handleAggregationChange = async (level: "county" | "state" | "region") => {
    if (level === aggregationLevel) return // Skip if same level

    setAggregationLevel(level)
    setIsLoading(true)
    setProcessingProgress(10)
    setSelectedIndices([]) // Clear selection when changing aggregation level
    setBackendError(null)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProcessingProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 5
        })
      }, 200)

      // Process data with new aggregation level
      try {
        // Add retry logic for the fetch request
        let response = null
        let retryCount = 0
        const maxRetries = 2

        while (retryCount <= maxRetries) {
          try {
            response = await fetch("/api/process-url", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
              },
              body: JSON.stringify({
                url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/cleaned_dataset_2-UWN8P1ItixdnrCkG2bk0MF1s9ppxys.csv",
                aggregationLevel: level,
              }),
              cache: "no-store",
            })

            // If successful, break out of retry loop
            break
          } catch (fetchError) {
            retryCount++
            console.log(`Fetch attempt ${retryCount} failed: ${fetchError.message}`)

            if (retryCount > maxRetries) {
              throw fetchError
            }

            // Wait before retrying (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
          }
        }

        clearInterval(progressInterval)
        setProcessingProgress(100)

        if (!response || !response.ok) {
          throw new Error(`Server responded with ${response ? response.status : "no response"}`)
        }

        const data = await response.json()

        // Check if we got data from the Python backend
        setBackendAvailable(!!data.usedPythonBackend)

        // Store backend error if there was one
        if (data.pythonBackendAttempted && data.pythonBackendError) {
          setBackendError(data.pythonBackendError)
        }

        // Update state with processed data
        handleProcessedData(data, "County Health Dataset")
      } catch (fetchError) {
        console.error("Error fetching from API:", fetchError)
        setBackendError(fetchError instanceof Error ? fetchError.message : "Unknown error")
        throw fetchError
      }
    } catch (error) {
      console.error("Error processing data with new aggregation level:", error)
      setError("Error processing data with new aggregation level. Please try again.")
      setIsLoading(false)
    }
  }

  // Export selected data
  const exportData = () => {
    if (processedData.length === 0) return

    let dataToExport = processedData
    if (selectedIndices.length > 0) {
      dataToExport = selectedIndices.map((i) => processedData[i])
    }

    const headers = Object.keys(dataToExport[0]).join(",")
    const rows = dataToExport.map((row) => Object.values(row).join(","))
    const csv = [headers, ...rows].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "health_metrics_export.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Add CSS for tooltips and highlighting
  useEffect(() => {
    // Add global CSS for tooltips and highlighting
    const style = document.createElement("style")
    style.innerHTML = `
      .tooltip-custom {
        position: absolute;
        background-color: rgba(15, 23, 42, 0.95);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        pointer-events: none;
        z-index: 1000;
        max-width: 250px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      /* Remove transitions to prevent flickering */
      .no-transition {
        transition: none !important;
      }
      
      .highlight-element {
        stroke: #00ffff !important;
        stroke-width: 2.5px !important;
        opacity: 1 !important;
      }
      
      .selected-element {
        stroke: #ff00ff !important;
        stroke-width: 2.5px !important;
        opacity: 1 !important;
      }
      
      .faded-element {
        opacity: 0.15 !important;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Add a memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      rawData,
      processedData,
      pcaData,
      clusters,
      selectedIndices,
      highlightedIndex,
      highlightedFIPS,
      compositeBurdenIndex,
      onSelection: handleSelection,
      onHighlight: handleHighlight,
      clearSelection,
      selectedMetric,
      selectedFeatures,
    }),
    [
      rawData,
      processedData,
      pcaData,
      clusters,
      selectedIndices,
      highlightedIndex,
      highlightedFIPS,
      compositeBurdenIndex,
      handleSelection,
      handleHighlight,
      clearSelection,
      selectedMetric,
      selectedFeatures,
    ],
  )

  const renderUploadContent = () => (
    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-colors duration-200">
      <CardHeader>
        <CardTitle>Upload Your Data</CardTitle>
      </CardHeader>
      <CardContent>
        <DataUploader onDataUploaded={handleDataUploaded} />
      </CardContent>
    </Card>
  )

  return (
    <DataContext.Provider value={contextValue}>
      <MetricSyncProvider>
        {isLoading && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-slate-900 p-8 rounded-lg shadow-lg max-w-md w-full">
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24 mb-6">
                  <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping"></div>
                  <div className="absolute inset-2 border-4 border-t-cyan-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-4 border-4 border-r-purple-500 border-t-transparent border-b-transparent border-l-transparent rounded-full animate-spin-slow"></div>
                  <div className="absolute inset-6 border-4 border-b-blue-500 border-t-transparent border-r-transparent border-l-transparent rounded-full animate-spin-slower"></div>
                  <div className="absolute inset-8 border-4 border-l-green-500 border-t-transparent border-r-transparent border-b-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-xl font-medium text-cyan-400 mb-2">Processing Data</h3>
                <p className="text-slate-400 text-center mb-4">Please wait while we prepare your visualizations...</p>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300 ease-in-out"
                    style={{ width: `${processingProgress}%` }}
                  ></div>
                </div>
                <p className="text-slate-500 text-sm mt-2">{processingProgress}% complete</p>
                <div className="mt-4 p-2 bg-slate-800 rounded-md w-full">
                  <BackendUrlDisplay />
                </div>
              </div>
            </div>
          </div>
        )}

        {isRecalculating && (
          <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-md shadow-lg z-50 flex items-center">
            <div className="h-4 w-4 border-2 border-t-teal-500 border-teal-500/30 rounded-full animate-spin mr-2"></div>
            <span>Recalculating visualizations...</span>
          </div>
        )}

        <div
          className="min-h-screen bg-slate-950 text-slate-100"
          style={{ background: "linear-gradient(to bottom right, #0f172a, #020617)" }}
        >
          <div className="container mx-auto p-3">
            {/* Header */}
            <header className="py-4 mb-4 text-center">
              <h1 className="text-2xl font-bold">U.S. County Health Metrics Dashboard</h1>
            </header>

            {/* Main content */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 border-4 border-t-teal-500 border-teal-500/30 rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-xl font-medium text-slate-400">Processing Data...</h3>
                <p className="text-slate-500 mt-2 mb-6">Please wait while we prepare your dashboard</p>
                <Progress value={processingProgress} className="h-2 max-w-md mx-auto">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                    style={{ width: `${processingProgress}%` }}
                  />
                </Progress>
              </div>
            ) : error ? (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : dataLoaded ? (
              <div className="space-y-3">
                {/* Legend and Controls */}
                <div className="flex items-center bg-slate-800/60 backdrop-blur-sm p-2 rounded-lg border border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-slate-400">
                      <span className="mr-2">County Level</span>
                    </div>

                    <div>
                      <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                        <SelectTrigger className="w-[180px] bg-slate-700/80 border-slate-600/50 hover:bg-slate-700 h-8 text-sm">
                          <SelectValue placeholder="Select metric" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMetrics.map((metric) => (
                            <SelectItem key={metric} value={metric}>
                              {metric.replace(" raw value", "")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center ml-auto space-x-2">
                    <div className="flex items-center gap-3 mr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`px-3 py-1 h-8 ${activeTab === "dashboard" ? "bg-slate-700" : "hover:bg-slate-800"}`}
                        onClick={() => setActiveTab("dashboard")}
                      >
                        Dashboard
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`px-3 py-1 h-8 ${activeTab === "upload" ? "bg-slate-700" : "hover:bg-slate-800"}`}
                        onClick={() => setActiveTab("upload")}
                      >
                        Upload Data
                      </Button>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        className="border-slate-600/50 hover:bg-slate-700 transition-colors"
                      >
                        Clear Selection
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={exportData}
                        className="border-slate-600/50 hover:bg-slate-700 transition-colors"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export Data
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Legend for highlighting */}
                <div className="bg-slate-800/60 backdrop-blur-sm p-2 rounded-lg border border-slate-700/50 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-white">Legend:</div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-white border-2 border-[#00ffff]"></div>
                      <span>Highlighted</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-white border-2 border-[#ff00ff]"></div>
                      <span>Selected</span>
                    </div>
                    <div className="text-slate-400 ml-auto text-xs">
                      Hover to highlight, click to select, Ctrl/Cmd for multiple
                    </div>
                  </div>
                </div>

                {activeTab === "upload" ? (
                  renderUploadContent()
                ) : (
                  /* Dashboard Grid */
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left column with map */}
                    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-colors duration-200 text-white">
                      <CardHeader className="pb-1 pt-2 px-3">
                        <div className="flex justify-between items-center">
                          <CardTitle>
                            {selectedMetric ? selectedMetric.replace(" raw value", "") : "Composite Health Burden"}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="h-[280px] viz-container p-0 overflow-hidden">
                        <ChoroplethMap
                          aggregationLevel={aggregationLevel}
                          selectedMetric={selectedMetric}
                          topoJSONLoaded={topoJSONLoaded}
                        />
                      </CardContent>
                    </Card>

                    {/* PCA Scatter Plot */}
                    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-colors duration-200 text-white">
                      <CardHeader className="pb-1 pt-2 px-3">
                        <div className="flex justify-between items-center">
                          <CardTitle>PCA Scatter Plot</CardTitle>
                          {!backendAvailable && (
                            <div className="text-xs text-amber-400">
                              Using {selectedFeatures.length} metrics for analysis
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="h-[280px] viz-container p-0 overflow-hidden">
                        <PCAScatterPlot />
                      </CardContent>
                    </Card>

                    {/* Scatter Plot */}
                    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-colors duration-200 text-white">
                      <CardHeader className="pb-1 pt-2 px-3">
                        <div className="flex justify-between items-center">
                          <CardTitle>Interactive Scatter Plot</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="h-[280px] viz-container p-0 overflow-hidden">
                        <BrushableScatterPlot />
                      </CardContent>
                    </Card>

                    {/* Parallel Coordinates */}
                    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-colors duration-200 text-white">
                      <CardHeader className="pb-1 pt-2 px-3">
                        <CardTitle>Parallel Coordinates</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[280px] viz-container p-0 overflow-hidden">
                        <ParallelCoordinates />
                      </CardContent>
                    </Card>

                    {/* Correlation Matrix */}
                    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-colors duration-200 text-white">
                      <CardHeader className="pb-1 pt-2 px-3">
                        <CardTitle>Correlation Matrix</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[280px] viz-container p-0 overflow-hidden">
                        <CorrelationMatrix />
                      </CardContent>
                    </Card>

                    {/* Cluster Distribution */}
                    <Card className="bg-slate-800/60 border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-colors duration-200 text-white">
                      <CardHeader className="pb-1 pt-2 px-3">
                        <div className="flex justify-between items-center">
                          <CardTitle>Cluster Distribution</CardTitle>
                          {!backendAvailable && isRecalculating && (
                            <div className="text-xs text-amber-400 flex items-center">
                              <div className="h-3 w-3 border-2 border-t-amber-500 border-amber-500/30 rounded-full animate-spin mr-1"></div>
                              Updating clusters...
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="h-[280px] viz-container p-0 overflow-hidden">
                        <ClusterDistribution />
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-xl font-medium text-slate-400">No Data Loaded</h3>
                <p className="text-slate-500 mt-2 mb-6">Please upload data or use the sample dataset</p>
                <Button onClick={() => setActiveTab("upload")} className="bg-teal-600 hover:bg-teal-700">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Data
                </Button>
              </div>
            )}

            
          </div>
        </div>
      </MetricSyncProvider>
    </DataContext.Provider>
  )
}
