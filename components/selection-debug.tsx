"use client"

import { useContext, useEffect, useState } from "react"
import { DataContext } from "@/lib/data-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SelectionDebug() {
  const { selectedIndices, highlightedIndex, highlightedFIPS, processedData } = useContext(DataContext)
  const [isVisible, setIsVisible] = useState(false)

  // Toggle visibility with keyboard shortcut (Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "d") {
        e.preventDefault()
        setIsVisible((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md">
      <Card className="bg-slate-900/90 border-slate-700 shadow-xl">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm flex justify-between">
            <span>Selection Debug</span>
            <button onClick={() => setIsVisible(false)} className="text-slate-400 hover:text-white">
              ×
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3 text-xs">
          <div>
            <div className="font-medium">Selected Indices ({selectedIndices.length}):</div>
            <div className="max-h-20 overflow-auto">
              {selectedIndices.length > 0 ? (
                <ul className="list-disc pl-4">
                  {selectedIndices.map((index) => (
                    <li key={index}>
                      {processedData[index]?.Name || "Unknown"}
                      {processedData[index]?.["State Abbreviation"]
                        ? `, ${processedData[index]["State Abbreviation"]}`
                        : ""}
                      {processedData[index]?.FIPS ? ` (FIPS: ${processedData[index].FIPS})` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-400">None</span>
              )}
            </div>
          </div>

          <div className="mt-2">
            <div className="font-medium">Highlighted:</div>
            {highlightedIndex !== null ? (
              <div>
                Index: {highlightedIndex}, Name: {processedData[highlightedIndex]?.Name || "Unknown"}
                {highlightedFIPS ? `, FIPS: ${highlightedFIPS}` : ""}
              </div>
            ) : (
              <span className="text-slate-400">None</span>
            )}
          </div>

          <div className="mt-2 text-slate-400">Press Ctrl+D to toggle this panel</div>
        </CardContent>
      </Card>
    </div>
  )
}
