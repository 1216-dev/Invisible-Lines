import { createContext } from "react"

interface DataContextType {
  rawData: any[]
  processedData: any[]
  pcaData: any[]
  clusters: number[]
  selectedIndices: number[]
  highlightedIndex: number | null
  highlightedFIPS: string | null
  compositeBurdenIndex: Record<string, number>
  onSelection: (indices: number[], addToSelection?: boolean) => void
  onHighlight: (index: number | null, fips?: string | null) => void
  clearSelection: () => void
  selectedMetric: string
  selectedFeatures: string[]
}

export const DataContext = createContext<DataContextType>({
  rawData: [],
  processedData: [],
  pcaData: [],
  clusters: [],
  selectedIndices: [],
  highlightedIndex: null,
  highlightedFIPS: null,
  compositeBurdenIndex: {},
  onSelection: () => {},
  onHighlight: () => {},
  clearSelection: () => {},
  selectedMetric: "",
  selectedFeatures: [],
})
