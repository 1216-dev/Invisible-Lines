"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

export default function DebugPage() {
  const [backendUrl, setBackendUrl] = useState<string>("")
  const [backendStatus, setBackendStatus] = useState<"checking" | "available" | "unavailable">("checking")
  const [responseData, setResponseData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get the environment variable
    const url = process.env.NEXT_PUBLIC_BACKEND_URL
    setBackendUrl(url || "Not set")

    checkBackendStatus()
  }, [])

  const checkBackendStatus = async () => {
    setBackendStatus("checking")
    setError(null)

    try {
      const url = process.env.NEXT_PUBLIC_BACKEND_URL

      if (!url) {
        throw new Error("NEXT_PUBLIC_BACKEND_URL is not set")
      }

      // Validate URL format
      try {
        new URL(`${url}/health`)
      } catch (urlError) {
        throw new Error(`Invalid backend URL format: ${url}`)
      }

      try {
        const response = await fetch(`${url}/health`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        })

        const data = await response.json()
        setResponseData(data)

        if (response.ok) {
          setBackendStatus("available")
        } else {
          setBackendStatus("unavailable")
          setError(`Backend responded with status: ${response.status}`)
        }
      } catch (fetchError) {
        setBackendStatus("unavailable")
        setError(`Fetch error: ${fetchError.message}`)
      }
    } catch (err) {
      setBackendStatus("unavailable")
      setError(err instanceof Error ? err.message : "Unknown error")
      console.error("Backend connection error:", err)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Backend Connection Debug</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>Check if your environment variables are set correctly</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-gray-100 rounded">
                <span className="font-mono">NEXT_PUBLIC_BACKEND_URL</span>
                <span className="font-mono">{backendUrl}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backend Connection Status</CardTitle>
            <CardDescription>Check if your backend is accessible</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {backendStatus === "checking" && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                {backendStatus === "available" && <CheckCircle className="h-5 w-5 text-green-500" />}
                {backendStatus === "unavailable" && <XCircle className="h-5 w-5 text-red-500" />}

                <span className="font-medium">
                  {backendStatus === "checking" && "Checking backend connection..."}
                  {backendStatus === "available" && "Backend is available"}
                  {backendStatus === "unavailable" && "Backend is unavailable"}
                </span>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  <p className="font-semibold">Error:</p>
                  <p className="font-mono">{error}</p>
                </div>
              )}

              {responseData && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                  <p className="font-semibold mb-2">Response Data:</p>
                  <pre className="text-xs overflow-auto p-2 bg-gray-100 rounded">
                    {JSON.stringify(responseData, null, 2)}
                  </pre>
                </div>
              )}

              <Button onClick={checkBackendStatus}>Check Again</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting Steps</CardTitle>
            <CardDescription>Try these steps if you're having connection issues</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2">
              <li>Make sure your Python backend is running on the correct port</li>
              <li>
                Check that <code className="bg-gray-100 p-1 rounded">NEXT_PUBLIC_BACKEND_URL</code> is set correctly
              </li>
              <li>Ensure CORS is properly configured in your Python backend</li>
              <li>Check for any network restrictions or firewalls</li>
              <li>Try accessing the backend URL directly in your browser</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
