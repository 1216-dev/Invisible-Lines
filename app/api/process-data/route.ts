import { type NextRequest, NextResponse } from "next/server"
import { fetchAndProcessData } from "@/data/data-loader"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const aggregationLevel = (formData.get("aggregationLevel") as string) || "county"

    // Get the backend URL from environment variables
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL

    console.log(`Processing data with aggregation level: ${aggregationLevel}`)
    console.log(`Backend URL: ${backendUrl || "Not configured"}`)

    if (backendUrl) {
      try {
        console.log("Attempting to use Python backend...")

        // Set a timeout for the fetch request
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          controller.abort()
          console.log("Python backend request timed out after 30 seconds")
        }, 30000) // 30 second timeout

        // Forward the request to the Python backend
        const forwardFormData = new FormData()
        forwardFormData.append("file", file)
        forwardFormData.append("aggregationLevel", aggregationLevel)

        const response = await fetch(`${backendUrl}/api/process`, {
          method: "POST",
          body: forwardFormData,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          console.log("Python backend processing successful")
          const data = await response.json()
          return NextResponse.json(data)
        } else {
          const errorText = await response.text()
          console.error(`Backend request failed with status ${response.status}: ${errorText}`)
        }

        // If backend request fails, log it but continue to fallback
        console.log("Backend request failed, using client-side processing fallback")
      } catch (backendError) {
        console.error("Error connecting to Python backend:", backendError)
        // Continue to fallback processing
      }
    } else {
      console.log("No NEXT_PUBLIC_BACKEND_URL configured, using JavaScript fallback")
    }

    // Fallback: Process data client-side if backend is unavailable
    console.log("Using client-side processing fallback")

    // Read the file content
    const text = await file.text()
    const rows = text.split("\n")
    const headers = rows[0].split(",").map((h) => h.trim())

    // Parse CSV to JSON
    const jsonData = rows
      .slice(1)
      .filter((row) => row.trim())
      .map((row) => {
        const values = row.split(",")
        const rowData = {}

        headers.forEach((header, index) => {
          const value = values[index]?.trim() || ""
          rowData[header] = !isNaN(Number(value)) && value !== "" ? Number(value) : value
        })

        return rowData
      })

    console.log(`Parsed ${jsonData.length} rows from CSV`)

    // Process the data client-side
    const result = await fetchAndProcessData(
      "",
      aggregationLevel as "county" | "state" | "region",
      (progress) => console.log(`Processing progress: ${progress}%`),
      jsonData,
      jsonData.length,
    )

    // Add mock elbow plot data for the fallback
    const fallbackResult = {
      ...result,
      elbowPlot: "", // Empty string instead of a large base64 string
      optimalClusters: 5, // Default value
      usedPythonBackend: false, // Indicate that JavaScript fallback was used
    }

    return NextResponse.json(fallbackResult)
  } catch (error) {
    console.error("Error in process-data API route:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
