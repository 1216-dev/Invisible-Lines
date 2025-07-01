"use client"

import { useRef, useEffect, useContext, useState, useCallback } from "react"
import * as d3 from "d3"
import { DataContext } from "@/lib/data-context"

export default function PCAScatterPlot() {
  const svgRef = useRef<SVGSVGElement>(null)
  const {
    pcaData,
    clusters,
    selectedIndices,
    highlightedIndex,
    highlightedFIPS,
    onSelection,
    onHighlight,
    processedData,
    compositeBurdenIndex,
    selectedFeatures,
  } = useContext(DataContext)
  const [tooltipContent, setTooltipContent] = useState<string>("")
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false)

  const updateSelection = useCallback(
    (g: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      if (!g || g.empty()) return

      g.selectAll("circle")
        .attr("stroke", (d) => {
          const fips = processedData[d.index]?.FIPS
          if (d.index === highlightedIndex || fips === highlightedFIPS) return "#00ffff" // Cyan for highlighting
          if (selectedIndices.includes(d.index)) return "#ff00ff" // Magenta for selection
          return "#fff"
        })
        .attr("stroke-width", (d) => {
          const fips = processedData[d.index]?.FIPS
          if (d.index === highlightedIndex || fips === highlightedFIPS || selectedIndices.includes(d.index)) return 2.5
          return 0.5
        })
        .attr("opacity", (d) => {
          const fips = processedData[d.index]?.FIPS
          if (selectedIndices.length === 0) return 0.7
          return selectedIndices.includes(d.index) || d.index === highlightedIndex || fips === highlightedFIPS
            ? 1
            : 0.15
        })
    },
    [processedData, highlightedIndex, highlightedFIPS, selectedIndices],
  )

  useEffect(() => {
    if (!svgRef.current || pcaData.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const margin = { top: 20, right: 20, bottom: 40, left: 50 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Create scales
    const xExtent = d3.extent(pcaData, (d) => d.pc1) as [number, number]
    const yExtent = d3.extent(pcaData, (d) => d.pc2) as [number, number]

    const xScale = d3
      .scaleLinear()
      .domain([xExtent[0] - Math.abs(xExtent[0] * 0.1), xExtent[1] + Math.abs(xExtent[1] * 0.1)])
      .range([0, innerWidth])

    const yScale = d3
      .scaleLinear()
      .domain([yExtent[0] - Math.abs(yExtent[0] * 0.1), yExtent[1] + Math.abs(yExtent[1] * 0.1)])
      .range([innerHeight, 0])

    // Create color scale for clusters
    const colorScale = d3
      .scaleOrdinal()
      .domain([...new Set(clusters)].map(String))
      .range(d3.schemeTableau10)

    // Create main group
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`)

    // Add axes
    const xAxis = d3.axisBottom(xScale)
    const yAxis = d3.axisLeft(yScale)

    g.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(xAxis)
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 25.5)
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .text("PC 1")

    g.append("g")
      .call(yAxis)
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -35)
      .attr("x", -innerHeight / 2)
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .text("PC 2")

    // Add grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-innerHeight)
          .tickFormat(() => ""),
      )
      .attr("color", "rgba(255, 255, 255, 0.1)")

    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => ""),
      )
      .attr("color", "rgba(255, 255, 255, 0.1)")

    // Limit the number of points for better performance
    const maxPoints = 1000
    const pointsToRender =
      pcaData.length > maxPoints ? pcaData.filter((_, i) => i % Math.ceil(pcaData.length / maxPoints) === 0) : pcaData

    // Add points
    g.selectAll("circle")
      .data(pointsToRender)
      .join("circle")
      .attr("cx", (d) => xScale(d.pc1))
      .attr("cy", (d) => yScale(d.pc2))
      .attr("r", 4)
      .attr("fill", (d, i) => {
        const clusterIndex = Math.floor(i * (pcaData.length / pointsToRender.length))
        return colorScale(clusters[clusterIndex].toString())
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.7)
      .attr("data-fips", (d) => processedData[d.index]?.FIPS || "")
      .on("mouseover", (event, d) => {
        // Highlight the point
        d3.select(event.currentTarget).attr("r", 6).attr("stroke-width", 2).raise() // Bring to front

        const fips = processedData[d.index]?.FIPS
        onHighlight(d.index, fips)

        // Format tooltip content
        const county = processedData[d.index]
        if (county) {
          let content = `<div class="font-medium">${county.Name}, ${county["State Abbreviation"]}</div>`
          content += `<div class="text-xs text-gray-500">FIPS: ${county.FIPS}</div>`
          content += `<div class="mt-1">Cluster: <span class="font-medium">${clusters[d.index]}</span></div>`
          content += `<div class="mt-1">PC1: <span class="font-medium">${d.pc1.toFixed(2)}</span>, PC2: <span class="font-medium">${d.pc2.toFixed(2)}</span></div>`

          // Add more health metrics if available
          const healthMetrics =
            selectedFeatures.length > 0
              ? selectedFeatures
              : [
                  "Adult Obesity raw value",
                  "Food Insecurity raw value",
                  "Physical Inactivity raw value",
                  "Median Household Income raw value",
                ]

          content += `<div class="mt-2 pt-1 border-t border-gray-700"></div>`

          healthMetrics.forEach((metric) => {
            if (county[metric] !== undefined) {
              const value = county[metric]
              const formattedValue = metric.includes("Income")
                ? `$${Number(value).toLocaleString()}`
                : value <= 1 && value >= 0
                  ? `${(value * 100).toFixed(1)}%`
                  : value

              content += `<div class="mt-1">${metric.replace(" raw value", "")}: <span class="font-medium">${formattedValue}</span></div>`
            }
          })

          // Add health burden if available
          if (county.FIPS && compositeBurdenIndex[county.FIPS]) {
            content += `<div class="mt-1 text-cyan-400">Health Burden: <span class="font-medium">${(compositeBurdenIndex[county.FIPS] * 100).toFixed(1)}%</span></div>`
          }

          setTooltipContent(content)
          setTooltipPosition({ x: event.pageX + 15, y: event.pageY - 10 })
          setTooltipVisible(true)
        }
      })
      .on("mousemove", (event) => {
        setTooltipPosition({ x: event.pageX + 10, y: event.pageY + 10 })
      })
      .on("mouseout", (event) => {
        // Don't modify the element directly here, let updateSelection handle it
        onHighlight(null)
        setTooltipVisible(false)
      })
      .on("click", (event, d) => {
        if (processedData[d.index]) {
          onSelection([d.index], event.ctrlKey || event.metaKey)
          console.log("Selected PCA point:", processedData[d.index]?.Name, "Index:", d.index)
        }
      })

    // Add brush
    const brush = d3
      .brush()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .on("start", () => {
        // Clear tooltip when starting brush
        setTooltipVisible(false)
      })
      .on("brush", (event) => {
        // Provide immediate visual feedback during brushing
        if (!event.selection) return

        const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]]

        g.selectAll("circle").attr("stroke", (d) => {
          const cx = xScale(d.pc1)
          const cy = yScale(d.pc2)
          if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
            return "#00ffff" // Highlight points in the brush area
          }
          if (selectedIndices.includes(d.index)) {
            return "#ff00ff" // Keep previously selected points highlighted
          }
          return "#fff"
        })
      })
      .on("end", (event) => {
        if (!event.selection) return

        const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]]

        const selected = pointsToRender.filter((d) => {
          const cx = xScale(d.pc1)
          const cy = yScale(d.pc2)
          return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1
        })

        onSelection(
          selected.map((d) => d.index),
          event.sourceEvent?.ctrlKey || event.sourceEvent?.metaKey,
        )

        // Clear brush
        g.select(".brush").call(brush.move, null)
      })

    g.append("g").attr("class", "brush").call(brush)

    // Add legend
    const legend = svg.append("g").attr("transform", `translate(${width - 90}, ${margin.top+5})`)

    const uniqueClusters = [...new Set(clusters)].sort((a, b) => a - b)

    uniqueClusters.forEach((cluster, i) => {
      const legendRow = legend.append("g").attr("transform", `translate(0, ${i * 20})`)

      legendRow.append("rect").attr("width", 10).attr("height", 10).attr("fill", colorScale(cluster.toString()))

      legendRow
        .append("text")
        .attr("x", 15)
        .attr("y", 9.5)
        .attr("fill", "white")
        .attr("font-size", "10px")
        .text(`Cluster ${cluster}`)
    })

    // Add features used for PCA
    if (selectedFeatures.length > 0) {
      const featuresText = svg
        .append("text")
        .attr("x", margin.left)
        .attr("y", margin.top - 5)
        .attr("fill", "white")
        .attr("font-size", "10px")
        .attr("opacity", 0.7)
        .text(`Features: Top 10 Features used for PCA`)
    }

    // Add instructions for brushing
    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", height - 5)
      .attr("fill", "white")
      .attr("font-size", "10px")
      .attr("opacity", 0.7)
      .text("Drag to select points (hold Ctrl/Cmd to add to selection)")

    updateSelection(g)
  }, [
    pcaData,
    processedData,
    clusters,
    selectedIndices,
    highlightedIndex,
    highlightedFIPS,
    compositeBurdenIndex,
    onSelection,
    onHighlight,
    updateSelection,
    selectedFeatures,
  ])

  useEffect(() => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      const g = svg.select("g")
      updateSelection(g)
    }
  }, [selectedIndices, highlightedIndex, highlightedFIPS, updateSelection])

  return (
    <div className="relative w-full h-full p-4">
      <svg ref={svgRef} width="100%" height="100%" className="highlight-transition" />

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
