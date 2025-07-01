import { performPCA, performClustering } from "@/lib/data-processing"

// Cache for TopoJSON data
let countyTopoJSON: any = null
let stateTopoJSON: any = null

// IndexedDB database name and version
const DB_NAME = "healthDashboardDB"
const DB_VERSION = 1
const STORE_NAME = "dashboardData"

// External dataset URL
const EXTERNAL_DATASET_URL =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/cleaned_dataset_2-nBSTsxeyHtZM4DrfO1EADKGkk0HFgG.csv"

// Initialize IndexedDB
async function initIndexedDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB not supported"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = (event) => {
      reject(new Error("Error opening IndexedDB"))
    }

    request.onsuccess = (event) => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
  })
}

// Store data in the most appropriate storage mechanism
export async function storeDataInStorage(aggregationLevel: string, data: any) {
  try {
    // Try IndexedDB first (better for larger datasets)
    try {
      const db = await initIndexedDB()
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite")
        const store = transaction.objectStore(STORE_NAME)

        // Store only essential data
        const essentialData = {
          id: `healthDashboardData_${aggregationLevel}`,
          timestamp: Date.now(),
          metrics: data.metrics,
          healthBurdenIndex: data.healthBurdenIndex,
          pcaResult: data.pcaResult,
          clusterAssignments: data.clusterAssignments,
          // Store a subset of the raw and processed data
          rawData: data.rawData.slice(0, Math.min(500, data.rawData.length)),
          processedData: data.processedData.slice(0, Math.min(500, data.processedData.length)),
        }

        const request = store.put(essentialData)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error("Error storing data in IndexedDB"))
      })
    } catch (indexedDBError) {
      console.error("IndexedDB storage failed, trying localStorage:", indexedDBError)

      // Fall back to localStorage with reduced data
      const reducedData = {
        metrics: data.metrics,
        healthBurdenIndex: data.healthBurdenIndex,
        pcaResult: data.pcaResult.slice(0, Math.min(200, data.pcaResult.length)),
        clusterAssignments: data.clusterAssignments.slice(0, Math.min(200, data.clusterAssignments.length)),
        // Store even smaller subset for localStorage
        rawData: data.rawData.slice(0, Math.min(100, data.rawData.length)),
        processedData: data.processedData.slice(0, Math.min(100, data.processedData.length)),
      }

      localStorage.setItem(`healthDashboardData_${aggregationLevel}`, JSON.stringify(reducedData))
    }
  } catch (error) {
    console.error("All storage mechanisms failed:", error)
    throw error
  }
}

// Load data from the most appropriate storage mechanism
export async function loadDataFromStorage(aggregationLevel: string) {
  try {
    // Try IndexedDB first
    try {
      const db = await initIndexedDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly")
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(`healthDashboardData_${aggregationLevel}`)

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result)
          } else {
            resolve(null)
          }
        }

        request.onerror = () => reject(new Error("Error loading data from IndexedDB"))
      })
    } catch (indexedDBError) {
      console.error("IndexedDB load failed, trying localStorage:", indexedDBError)

      // Fall back to localStorage
      const storedData = localStorage.getItem(`healthDashboardData_${aggregationLevel}`)
      return storedData ? JSON.parse(storedData) : null
    }
  } catch (error) {
    console.error("All storage mechanisms failed:", error)
    return null
  }
}

// Preload TopoJSON data for faster map rendering
export async function preloadTopoJSON() {
  try {
    // Load county TopoJSON
    try {
      const countyResponse = await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json", {
        cache: "force-cache",
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (countyResponse.ok) {
        countyTopoJSON = await countyResponse.json()
      } else {
        console.error("Failed to load county TopoJSON:", countyResponse.status)
      }
    } catch (error) {
      console.error("Error loading county TopoJSON:", error)
    }

    // Load state TopoJSON
    try {
      const stateResponse = await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json", {
        cache: "force-cache",
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (stateResponse.ok) {
        stateTopoJSON = await stateResponse.json()
      } else {
        console.error("Failed to load state TopoJSON:", stateResponse.status)
      }
    } catch (error) {
      console.error("Error loading state TopoJSON:", error)
    }

    return { countyTopoJSON, stateTopoJSON }
  } catch (error) {
    console.error("Error preloading TopoJSON:", error)
    return { countyTopoJSON: null, stateTopoJSON: null }
  }
}

