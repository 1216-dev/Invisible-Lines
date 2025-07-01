"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Upload, FileText, AlertCircle, Check, Info, Server, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface DataUploaderProps {
  onDataUploaded: (data: any) => void
}

export default function DataUploader({ onDataUploaded }: DataUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [aggregationLevel, setAggregationLevel] = useState<string>("county")
  const [isPythonAvailable, setIsPythonAvailable] = useState<boolean | null>(null)
  const [usedPythonBackend, setUsedPythonBackend] = useState<boolean | null>(null)
  const [backendDetails, setBackendDetails] = useState<any>(null)
  const [isCheckingBackend, setIsCheckingBackend] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if Python backend is available on component mount
  useEffect(() => {
    checkPythonBackend()
  }, [])

  const checkPythonBackend = async () => {
    try {
      setIsCheckingBackend(true)
      const response = await fetch("/api/check-python-backend", {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })
      const data = await response.json()
      console.log("Backend check response:", data)
      setIsPythonAvailable(data.available)
      setBackendDetails(data.details || null)
      setIsCheckingBackend(false)
    } catch (error) {
      console.error("Error checking Python backend:", error)
      setIsPythonAvailable(false)
      setIsCheckingBackend(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()

    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = async (file: File) => {
    setError(null)
    setIsUploading(true)
    setUploadProgress(0)
    setUploadSuccess(false)
    setFileName(file.name)
    setUsedPythonBackend(null)

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setError("Please upload a CSV file")
      setIsUploading(false)
      return
    }

    try {
      // Create a progress interval to simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 5
        })
      }, 200)

      // Create form data
      const formData = new FormData()
      formData.append("file", file)
      formData.append("aggregationLevel", aggregationLevel)

      // Send to backend for processing
      const response = await fetch("/api/process-data", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to process data")
      }

      const data = await response.json()

      // Check if Python backend was used
      setUsedPythonBackend(data.usedPythonBackend === true)

      setTimeout(() => {
        setUploadSuccess(true)
        setIsUploading(false)
        onDataUploaded(data)
      }, 500)
    } catch (err) {
      console.error("Error processing file:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setIsUploading(false)
    }
  }

  const handleSampleData = async () => {
    setError(null)
    setIsUploading(true)
    setUploadProgress(0)
    setFileName("sample_data.csv")
    setUsedPythonBackend(null)

    try {
      // Create a progress interval to simulate processing progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 5
        })
      }, 200)

      // Send request to process sample data
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
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to process sample data")
      }

      const data = await response.json()

      // Check if Python backend was used
      setUsedPythonBackend(data.usedPythonBackend === true)

      setTimeout(() => {
        setUploadSuccess(true)
        setIsUploading(false)
        onDataUploaded(data)
      }, 500)
    } catch (err) {
      console.error("Error processing sample data:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      setIsUploading(false)
    }
  }

  const onButtonClick = () => {
    if (inputRef.current) {
      inputRef.current.click()
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {uploadSuccess && (
        <Alert variant="default" className="bg-green-50 text-green-800 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            File "{fileName}" processed successfully.
            {usedPythonBackend !== null && (
              <span className="block mt-1 text-sm">
                {usedPythonBackend ? (
                  <span className="text-blue-600 font-medium flex items-center">
                    <Server className="h-3 w-3 mr-1" /> Processed with Python backend
                  </span>
                ) : (
                  <span className="text-amber-600">Processed with JavaScript fallback (slower)</span>
                )}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Alert variant="default" className="bg-blue-50 text-blue-800 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="flex items-center justify-between">
          <span>Python Processing</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-blue-700 border-blue-300 hover:bg-blue-100"
            onClick={checkPythonBackend}
            disabled={isCheckingBackend}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isCheckingBackend ? "animate-spin" : ""}`} />
            {isCheckingBackend ? "Checking..." : "Check Connection"}
          </Button>
        </AlertTitle>
        <AlertDescription>
          Data is processed by a Python backend for improved performance and advanced analytics. The optimal number of
          clusters is automatically determined using the elbow method.
          {isPythonAvailable !== null && (
            <div className="mt-2 text-sm">
              Python Backend Status:
              {isPythonAvailable ? (
                <span className="ml-1 text-green-600 font-medium">Available</span>
              ) : (
                <span className="ml-1 text-amber-600 font-medium">Unavailable (will use JavaScript fallback)</span>
              )}
              {!isPythonAvailable && (
                <div className="mt-1 text-red-600">
                  Make sure the BACKEND_URL environment variable is set correctly and the Python backend is running.
                </div>
              )}
              {backendDetails && (
                <div className="mt-1 text-blue-700">
                  Version: {backendDetails.version}, Last checked:{" "}
                  {new Date(backendDetails.timestamp * 1000).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
        </AlertDescription>
      </Alert>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-1">Aggregation Level</label>
        <select
          className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white"
          value={aggregationLevel}
          onChange={(e) => setAggregationLevel(e.target.value)}
        >
          <option value="county">County</option>
          <option value="state">State</option>
          <option value="region">Region</option>
        </select>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          dragActive ? "border-teal-500 bg-teal-500/10" : "border-slate-700 hover:border-slate-600"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input ref={inputRef} type="file" accept=".csv" onChange={handleChange} className="hidden" />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-3 bg-slate-800 rounded-full">
            <Upload className="h-6 w-6 text-teal-500" />
          </div>
          <div>
            <p className="text-slate-300 font-medium">Drag and drop your CSV file here</p>
            <p className="text-slate-500 text-sm mt-1">or click to browse</p>
          </div>
          <Button
            onClick={onButtonClick}
            variant="outline"
            className="border-slate-700 hover:bg-slate-800"
            disabled={isUploading}
          >
            <FileText className="mr-2 h-4 w-4" />
            Select CSV File
          </Button>

          <Button
            onClick={handleSampleData}
            variant="outline"
            className="border-teal-700/50 hover:bg-teal-900/30 text-teal-400"
            disabled={isUploading}
          >
            <Info className="mr-2 h-4 w-4" />
            Use Sample Dataset
          </Button>

          {isUploading && (
            <div className="w-full mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{uploadProgress < 100 ? `Processing ${fileName}` : "Finalizing..."}</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </Progress>
            </div>
          )}

          <div className="text-slate-500 text-xs mt-4 max-w-md">
            <p>Required columns: FIPS, Name/County, State Abbreviation</p>
            <p>Recommended: Health metrics (Obesity, Food Insecurity, etc.)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
