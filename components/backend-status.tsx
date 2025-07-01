"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, Server, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { checkBackendHealth, getBackendUrl } from "@/lib/backend-utils"

export default function BackendStatus() {
  const [status, setStatus] = useState<"checking" | "available" | "unavailable">("checking")
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [details, setDetails] = useState<any>(null)
  const [backendUrl, setBackendUrl] = useState<string | null>(null)

  const checkBackend = async () => {
    setIsChecking(true)
    setStatus("checking")
    setError(null)

    try {
      // Get the backend URL
      const url = getBackendUrl()
      setBackendUrl(url)

      if (!url) {
        throw new Error("NEXT_PUBLIC_BACKEND_URL environment variable is not set")
      }

      // Try direct client-side health check first
      const isHealthy = await checkBackendHealth(url)

      if (isHealthy) {
        setStatus("available")
        setError(null)
        setIsChecking(false)
        return
      }

      // If direct check fails, try through the API route
      const response = await fetch("/api/check-python-backend", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
      })

      const data = await response.json()

      if (response.ok && data.available) {
        setStatus("available")
        setDetails(data.details)
      } else {
        setStatus("unavailable")
        setError(data.error || "Backend is not responding")
      }
    } catch (error) {
      setStatus("unavailable")
      setError(error instanceof Error ? error.message : "Failed to check backend status")
    } finally {
      setIsChecking(false)
    }
  }

  // Check backend status on component mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        // Use the NEXT_PUBLIC_ prefixed environment variable
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL

        if (!backendUrl) {
          throw new Error("NEXT_PUBLIC_BACKEND_URL environment variable is not set")
        }

        console.log("Checking backend at:", backendUrl)

        // Validate URL format
        try {
          new URL(`${backendUrl}/health`)
        } catch (urlError) {
          throw new Error(`Invalid backend URL format: ${backendUrl}`)
        }

        // Try to connect directly to the backend health endpoint
        try {
          const response = await fetch(`${backendUrl}/health`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            // Prevent caching
            cache: "no-store",
          })

          if (response.ok) {
            setStatus("available")
            setError(null)
          } else {
            throw new Error(`Backend responded with status: ${response.status}`)
          }
        } catch (fetchError) {
          throw new Error(`Fetch error: ${fetchError.message}`)
        }
      } catch (err) {
        setStatus("unavailable")
        setError(err instanceof Error ? err.message : "Unknown error")
        console.error("Backend connection error:", err)
      }
    }

    checkBackend()
    // Check every 30 seconds
    const interval = setInterval(checkBackend, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Server className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-medium">Python Backend Status</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={checkBackend}
          disabled={isChecking}
          className="border-slate-600/50 hover:bg-slate-700 transition-colors"
        >
          {isChecking ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Connection
            </>
          )}
        </Button>
      </div>

      {status === "checking" ? (
        <div className="flex items-center space-x-2 text-slate-400">
          <div className="h-4 w-4 border-2 border-t-blue-500 border-blue-500/30 rounded-full animate-spin"></div>
          <span>Checking backend connection...</span>
        </div>
      ) : status === "available" ? (
        <Alert variant="default" className="bg-green-900/20 border-green-800/30 text-green-400">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Backend Connected</AlertTitle>
          <AlertDescription>
            <div>Python backend is available. Your dashboard will use optimized processing for better performance.</div>
            {details && (
              <div className="mt-2 text-sm">
                Version: {details.version}, Last checked: {new Date(details.timestamp * 1000).toLocaleTimeString()}
              </div>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="default" className="bg-amber-900/20 border-amber-800/30 text-amber-400">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Backend Unavailable</AlertTitle>
          <AlertDescription>
            <div>Python backend is not available. The dashboard will use JavaScript processing (slower).</div>
            {error && <div className="mt-2 text-sm opacity-80">Error: {error}</div>}
            <div className="mt-2 text-sm">
              <p>
                Configured backend URL:{" "}
                <code className="bg-slate-800 px-1 py-0.5 rounded">{backendUrl || "Not set"}</code>
              </p>
              <p className="mt-1">Make sure:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>NEXT_PUBLIC_BACKEND_URL is set correctly in .env.local or your Vercel project settings</li>
                <li>The Python backend is running and accessible from your browser</li>
                <li>Your backend allows CORS access from this domain</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