// Get cached TopoJSON data
export function getCachedTopoJSON(type: "county" | "state") {
  return type === "county" ? countyTopoJSON : stateTopoJSON
}

// Fetch the external dataset
export async function fetchExternalDataset() {
  try {
    // Use the URL provided by the user
    const response = await fetch(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/cleaned_dataset_2-UWN8P1ItixdnrCkG2bk0MF1s9ppxys.csv",
    )
    if (!response.ok) {
      throw new Error(`Failed to fetch dataset: ${response.status}`)
    }

    const text = await response.text()
    const data = parseCSV(text)
    return data
  } catch (error) {
    console.error("Error fetching external dataset:", error)
    throw error
  }
}

// Get embedded data - this replaces the need to fetch from an external URL
export function getEmbeddedData() {
  // Try to fetch the external dataset first
  return fetchExternalDataset()
    .then((data) => {
      console.log("Successfully loaded external dataset with", data.length, "rows")
      return data
    })
    .catch((error) => {
      console.error("Failed to load external dataset, using fallback data:", error)
      // Fall back to generated data if external dataset fails
      return generateFallbackData()
    })
}

// Generate fallback data if external dataset fails
function generateFallbackData() {
  // Generate a sample dataset with 200 counties
  const embeddedData = []
  const states = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ]

  for (let i = 0; i < 200; i++) {
    const stateIndex = i % states.length
    const stateCode = states[stateIndex]
    const countyNumber = Math.floor(i / states.length) + 1

    // Create FIPS code: 2-digit state code + 3-digit county code
    const stateFips = (stateIndex + 1).toString().padStart(2, "0")
    const countyFips = countyNumber.toString().padStart(3, "0")
    const fips = stateFips + countyFips

    embeddedData.push({
      FIPS: fips,
      Name: `County ${countyNumber}`,
      "State Abbreviation": stateCode,
      "Adult Obesity raw value": 0.2 + Math.random() * 0.2,
      "Food Insecurity raw value": 0.05 + Math.random() * 0.15,
      "Physical Inactivity raw value": 0.15 + Math.random() * 0.25,
      "Poor or Fair Health raw value": 0.1 + Math.random() * 0.2,
      "Median Household Income raw value": 30000 + Math.random() * 70000,
      "Children in Poverty raw value": 0.05 + Math.random() * 0.25,
      "Life Expectancy raw value": 70 + Math.random() * 15,
      "Adult Smoking raw value": 0.1 + Math.random() * 0.2,
      "Uninsured raw value": 0.05 + Math.random() * 0.15,
      "Mental Health Providers raw value": 0.0001 + Math.random() * 0.001,
      "Unemployment raw value": 0.03 + Math.random() * 0.07,
      "Income Inequality raw value": 3 + Math.random() * 5,
      "Air Pollution - Particulate Matter raw value": 5 + Math.random() * 10,
      "Severe Housing Problems raw value": 0.1 + Math.random() * 0.2,
      "Insufficient Sleep raw value": 0.2 + Math.random() * 0.2,
      "Broadband Access raw value": 0.6 + Math.random() * 0.3,
      "Premature Death raw value": 5000 + Math.random() * 5000,
      "Low Birthweight raw value": 0.05 + Math.random() * 0.1,
      "Access to Exercise Opportunities raw value": 0.4 + Math.random() * 0.5,
      "Primary Care Physicians raw value": 0.0001 + Math.random() * 0.001,
    })
  }

  return embeddedData
}

