import { NextResponse } from "next/server"

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL

    if (!backendUrl) {
      return NextResponse.json({
        available: false,
        error: "NEXT_PUBLIC_BACKEND_URL environment variable is not set",
      })
    }

    try {
      // Set a timeout for the fetch request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      // Try to connect to the Python backend with retry logic
      let response = null
      let retryCount = 0
      const maxRetries = 2

      while (retryCount <= maxRetries) {
        try {
          // Try to connect to the Python backend
          response = await fetch(`${backendUrl}/health`, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
            mode: "cors",
            credentials: "omit",
            headers: {
              Accept: "application/json",
            },
          })

          // If successful, break out of retry loop
          break
        } catch (fetchError) {
          retryCount++
          console.log(`Health check attempt ${retryCount} failed: ${fetchError.message}`)

          if (retryCount > maxRetries) {
            throw fetchError
          }

          // Wait before retrying (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
        }
      }

      clearTimeout(timeoutId)

      if (response && response.ok) {
        const data = await response.json()
        return NextResponse.json({
          available: true,
          url: backendUrl,
          details: data,
        })
      } else if (response) {
        return NextResponse.json({
          available: false,
          error: `Backend responded with status ${response.status}`,
          url: backendUrl,
        })
      } else {
        return NextResponse.json({
          available: false,
          error: "No response from backend after retries",
          url: backendUrl,
        })
      }
    } catch (error) {
      return NextResponse.json({
        available: false,
        error: error instanceof Error ? `${error.name}: ${error.message}` : "Failed to connect to backend",
        url: backendUrl,
      })
    }
  } catch (error) {
    return NextResponse.json({
      available: false,
      error: "Internal server error checking backend status",
    })
  }
}
