"use client"

import { useRef, useEffect, useContext, useState } from "react"
import * as d3 from "d3"
import { DataContext } from "@/lib/data-context"

export default function ParallelCoordinates() {
  const svgRef = useRef<SVGSVGElement>(null)
  const {
    processedData,
    clusters,
    selectedIndices,
    highlightedIndex,
    highlightedFIPS,
    onSelection,
    onHighlight,
    selectedMetric,
  } = useContext(DataContext)
  const [tooltipContent, setTooltipContent] = useState<string>("")
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false)
  const [dimensions, setDimensions] = useState<string[]>([])
  const [dimensionPositions, setDimensionPositions] = useState<Map<string, number>>(new Map())
  const [dragging, setDragging] = useState<{ dimension: string; x: number } | null>(null)

  useEffect(() => {
    if (!svgRef.current || processedData.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const margin = { top: 50, right: 50, bottom: 20, left: 50 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Select metrics to display
    // Always include the currently selected metric if it's a numeric value
    const defaultMetrics = [
      "Adult Obesity raw value",
      "Food Insecurity raw value",
      "Physical Inactivity raw value",
      "Poor or Fair Health raw value",
      "Median Household Income raw value",
      "Children in Poverty raw value",
    ]

    // Add the selected metric if it's not already in the list
    let metricsToShow = [...defaultMetrics]
    if (
      selectedMetric &&
      !defaultMetrics.includes(selectedMetric) &&
      processedData[0] &&
      typeof processedData[0][selectedMetric] === "number"
    ) {
      metricsToShow = [selectedMetric, ...defaultMetrics.slice(0, 5)]
    }

    // Filter to only include metrics that exist in the data
    const availableDimensions = metricsToShow
      .filter((metric) => processedData[0] && processedData[0][metric] !== undefined)
      .slice(0, 8) // Limit to 8 metrics for readability

    // If dimensions state is empty or doesn't match available dimensions, initialize it
    if (
      dimensions.length === 0 ||
      !dimensions.every((d) => availableDimensions.includes(d)) ||
      dimensions.length !== availableDimensions.length
    ) {
      setDimensions(availableDimensions)

      // Initialize dimension positions
      const positions = new Map<string, number>()
      availableDimensions.forEach((d, i) => {
        positions.set(d, i)
      })
      setDimensionPositions(positions)

      return // Exit early and let the next render handle drawing
    }

    // Create scales for each dimension
    const y: { [key: string]: d3.ScaleLinear<number, number> } = {}
    const dimensionData: { [key: string]: { min: number; max: number } } = {}

    dimensions.forEach((dimension) => {
      // Get min and max values for each dimension
      const values = processedData.map((d) => d[dimension]).filter((v) => v !== undefined && !isNaN(v))
      dimensionData[dimension] = {
        min: d3.min(values) || 0,
        max: d3.max(values) || 1,
      }

      // Create scale for each dimension
      y[dimension] = d3
        .scaleLinear()
        .domain([dimensionData[dimension].min, dimensionData[dimension].max])
        .range([innerHeight, 0])
    })

    // Sort dimensions based on their positions
    const sortedDimensions = [...dimensions].sort((a, b) => {
      return (dimensionPositions.get(a) || 0) - (dimensionPositions.get(b) || 0)
    })

    // Create x scale for dimensions
    const x = d3.scalePoint<string>().range([0, innerWidth]).domain(sortedDimensions)

    // Create color scale for clusters
    const colorScale = d3
      .scaleOrdinal<string>()
      .domain([...new Set(clusters)].map(String))
      .range(d3.schemeTableau10)

    // Create main group
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`)

    // Add background lines for context
    const backgroundLines = g
      .append("g")
      .attr("class", "background-lines")
      .selectAll("path")
      .data(processedData)
      .join("path")
      .attr("d", (d) => {
        return d3.line()(
          sortedDimensions.map((dimension) => {
            return [x(dimension) || 0, y[dimension](d[dimension] || 0)]
          }),
        )
      })
      .attr("fill", "none")
      .attr("stroke", "#aaa")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.1)

    // Add foreground lines
    const foregroundLines = g
      .append("g")
      .attr("class", "foreground-lines")
      .selectAll("path")
      .data(processedData)
      .join("path")
      .attr("d", (d) => {
        return d3.line()(
          sortedDimensions.map((dimension) => {
            return [x(dimension) || 0, y[dimension](d[dimension] || 0)]
          }),
        )
      })
      .attr("fill", "none")
      .attr("stroke", (d, i) => colorScale(clusters[i].toString()))
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.7)
      .attr("data-index", (d, i) => i)
      .attr("data-fips", (d) => d.FIPS || "")
      .on("mouseover", (event, d) => {
        const index = processedData.indexOf(d)
        onHighlight(index, d.FIPS)

        // Format tooltip content
        let content = `<div class="font-medium">${d.Name}, ${d["State Abbreviation"]}</div>`
        content += `<div class="text-xs text-gray-500">FIPS: ${d.FIPS}</div>`
        content += `<div class="mt-1">Cluster: <span class="font-medium">${clusters[index]}</span></div>`

        // Add values for each dimension
        content += `<div class="mt-2 pt-1 border-t border-gray-700"></div>`
        dimensions.forEach((dimension) => {
          const value = d[dimension]
          const formattedValue = formatValue(value, dimension)
          content += `<div class="mt-1">${dimension.replace(" raw value", "")}: <span class="font-medium">${formattedValue}</span></div>`
        })

        setTooltipContent(content)
        setTooltipPosition({ x: event.pageX, y: event.pageY })
        setTooltipVisible(true)
      })
      .on("mousemove", (event) => {
        setTooltipPosition({ x: event.pageX + 10, y: event.pageY + 10 })
      })
      .on("mouseout", () => {
        onHighlight(null)
        setTooltipVisible(false)
      })
      .on("click", (event, d) => {
        const index = processedData.indexOf(d)
        onSelection([index], event.ctrlKey || event.metaKey)
      })

    // Function to update paths - memoized to prevent recreation on each render
    const updatePaths = (
      g: d3.Selection<SVGGElement, unknown, null, undefined>,
      x: d3.ScalePoint<string>,
      y: any,
      dims: string[],
    ) => {
      // Update background lines
      g.selectAll(".background-lines path").attr("d", (d: any) => {
        return d3.line()(
          dims.map((dimension) => {
            return [x(dimension) || 0, y[dimension](d[dimension] || 0)]
          }),
        )
      })

      // Update foreground lines
      g.selectAll(".foreground-lines path").attr("d", (d: any) => {
        return d3.line()(
          dims.map((dimension) => {
            return [x(dimension) || 0, y[dimension](d[dimension] || 0)]
          }),
        )
      })
    }

    // Add axes
    const axes = g
      .selectAll(".dimension")
      .data(sortedDimensions)
      .join("g")
      .attr("class", (d) => `dimension dimension-${d.replace(/\s+/g, "-").toLowerCase()}`)
      .attr("transform", (d) => `translate(${x(d)}, 0)`)
      .call(
        d3
          .drag<SVGGElement, string>()
          .subject((d) => ({ x: x(d) || 0 }))
          .on("start", function (event, d) {
            setDragging({ dimension: d, x: event.x })
            d3.select(this).raise().classed("active", true)
          })
          .on("drag", function (event, d) {
            // Move the axis visually during drag
            d3.select(this).attr("transform", `translate(${event.x}, 0)`)

            // Find the new position in the order
            const xPos = event.x
            let newPos = dimensionPositions.get(d) || 0

            sortedDimensions.forEach((dim) => {
              if (dim !== d) {
                const dimX = x(dim) || 0
                if ((dimensionPositions.get(d) || 0) < (dimensionPositions.get(dim) || 0) && xPos > dimX) {
                  // Moving right
                  newPos = Math.max(newPos, (dimensionPositions.get(dim) || 0) + 0.1)
                } else if ((dimensionPositions.get(d) || 0) > (dimensionPositions.get(dim) || 0) && xPos < dimX) {
                  // Moving left
                  newPos = Math.min(newPos, (dimensionPositions.get(dim) || 0) - 0.1)
                }
              }
            })

            // Update position
            const newPositions = new Map(dimensionPositions)
            newPositions.set(d, newPos)
            setDimensionPositions(newPositions)

            // Update paths during drag for immediate feedback
            const newSortedDimensions = [...dimensions].sort((a, b) => {
              if (a === d) return newPos - (dimensionPositions.get(b) || 0)
              if (b === d) return (dimensionPositions.get(a) || 0) - newPos
              return (dimensionPositions.get(a) || 0) - (dimensionPositions.get(b) || 0)
            })

            updatePaths(g, x, y, newSortedDimensions)
          })
          .on("end", function (event, d) {
            d3.select(this).classed("active", false)
            setDragging(null)

            // Normalize positions to be integers
            const sortedDims = [...dimensions].sort((a, b) => {
              return (dimensionPositions.get(a) || 0) - (dimensionPositions.get(b) || 0)
            })

            const normalizedPositions = new Map<string, number>()
            sortedDims.forEach((dim, i) => {
              normalizedPositions.set(dim, i)
            })
            setDimensionPositions(normalizedPositions)

            // Update x scale domain
            x.domain(sortedDims)

            // Animate axes to their final positions
            g.selectAll(".dimension")
              .transition()
              .duration(500)
              .attr("transform", (d) => `translate(${x(d)}, 0)`)

            // Update paths with animation
            g.selectAll(".background-lines path")
              .transition()
              .duration(500)
              .attr("d", (d: any) => {
                return d3.line()(
                  sortedDims.map((dimension) => {
                    return [x(dimension) || 0, y[dimension](d[dimension] || 0)]
                  }),
                )
              })

            g.selectAll(".foreground-lines path")
              .transition()
              .duration(500)
              .attr("d", (d: any) => {
                return d3.line()(
                  sortedDims.map((dimension) => {
                    return [x(dimension) || 0, y[dimension](d[dimension] || 0)]
                  }),
                )
              })
          }),
      )

    // Add axis lines
    axes
      .append("g")
      .attr("class", "axis")
      .each(function (d) {
        d3.select(this).call(d3.axisLeft(y[d]).ticks(5))
      })
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll(".tick line").attr("stroke", "#aaa").attr("stroke-dasharray", "2,2"))
      .call((g) => g.selectAll(".tick text").attr("fill", "#fff").attr("font-size", "10px"))

    // Add axis titles with drag indicator and rotation
    const axisTitles = axes.append("g").attr("class", "axis-title").attr("transform", "translate(0, -30)")

    axisTitles
      .append("text")
      .attr("x", 30)
      .attr("y", 8)
      .attr("text-anchor", "end")
      .attr("fill", "white")
      .text((d) => d.replace(" raw value", ""))
      .attr("font-size", "12px")
      .attr("cursor", "move")
      .attr("transform", "rotate(-13)")
      .attr("dy", "0.5em")
      .append("title")
      .text("Drag to reorder axes")

    // Add drag indicator
    axisTitles
      .append("path")
      .attr("d", "M-5,-5 L5,-5 M-5,0 L5,0 M-5,5 L5,5")
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("opacity", 0.5)
      .attr("transform", "translate(0, -10)")
      .attr("cursor", "move")

    // Add vertical lines for each dimension
    axes
      .append("line")
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", "#aaa")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2")

    // Function to update highlighting
    function updateHighlighting() {
      foregroundLines
        .attr("stroke-width", (d, i) => {
          const fips = d.FIPS
          if (i === highlightedIndex || fips === highlightedFIPS || selectedIndices.includes(i)) {
            return 3
          }
          return 1.5
        })
        .attr("opacity", (d, i) => {
          if (selectedIndices.length === 0) return 0.7
          return i === highlightedIndex || d.FIPS === highlightedFIPS || selectedIndices.includes(i) ? 1 : 0.1
        })
        .attr("stroke", (d, i) => {
          if (i === highlightedIndex || d.FIPS === highlightedFIPS) {
            return "#00ffff" // Cyan for highlighting
          }
          if (selectedIndices.includes(i)) {
            return "#ff00ff" // Magenta for selection
          }
          return colorScale(clusters[i].toString())
        })
        .attr("z-index", (d, i) => {
          if (i === highlightedIndex || d.FIPS === highlightedFIPS || selectedIndices.includes(i)) {
            return 10
          }
          return 1
        })
        .sort((a, i) => {
          // Bring highlighted and selected lines to front
          const idx = processedData.indexOf(a)
          if (idx === highlightedIndex || a.FIPS === highlightedFIPS || selectedIndices.includes(idx)) {
            return 1
          }
          return -1
        })
    }

    // Initial highlighting
    updateHighlighting()

    // Add legend
    const legend = svg.append("g").attr("transform", `translate(${width - margin.right + 10}, ${margin.top})`)

    const uniqueClusters = [...new Set(clusters)].sort((a, b) => a - b)

    uniqueClusters.forEach((cluster, i) => {
      const legendRow = legend.append("g").attr("transform", `translate(0, ${i * 20})`)

      legendRow.append("rect").attr("width", 10).attr("height", 10).attr("fill", colorScale(cluster.toString()))

      legendRow
        .append("text")
        .attr("x", 15)
        .attr("y", 9)
        .attr("fill", "white")
        .attr("font-size", "10px")
        .text(`C-${cluster}`)
    })

    // Add instructions
    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", height - 5)
      .attr("fill", "white")
      .attr("font-size", "10px")
      .attr("opacity", 0.7)
      .text("Hover over lines to see details, click to select, drag axis labels to reorder")

    // Update highlighting when selection changes
    return () => {
      updateHighlighting()
    }
  }, [
    processedData,
    clusters,
    selectedIndices,
    highlightedIndex,
    highlightedFIPS,
    onSelection,
    onHighlight,
    selectedMetric,
    dimensions,
    dimensionPositions,
    dragging,
  ])

  // Helper function to format values
  function formatValue(value: any, dimension: string): string {
    if (value === undefined || value === null) return "N/A"

    if (typeof value === "number") {
      if (dimension.includes("Income")) {
        return `$${value.toLocaleString()}`
      } else if (value >= 0 && value <= 1 && !dimension.includes("Index")) {
        return `${(value * 100).toFixed(1)}%`
      } else {
        return value.toLocaleString()
      }
    }

    return value.toString()
  }

  return (
    <div className="relative w-full h-full p-2">
      <svg ref={svgRef} width="100%" height="100%" />

      {/* Custom tooltip */}
      {tooltipVisible && (
        <div
          className="tooltip-custom absolute"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
          }}
          dangerouslySetInnerHTML={{ __html: tooltipContent }}
        />
      )}
    </div>
  )
}
