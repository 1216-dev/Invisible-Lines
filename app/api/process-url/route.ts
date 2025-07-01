import { type NextRequest, NextResponse } from "next/server"
import { fetchAndProcessData, getEmbeddedData } from "@/data/data-loader"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, aggregationLevel } = body

    // Check if backend URL is configured
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL

    console.log(`Processing request with aggregation level: ${aggregationLevel}`)
    console.log(`Backend URL configured: ${backendUrl ? backendUrl : "Not set"}`)

    // Flag to track if we attempted to use the Python backend
    let attemptedPythonBackend = false
    let pythonBackendError = null

    // Try to use Python backend if configured
    if (backendUrl) {
      try {
        console.log(`Attempting to connect to Python backend at ${backendUrl}`)
        attemptedPythonBackend = true

        // Validate the URL format
        let url
        try {
          url = new URL(`${backendUrl}/api/process-url`)
        } catch (urlError) {
          throw new Error(`Invalid backend URL: ${backendUrl}. Error: ${urlError.message}`)
        }

        // Make the request to the Python backend with simplified approach
        try {
          // Set a timeout for the fetch request
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 8000)

          const response = await fetch(url.toString(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
            cache: "no-store",
          })

          clearTimeout(timeoutId)

          if (response.ok) {
            console.log("Python backend processing successful")
            const data = await response.json()
            return NextResponse.json({
              ...data,
              usedPythonBackend: true,
            })
          } else {
            const errorText = await response.text()
            pythonBackendError = `Backend responded with status ${response.status}: ${errorText}`
            console.error(pythonBackendError)
          }
        } catch (fetchError) {
          // Handle fetch errors (network issues, CORS, etc.)
          pythonBackendError = `${fetchError.name}: ${fetchError.message}`
          console.error("Error connecting to Python backend:", pythonBackendError)
        }
      } catch (backendError) {
        // Handle other errors
        pythonBackendError =
          backendError instanceof Error
            ? `${backendError.name}: ${backendError.message}`
            : "Unknown error connecting to Python backend"
        console.error("Backend setup error:", pythonBackendError)
      }
    }

    // Fallback: Process data client-side if backend is unavailable
    console.log("Using client-side processing fallback")

    // Get embedded data (we'll use this instead of fetching from URL in preview)
    let processedData = {}
    try {
      // First try to get embedded data (faster for preview)
      console.log("Attempting to use embedded data")
      const embeddedData = await getEmbeddedData()

      if (embeddedData && embeddedData.length > 0) {
        console.log(`Found embedded data with ${embeddedData.length} records`)

        // Process the data client-side
        processedData = await fetchAndProcessData(
          "",
          aggregationLevel,
          () => {}, // No progress callback needed
          embeddedData,
          embeddedData.length,
        )
      } else {
        throw new Error("No embedded data found")
      }
    } catch (embeddedDataError) {
      console.error("Error processing embedded data:", embeddedDataError)
      console.log("Falling back to URL data fetch")

      // If embedded data fails, try to fetch from URL
      try {
        processedData = await fetchAndProcessData(
          url,
          aggregationLevel,
          () => {}, // No progress callback needed
        )
      } catch (urlFetchError) {
        console.error("Error fetching from URL:", urlFetchError)
        return NextResponse.json(
          {
            error: "Failed to process data from both embedded data and URL",
            details: urlFetchError instanceof Error ? urlFetchError.message : "Unknown error",
          },
          { status: 500 },
        )
      }
    }

    // Add mock elbow plot data for the fallback
    const fallbackResult = {
      ...processedData,
      elbowPlot: "", // Empty string instead of a large base64 string
      optimalClusters: 5, // Default value
      usedPythonBackend: false, // Indicate that JavaScript fallback was used
      pythonBackendAttempted: attemptedPythonBackend,
      pythonBackendError: pythonBackendError,
    }

    return NextResponse.json(fallbackResult)
  } catch (error) {
    console.error("Error in process-url API route:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        usedPythonBackend: false,
      },
      { status: 500 },
    )
  }
}
