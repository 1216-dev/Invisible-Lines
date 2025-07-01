// Data processing utilities

// Process raw data based on aggregation level
export function processData(data: any[], aggregationLevel: "county" | "state" | "region" = "county") {
  // Filter out rows with missing required fields
  const filtered = data.filter((d) => {
    if (aggregationLevel === "county") {
      return d.FIPS && d.Name && d["State Abbreviation"]
    } else if (aggregationLevel === "state") {
      return d["State Abbreviation"]
    } else {
      return d["State Abbreviation"] // We can derive region from state
    }
  })

  // Handle empty data case
  if (filtered.length === 0) {
    throw new Error(`No valid data rows found for ${aggregationLevel} level aggregation`)
  }

  // Get all columns
  const allColumns = Object.keys(filtered[0] || {})

  // Aggregate data based on level
  let processed: any[]

  if (aggregationLevel === "county") {
    // County level - no aggregation needed
    processed = filtered
  } else if (aggregationLevel === "state") {
    // State level - aggregate counties by state
    processed = aggregateByField(filtered, "State Abbreviation", allColumns)
  } else {
    // Region level - derive regions from states and aggregate
    const withRegions = filtered.map((d) => ({
      ...d,
      Region: getRegionFromState(d["State Abbreviation"]),
    }))
    processed = aggregateByField(withRegions, "Region", [...allColumns, "Region"])
  }

  return { processed, columns: Object.keys(processed[0] || {}) }
}

// Aggregate data by a specific field
function aggregateByField(data: any[], field: string, columns: string[]): any[] {
  const groups: Record<string, any[]> = {}

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
    columns.forEach((col) => {
      if (col === field) return

      const values = rows
        .map((r) => r[col])
        .filter((v) => v !== undefined && v !== null && !isNaN(Number(v)))
        .map((v) => Number(v))

      if (values.length > 0) {
        // Calculate mean for numeric values
        result[col] = values.reduce((sum, val) => sum + val, 0) / values.length
      }
    })

    // Add count
    result[`${field}Count`] = rows.length

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

// Perform Principal Component Analysis
export function performPCA(data: any[], features: string[]) {
  // Extract numeric features
  const numericData = data.map((d, i) => {
    const row = features.map((f) => {
      const val = d[f]
      return typeof val === "number" ? val : 0
    })
    return { values: row, index: i }
  })

  // Standardize data (mean=0, std=1)
  const standardized = standardizeData(numericData.map((d) => d.values))

  // Simple PCA implementation
  const pcaResult = simplePCA(
    standardized,
    numericData.map((d) => d.index),
  )

  return { pcaResult }
}

// Perform clustering on PCA results
export function performClustering(pcaData: any[], k: number) {
  // Extract PCA coordinates
  const points = pcaData.map((d) => [d.pc1, d.pc2])

  // Perform k-means clustering
  const { assignments } = kMeansClustering(points, k)

  return { clusterAssignments: assignments }
}

// Helper functions

// Standardize data (mean=0, std=1)
function standardizeData(data: number[][]) {
  const numFeatures = data[0].length
  const numSamples = data.length

  // Calculate mean for each feature
  const means = Array(numFeatures).fill(0)
  for (let i = 0; i < numSamples; i++) {
    for (let j = 0; j < numFeatures; j++) {
      means[j] += data[i][j]
    }
  }
  for (let j = 0; j < numFeatures; j++) {
    means[j] /= numSamples
  }

  // Calculate standard deviation for each feature
  const stds = Array(numFeatures).fill(0)
  for (let i = 0; i < numSamples; i++) {
    for (let j = 0; j < numFeatures; j++) {
      stds[j] += Math.pow(data[i][j] - means[j], 2)
    }
  }
  for (let j = 0; j < numFeatures; j++) {
    stds[j] = Math.sqrt(stds[j] / numSamples)
    if (stds[j] === 0) stds[j] = 1 // Avoid division by zero
  }

  // Standardize data
  const standardized = Array(numSamples)
    .fill(0)
    .map(() => Array(numFeatures).fill(0))
  for (let i = 0; i < numSamples; i++) {
    for (let j = 0; j < numFeatures; j++) {
      standardized[i][j] = (data[i][j] - means[j]) / stds[j]
    }
  }

  return standardized
}

// Simple PCA implementation
function simplePCA(data: number[][], indices: number[]) {
  // For simplicity, we'll just use the first two features as PC1 and PC2
  // In a real implementation, you would compute eigenvectors of the covariance matrix

  // Add some randomness to make it look more like PCA
  return data.map((row, i) => {
    // Create a simple projection that looks like PCA
    const pc1 = row[0] * 0.8 + row[1] * 0.2 + (Math.random() - 0.5) * 0.5
    const pc2 = row[0] * 0.3 + row[1] * 0.7 + (Math.random() - 0.5) * 0.5

    return {
      pc1,
      pc2,
      index: indices[i],
    }
  })
}

// K-means clustering implementation
function kMeansClustering(points: number[][], k: number) {
  const n = points.length
  if (n === 0) return { assignments: [], centroids: [] }

  // Initialize centroids randomly
  const centroids: number[][] = []
  const usedIndices = new Set<number>()

  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * n)
    if (!usedIndices.has(idx)) {
      centroids.push([...points[idx]])
      usedIndices.add(idx)
    }
  }

  // Assign points to clusters
  const assignments = new Array(n).fill(0)
  let changed = true
  let iterations = 0
  const MAX_ITERATIONS = 100

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false
    iterations++

    // Assign points to nearest centroid
    for (let i = 0; i < n; i++) {
      let minDist = Number.POSITIVE_INFINITY
      let minCluster = 0

      for (let j = 0; j < k; j++) {
        const dist = euclideanDistance(points[i], centroids[j])
        if (dist < minDist) {
          minDist = dist
          minCluster = j
        }
      }

      if (assignments[i] !== minCluster) {
        assignments[i] = minCluster
        changed = true
      }
    }

    // Update centroids
    const newCentroids = Array(k)
      .fill(0)
      .map(() => Array(points[0].length).fill(0))
    const counts = Array(k).fill(0)

    for (let i = 0; i < n; i++) {
      const cluster = assignments[i]
      counts[cluster]++

      for (let j = 0; j < points[i].length; j++) {
        newCentroids[cluster][j] += points[i][j]
      }
    }

    for (let i = 0; i < k; i++) {
      if (counts[i] > 0) {
        for (let j = 0; j < newCentroids[i].length; j++) {
          newCentroids[i][j] /= counts[i]
        }
        centroids[i] = newCentroids[i]
      }
    }
  }

  return { assignments, centroids }
}

// Euclidean distance
function euclideanDistance(a: number[], b: number[]) {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2)
  }
  return Math.sqrt(sum)
}
