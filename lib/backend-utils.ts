/**
 * Utility functions for backend connectivity
 */

// Check if the backend is available
export async function checkBackendHealth(backendUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${backendUrl}/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
      headers: {
        Accept: "application/json",
      },
    })

    clearTimeout(timeoutId)
    return response.ok
  } catch (error) {
    console.error("Backend health check failed:", error)
    return false
  }
}

// Get the backend URL from environment variables
export function getBackendUrl(): string | null {
  return typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_BACKEND_URL || null
    : process.env.NEXT_PUBLIC_BACKEND_URL || null
}

// Safely fetch from the backend with retries
export async function fetchFromBackend(endpoint: string, options: RequestInit = {}, maxRetries = 2): Promise<Response> {
  const backendUrl = getBackendUrl()

  if (!backendUrl) {
    throw new Error("Backend URL is not configured")
  }

  const url = `${backendUrl}${endpoint}`
  let lastError: Error | null = null

  // Add default options for CORS
  const fetchOptions: RequestInit = {
    ...options,
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  }

  // Try with retries
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions)
      return response
    } catch (error) {
      console.error(`Fetch attempt ${attempt + 1} failed:`, error)
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
      }
    }
  }

  throw lastError || new Error(`Failed to fetch from ${url} after ${maxRetries} retries`)
}
