"use client"

import { useRef, useEffect, useContext, useState } from "react"
import * as d3 from "d3"
import { DataContext } from "@/lib/data-context"

export default function ClusterDistribution() {
  const svgRef = useRef<SVGSVGElement>(null)
  const { processedData, clusters, selectedIndices, highlightedIndex, highlightedFIPS, onSelection, onHighlight } =
    useContext(DataContext)
  const [tooltipContent, setTooltipContent] = useState<string>("")
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false)

  useEffect(() => {
    if (!svgRef.current || processedData.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const margin = { top: 20, right: 120, bottom: 20, left: 20 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Count clusters
    const clusterCounts = {}
    clusters.forEach((cluster) => {
      clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1
    })

    // Create data for pie chart
    const pieData = Object.entries(clusterCounts).map(([cluster, count]) => ({
      cluster,
      count,
      percentage: (count / clusters.length) * 100,
    }))

    // Create color scale for clusters
    const colorScale = d3
      .scaleOrdinal()
      .domain([...new Set(clusters)].map(String))
      .range(d3.schemeTableau10)

    // Create pie layout
    const pie = d3
      .pie<any>()
      .value((d) => d.count)
      .sort(null)

    const arcs = pie(pieData)

    // Create arc generator
    const radius = Math.min(innerWidth, innerHeight) / 2
    const arc = d3
      .arc<any>()
      .innerRadius(radius * 0.4)
      .outerRadius(radius * 0.8)

    // Create main group
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left + innerWidth / 2}, ${margin.top + innerHeight / 2})`)

    // Add arcs
    g.selectAll("path")
      .data(arcs)
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => colorScale(d.data.cluster))
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("data-cluster", (d) => d.data.cluster)
      .on("mouseover", (event, d) => {
        // Don't modify the element directly here, let updateSelection handle it

        // Highlight all counties in this cluster
        const clusterIndices = processedData.map((_, i) => i).filter((i) => clusters[i] === +d.data.cluster)
        if (clusterIndices.length > 0) {
          // Just highlight the first one to trigger cross-visualization highlighting
          onHighlight(clusterIndices[0])
        }

        // Format tooltip content
        let content = `<div class="font-medium">Cluster ${d.data.cluster}</div>`
        content += `<div class="mt-1">Counties: <span class="font-medium">${d.data.count}</span></div>`
        content += `<div class="mt-1">Percentage: <span class="font-medium">${d.data.percentage.toFixed(1)}%</span></div>`

        // Add top counties in this cluster
        const clusterCounties = processedData
          .filter((_, i) => clusters[i] === +d.data.cluster)
          .slice(0, 3)
          .map((county) => `${county.Name}, ${county["State Abbreviation"]}`)
          .join(", ")

        if (clusterCounties) {
          content += `<div class="mt-1 text-xs">Examples: <span class="font-medium">${clusterCounties}</span></div>`
        }

        setTooltipContent(content)
        setTooltipPosition({ x: event.pageX, y: event.pageY })
        setTooltipVisible(true)
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
        // Select all counties in this cluster
        const clusterIndices = processedData.map((_, i) => i).filter((i) => clusters[i] === +d.data.cluster)
        onSelection(clusterIndices, event.ctrlKey || event.metaKey)
      })

    // Add labels
    g.selectAll("text.percentage")
      .data(arcs)
      .join("text")
      .attr("class", "percentage")
      .attr("transform", (d) => `translate(${arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "12px")
      .text((d) => `${d.data.percentage.toFixed(0)}%`)

    // Add legend
    const legend = svg.append("g").attr("transform", `translate(${width - margin.right + 10}, ${margin.top})`)

    pieData.forEach((d, i) => {
      const legendRow = legend.append("g").attr("transform", `translate(0, ${i * 20})`)

      legendRow.append("rect").attr("width", 10).attr("height", 10).attr("fill", colorScale(d.cluster))

      legendRow
        .append("text")
        .attr("x", 15)
        .attr("y", 9)
        .attr("fill", "white")
        .attr("font-size", "10px")
        .text(`Cluster ${d.cluster} (${d.percentage.toFixed(1)}%)`)
    })

    // Add instructions
    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", height - 5)
      .attr("fill", "white")
      .attr("font-size", "10px")
      .attr("opacity", 0.7)
      .text("Click on a segment to select all counties in that cluster")

    // Update the updateSelection function to handle highlightedFIPS
    function updateSelection() {
      g.selectAll("path[data-cluster]").each(function () {
        const cluster = d3.select(this).attr("data-cluster")

        // Check if any county in this cluster is highlighted by FIPS
        const hasHighlightedFIPS =
          highlightedFIPS && processedData.some((d, i) => d.FIPS === highlightedFIPS && clusters[i] === +cluster)

        // Check if any county in this cluster is selected
        const clusterIndices = processedData.map((_, i) => i).filter((i) => clusters[i] === +cluster)
        const hasSelected = clusterIndices.some((i) => selectedIndices.includes(i))

        // Check if any county in this cluster is highlighted by index
        const hasHighlightedIndex = highlightedIndex !== null && clusters[highlightedIndex] === +cluster

        d3.select(this)
          .attr("opacity", (d) => {
            if (selectedIndices.length === 0) return 1
            return hasSelected || hasHighlightedIndex || hasHighlightedFIPS ? 1 : 0.15
          })
          .attr("stroke", (d) => {
            if (hasHighlightedIndex || hasHighlightedFIPS) return "#00ffff" // Cyan for highlighting
            if (hasSelected) return "#ff00ff" // Magenta for selection
            return "white"
          })
          .attr("stroke-width", (d) => {
            return hasSelected || hasHighlightedIndex || hasHighlightedFIPS ? 3 : 1
          })
      })
    }

    // Update selection when it changes
    updateSelection()

    return () => {
      updateSelection()
    }
  }, [processedData, clusters, selectedIndices, highlightedIndex, highlightedFIPS, onSelection, onHighlight])

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