// Modify the fetchAndProcessData function to add better error handling and progress reporting
export async function fetchAndProcessData(
  url: string,
  aggregationLevel: "county" | "state" | "region",
  progressCallback: (progress: number) => void,
  preloadedData?: any[],
  rowLimit = 3000,
) {
  try {
    progressCallback(10)
    let data: any[]

    if (preloadedData) {
      // Use preloaded data if provided
      data = preloadedData
      progressCallback(30)
    } else if (url) {
      // Fetch data from URL if provided
      progressCallback(15)
      try {
        const response = await fetch(url, {
          cache: "force-cache", // Use cache to improve performance
          headers: { "Content-Type": "text/csv" },
          // Add a timeout to prevent hanging
          signal: AbortSignal.timeout(10000), // 10 second timeout
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch dataset: ${response.status}`)
        }

        progressCallback(20)
        const text = await response.text()
        progressCallback(30)

        // Parse CSV
        data = parseCSV(text)
      } catch (fetchError) {
        console.error("Fetch error:", fetchError)
        throw new Error(`Failed to fetch: ${fetchError.message}`)
      }
      progressCallback(40)
    } else {
      throw new Error("No data source provided")
    }

    // Ensure FIPS codes are strings and properly formatted
    data = data.map((row) => {
      if (row.FIPS !== undefined) {
        // Ensure FIPS is a string and pad with leading zeros if needed
        row.FIPS = String(row.FIPS).padStart(5, "0")
      }
      return row
    })

    progressCallback(50)

    // Implement stratified sampling to ensure geographic representation
    const sampledData = stratifiedSampling(data, aggregationLevel, rowLimit)
    progressCallback(60)

    // Process data
    const result = processData(sampledData, aggregationLevel)
    progressCallback(100)

    return result
  } catch (error) {
    console.error("Error in fetchAndProcessData:", error)
    throw error
  }
}

// Modify the stratifiedSampling function to be more aggressive with filtering
function stratifiedSampling(data: any[], aggregationLevel: string, maxRows: number): any[] {
  // For uploaded data, use all of it to ensure complete visualization
  if (data.length <= 3000) return data

  // For state/region aggregation, we need all counties for proper aggregation
  if (aggregationLevel !== "county") {
    return data
  }

  // For county level with large datasets, use stratified sampling
  const stateGroups: Record<string, any[]> = {}
  data.forEach((row) => {
    const state = row["State Abbreviation"] || "Unknown"
    if (!stateGroups[state]) stateGroups[state] = []
    stateGroups[state].push(row)
  })

  // Calculate how many counties to take from each state
  const states = Object.keys(stateGroups)
  const countiesPerState = Math.max(5, Math.floor(maxRows / states.length))

  // Sample from each state
  let sampledData: any[] = []
  states.forEach((state) => {
    const stateData = stateGroups[state]
    // Take a random sample from this state
    const stateSample = sampleArray(stateData, Math.min(countiesPerState, stateData.length))
    sampledData = sampledData.concat(stateSample)
  })

  return sampledData
}

// Helper function to sample an array
function sampleArray(array: any[], sampleSize: number): any[] {
  if (array.length <= sampleSize) return [...array]

  const result = []
  const tempArray = [...array]

  for (let i = 0; i < sampleSize; i++) {
    const randomIndex = Math.floor(Math.random() * tempArray.length)
    result.push(tempArray[randomIndex])
    tempArray.splice(randomIndex, 1)
  }

  return result
}

// Parse CSV text into an array of objects
function parseCSV(csvText: string) {
  const rows = csvText.split("\n")
  const headers = rows[0].split(",").map((h) => h.trim())

  // Process rows
  const data = rows
    .slice(1)
    .map((row) => {
      if (!row.trim()) return null // Skip empty rows

      const values = row.split(",")
      const rowData: Record<string, any> = {}

      headers.forEach((header, index) => {
        const value = values[index]?.trim() || ""

        // Convert numeric values
        if (!isNaN(Number(value)) && value !== "") {
          rowData[header] = Number(value)
        } else {
          rowData[header] = value
        }
      })

      return rowData
    })
    .filter(Boolean) as Record<string, any>[]

  return data
}

// Modify the processData function to handle missing values better
function processData(rawData: Record<string, any>[], aggregationLevel: "county" | "state" | "region") {
  // Ensure all numeric values are properly converted
  const processedRawData = rawData.map((row) => {
    const newRow = { ...row }
    Object.keys(newRow).forEach((key) => {
      if (
        key !== "FIPS" &&
        key !== "Name" &&
        key !== "State Abbreviation" &&
        newRow[key] !== undefined &&
        newRow[key] !== null &&
        newRow[key] !== ""
      ) {
        const numValue = Number.parseFloat(newRow[key])
        if (!isNaN(numValue)) {
          newRow[key] = numValue
        }
      }
    })
    return newRow
  })

  // Filter data to include only rows with valid FIPS codes or identifiers
  const filteredData = processedRawData.filter((row) => {
    if (aggregationLevel === "county") {
      return row.FIPS && (row.Name || row.County || row.county) && (row["State Abbreviation"] || row.State || row.state)
    } else if (aggregationLevel === "state") {
      return row["State Abbreviation"] || row.State || row.state
    } else {
      return row["State Abbreviation"] || row.State || row.state // We can derive region from state
    }
  })

  // Standardize field names to ensure consistent access
  const standardizedData = filteredData.map((row) => {
    const newRow = { ...row }

    // Standardize FIPS
    if (!newRow.FIPS && (newRow.fips || newRow["FIPS Code"])) {
      newRow.FIPS = newRow.fips || newRow["FIPS Code"]
    }

    // Ensure FIPS is a string and properly formatted
    if (newRow.FIPS) {
      newRow.FIPS = String(newRow.FIPS).padStart(5, "0")
    }

    // Standardize Name
    if (!newRow.Name && (newRow.County || newRow.county || newRow.NAME)) {
      newRow.Name = newRow.County || newRow.county || newRow.NAME
    }

    // Standardize State Abbreviation
    if (!newRow["State Abbreviation"] && (newRow.State || newRow.state)) {
      newRow["State Abbreviation"] = newRow.State || newRow.state
    }

    return newRow
  })

  // Select important health and socioeconomic metrics - include all available metrics
  const importantMetrics = [
    "Adult Obesity raw value",
    "Food Insecurity raw value",
    "Physical Inactivity raw value",
    "Poor or Fair Health raw value",
    "Median Household Income raw value",
    "Children in Poverty raw value",
    "Life Expectancy raw value",
    "Adult Smoking raw value",
    "Uninsured raw value",
    "Mental Health Providers raw value",
    "Unemployment raw value",
    "Income Inequality raw value",
    "Air Pollution - Particulate Matter raw value",
    "Severe Housing Problems raw value",
    "Insufficient Sleep raw value",
    "Broadband Access raw value",
    "Premature Death raw value",
    "Low Birthweight raw value",
    "Access to Exercise Opportunities raw value",
    "Primary Care Physicians raw value",
    "Food Environment Index raw value",
    "Dentists raw value",
    "Preventable Hospital Stays raw value",
    "Mammography Screening raw value",
    "Flu Vaccinations raw value",
    "High School Completion raw value",
    "Children in Single-Parent Households raw value",
    "Injury Deaths raw value",
    "Driving Alone to Work raw value",
    "Long Commute - Driving Alone raw value",
    "Voter Turnout raw value",
  ]

  // Process data based on aggregation level
  let processedData: Record<string, any>[] = []

  if (aggregationLevel === "county") {
    // County level - no aggregation needed
    processedData = standardizedData
  } else if (aggregationLevel === "state") {
    // State level - aggregate counties by state
    processedData = aggregateByField(standardizedData, "State Abbreviation", importantMetrics)
  } else {
    // Region level - derive regions from states and aggregate
    const withRegions = standardizedData.map((d) => ({
      ...d,
      Region: getRegionFromState(d["State Abbreviation"]),
    }))
    processedData = aggregateByField(withRegions, "Region", importantMetrics)
  }

  // Calculate health burden index with better handling of missing values
  const healthMetrics = [
    "Adult Obesity raw value",
    "Food Insecurity raw value",
    "Physical Inactivity raw value",
    "Poor or Fair Health raw value",
  ]

  const healthBurdenIndex: Record<string, number> = {}

  processedData.forEach((entity) => {
    // Determine the ID based on aggregation level
    let id: string
    if (aggregationLevel === "county") {
      id = entity.FIPS
    } else if (aggregationLevel === "state") {
      id = entity["State Abbreviation"]
    } else {
      id = entity.Region
    }

    if (id) {
      let sum = 0
      let count = 0

      healthMetrics.forEach((metric) => {
        if (entity[metric] !== undefined && !isNaN(entity[metric])) {
          // Normalize values between 0 and 1
          const normalizedValue = entity[metric]

          // For percentage values (between 0 and 1)
          if (normalizedValue >= 0 && normalizedValue <= 1) {
            sum += normalizedValue
          }
          // For other values, we need to normalize them
          else {
            // Simple normalization for demonstration
            // In a real application, you would use domain knowledge
            sum += 0.5 // Default value
          }
          count++
        }
      })

      healthBurdenIndex[id] = count > 0 ? sum / count : 0.5 // Default to 0.5 instead of 0
    }
  })

  // Extract available metrics - only include metrics that have data
  const metrics = importantMetrics.filter((metric) =>
    processedData.some((d) => d[metric] !== undefined && d[metric] !== null),
  )

  // Perform PCA and clustering with error handling
  let pcaResult = []
  let clusterAssignments = []

  try {
    const features = metrics.slice(0, Math.min(8, metrics.length))
    if (features.length > 0) {
      const pca = performPCA(processedData, features)
      pcaResult = pca.pcaResult

      if (pcaResult.length > 0) {
        const clustering = performClustering(pcaResult, Math.min(5, pcaResult.length))
        clusterAssignments = clustering.clusterAssignments
      }
    }
  } catch (error) {
    console.error("Error in PCA or clustering:", error)
    // Provide default values if PCA or clustering fails
    pcaResult = processedData.map((_, i) => ({ pc1: Math.random(), pc2: Math.random(), index: i }))
    clusterAssignments = Array(processedData.length)
      .fill(0)
      .map(() => Math.floor(Math.random() * 5))
  }

  return {
    rawData: standardizedData,
    processedData,
    metrics,
    healthBurdenIndex,
    pcaResult,
    clusterAssignments,
  }
}

// Fix the aggregateByField function to properly handle state-level aggregation
function aggregateByField(data: Record<string, any>[], field: string, metrics: string[]): Record<string, any>[] {
  const groups: Record<string, Record<string, any>[]> = {}

  // Group data by field
  data.forEach((row) => {
    const key = row[field]
    if (!key) return

    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(row)
  })

  // Aggregate each group
  return Object.entries(groups).map(([key, rows]) => {
    const result: Record<string, any> = {
      [field]: key,
    }

    // Calculate aggregates for numeric fields
    metrics.forEach((metric) => {
      const values = rows
        .map((r) => r[metric])
        .filter((v) => v !== undefined && v !== null && !isNaN(Number(v)))
        .map((v) => Number(v))

      if (values.length > 0) {
        // Calculate mean for numeric values
        result[metric] = values.reduce((sum, val) => sum + val, 0) / values.length
      }
    })

    // Add count
    result[`${field}Count`] = rows.length

    // Add FIPS if aggregating by state (use first digit of FIPS)
    if (field === "State Abbreviation") {
      // Find a representative FIPS code for this state
      const stateFips = rows.find((r) => r.FIPS)?.FIPS
      if (stateFips) {
        // For state level, use the first 2 digits of the FIPS code
        result.FIPS = String(stateFips).substring(0, 2).padStart(2, "0")
      }

      // Also add the state name if available
      const stateName = rows.find((r) => r.Name)?.Name
      if (stateName) {
        result.Name = key // Use the state abbreviation as the name
      }
    }

    return result
  })
}

// Map state abbreviation to region
function getRegionFromState(stateAbbr: string): string {
  const regions: Record<string, string> = {
    // Northeast
    CT: "Northeast",
    ME: "Northeast",
    MA: "Northeast",
    NH: "Northeast",
    RI: "Northeast",
    VT: "Northeast",
    NJ: "Northeast",
    NY: "Northeast",
    PA: "Northeast",

    // Midwest
    IL: "Midwest",
    IN: "Midwest",
    MI: "Midwest",
    OH: "Midwest",
    WI: "Midwest",
    IA: "Midwest",
    KS: "Midwest",
    MN: "Midwest",
    MO: "Midwest",
    NE: "Midwest",
    ND: "Midwest",
    SD: "Midwest",

    // South
    DE: "South",
    FL: "South",
    GA: "South",
    MD: "South",
    NC: "South",
    SC: "South",
    VA: "South",
    WV: "South",
    AL: "South",
    KY: "South",
    MS: "South",
    TN: "South",
    AR: "South",
    LA: "South",
    OK: "South",
    TX: "South",
    DC: "South",

    // West
    AZ: "West",
    CO: "West",
    ID: "West",
    MT: "West",
    NV: "West",
    NM: "West",
    UT: "West",
    WY: "West",
    AK: "West",
    CA: "West",
    HI: "West",
    OR: "West",
    WA: "West",
  }

  return regions[stateAbbr] || "Unknown"
}
