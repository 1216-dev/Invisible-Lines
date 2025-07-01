"use client"

import { useRef, useEffect, useContext, useState } from "react"
import * as d3 from "d3"
import { DataContext } from "@/lib/data-context"
import { useMetricSync } from "./metric-sync-provider"

export default function BrushableScatterPlot() {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const {
    processedData,
    selectedIndices,
    highlightedIndex,
    highlightedFIPS,
    compositeBurdenIndex,
    onSelection,
    onHighlight,
  } = useContext(DataContext)

  // Use the synchronized metrics
  const { primaryMetric, secondaryMetric, setPrimaryMetric, setSecondaryMetric, availableMetrics } = useMetricSync()

  const [tooltipContent, setTooltipContent] = useState<string>("")
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false)
  const [brushing, setBrushing] = useState(false)

  // Optimize the brushable scatter plot for better performance
  useEffect(() => {
    if (!svgRef.current || processedData.length === 0 || !primaryMetric || !secondaryMetric) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const margin = { top: 40, right: 100, bottom: 60, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Filter data with valid values
    const validData = processedData.filter(
      (d) =>
        d[primaryMetric] !== undefined &&
        d[secondaryMetric] !== undefined &&
        !isNaN(+d[primaryMetric]) &&
        !isNaN(+d[secondaryMetric]),
    )

    // Limit the number of points for better performance
    const maxPoints = 1000
    const pointsToRender =
      validData.length > maxPoints
        ? validData.filter((_, i) => i % Math.ceil(validData.length / maxPoints) === 0)
        : validData

    // Create scales
    const xExtent = d3.extent(pointsToRender, (d) => +d[primaryMetric]) as [number, number]
    const yExtent = d3.extent(pointsToRender, (d) => +d[secondaryMetric]) as [number, number]

    const xScale = d3
      .scaleLinear()
      .domain([Math.min(0, xExtent[0]), xExtent[1] * 1.05])
      .range([0, innerWidth])

    const yScale = d3
      .scaleLinear()
      .domain([Math.min(0, yExtent[0]), yExtent[1] * 1.05])
      .range([innerHeight, 0])

    // Create color scale for health burden
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, 1])

    // Create main group
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`)

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

    // Add axes
    const xAxis = d3.axisBottom(xScale)
    const yAxis = d3.axisLeft(yScale)

    // Format axes based on metric type
    if (primaryMetric.includes("Income")) {
      xAxis.tickFormat((d) => `$${d3.format(",.0f")(+d)}`)
    } else if (primaryMetric.includes("raw value") && !primaryMetric.includes("Index")) {
      const maxX = Math.max(...pointsToRender.map((d) => +d[primaryMetric]))
      if (maxX <= 1) {
        xAxis.tickFormat((d) => `${(+d * 100).toFixed(0)}%`)
      }
    }

    if (secondaryMetric.includes("Income")) {
      yAxis.tickFormat((d) => `${d3.format(",.0f")(+d)}`)
    } else if (secondaryMetric.includes("raw value") && !secondaryMetric.includes("Index")) {
      const maxY = Math.max(...pointsToRender.map((d) => +d[secondaryMetric]))
      if (maxY <= 1) {
        yAxis.tickFormat((d) => `${(+d * 100).toFixed(0)}%`)
      }
    }

    g.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(xAxis)
      .append("text")
      .attr("x", innerWidth / 2 - 25)
      .attr("y", 40)
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .text(formatMetricName(primaryMetric))

    g.append("g")
      .call(yAxis)
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -40)
      .attr("x", -innerHeight / 2)
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .text(formatMetricName(secondaryMetric))

    // Add points
    g.selectAll("circle")
      .data(pointsToRender)
      .join("circle")
      .attr("cx", (d) => xScale(+d[primaryMetric]))
      .attr("cy", (d) => yScale(+d[secondaryMetric]))
      .attr("r", (d) => {
        const burden = compositeBurdenIndex[d.FIPS] || 0.5
        return 3 + burden * 5
      })
      .attr("fill", (d) => {
        const burden = compositeBurdenIndex[d.FIPS] || 0.5
        return colorScale(burden)
      })
      .attr("stroke", "white")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.7)
      .attr("data-index", (d, i) => processedData.indexOf(d))
      .attr("data-fips", (d) => d.FIPS || "")
      .on("mouseover", (event, d) => {
        if (brushing) return // Skip if currently brushing

        const index = processedData.indexOf(d)
        onHighlight(index, d.FIPS)

        // Format tooltip content
        let content = `<div class="font-medium">${d.Name}, ${d["State Abbreviation"]}</div>`
        content += `<div class="text-xs text-gray-500">FIPS: ${d.FIPS}</div>`

        // Add X metric
        const xValue = formatValue(d[primaryMetric], primaryMetric)
        content += `<div class="mt-1">${formatMetricName(primaryMetric)}: <span class="font-medium">${xValue}</span></div>`

        // Add Y metric
        const yValue = formatValue(d[secondaryMetric], secondaryMetric)
        content += `<div class="mt-1">${formatMetricName(secondaryMetric)}: <span class="font-medium">${yValue}</span></div>`

        // Add health burden index
        if (compositeBurdenIndex[d.FIPS] !== undefined) {
          content += `<div class="mt-1">Health Burden Index: <span class="font-medium">${(compositeBurdenIndex[d.FIPS] * 100).toFixed(1)}%</span></div>`
        }

        setTooltipContent(content)
        setTooltipPosition({ x: event.pageX, y: event.pageY })
        setTooltipVisible(true)
      })
      .on("mousemove", (event) => {
        if (!brushing) {
          setTooltipPosition({ x: event.pageX + 10, y: event.pageY + 10 })
        }
      })
      .on("mouseout", (event) => {
        if (!brushing) {
          onHighlight(null)
          setTooltipVisible(false)
        }
      })
      .on("click", (event, d) => {
        const index = processedData.indexOf(d)
        onSelection([index], event.ctrlKey || event.metaKey)
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
        setBrushing(true)
        setTooltipVisible(false)
      })
      .on("brush", (event) => {
        // Provide immediate visual feedback during brushing
        if (!event.selection) return

        const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]]

        g.selectAll("circle").attr("stroke", (d) => {
          const cx = xScale(+d[primaryMetric])
          const cy = yScale(+d[secondaryMetric])
          if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
            return "#00ffff" // Highlight points in the brush area
          }
          const index = processedData.indexOf(d)
          if (selectedIndices.includes(index)) {
            return "#ff00ff" // Keep previously selected points highlighted
          }
          return "#fff"
        })
      })
      .on("end", (event) => {
        setBrushing(false)

        if (!event.selection) return

        const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]]

        const selected = pointsToRender.filter((d) => {
          const cx = xScale(+d[primaryMetric])
          const cy = yScale(+d[secondaryMetric])
          return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1
        })

        const selectedIndices = selected.map((d) => processedData.indexOf(d))
        onSelection(selectedIndices, event.sourceEvent?.ctrlKey || event.sourceEvent?.metaKey)

        // Clear brush
        g.select(".brush").call(brush.move, null)
      })

    g.append("g").attr("class", "brush").call(brush)

    // Add legend for health burden
    const legendWidth = 200
    const legendHeight = 10
    const legendX = 150
    const legendY = 180

    const legend = svg.append("g").attr("transform", `translate(${margin.left + legendX}, ${margin.top + legendY})`)

    // Create gradient
    const defs = svg.append("defs")
    const gradient = defs
      .append("linearGradient")
      .attr("id", "burden-gradient-scatter")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%")

    gradient
      .selectAll("stop")
      .data(d3.range(0, 1.01, 0.1))
      .enter()
      .append("stop")
      .attr("offset", (d) => `${d * 100}%`)
      .attr("stop-color", (d) => colorScale(d))

    // Draw legend rectangle
    legend
      .append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#burden-gradient-scatter)")

    // Add legend axis
    const legendScale = d3.scaleLinear().domain([0, 1]).range([0, legendWidth])
    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(5)
      .tickFormat((d) => `${(+d * 100).toFixed(0)}%`)

    legend
      .append("g")
      .attr("transform", `translate(0, ${legendHeight})`)
      .call(legendAxis)
      .selectAll("text")
      .attr("fill", "white")
      .attr("font-size", "8px")

    // Add legend title
    legend
      .append("text")
      .attr("x", 0)
      .attr("y", -5)
      .attr("fill", "white")
      .attr("font-size", "10px")
      .text("Health Burden Index")

    // X-axis selector
    const xSelector = svg.append("g").attr("transform", `translate(${margin.left}, -5)`)

    xSelector.append("text").attr("x", -26).attr("y", 21).attr("fill", "white").attr("font-size", "10px").text("X:")

    const xDropdown = xSelector
      .append("foreignObject")
      .attr("x", -15)
      .attr("y", 5)
      .attr("width", 150)
      .attr("height", 30)
      .append("xhtml:select")
      .attr("class", "bg-slate-800 text-white text-xs p-1 border border-slate-700 rounded w-full")
      .on("change", function () {
        setPrimaryMetric(this.value)
      })

    xDropdown
      .selectAll("option")
      .data(availableMetrics)
      .enter()
      .append("xhtml:option")
      .attr("value", (d) => d)
      .property("selected", (d) => d === primaryMetric)
      .text((d) => formatMetricName(d))

    // Y-axis selector
    const ySelector = svg.append("g").attr("transform", `translate(${margin.left + 220}, 10)`)

    ySelector.append("text").attr("x", -70).attr("y", 8).attr("fill", "white").attr("font-size", "10px").text("Y:")

    const yDropdown = ySelector
      .append("foreignObject")
      .attr("x", -60)
      .attr("y", -10)
      .attr("width", 150)
      .attr("height", 30)
      .append("xhtml:select")
      .attr("class", "bg-slate-800 text-white text-xs p-1 border border-slate-700 rounded w-full")
      .on("change", function () {
        setSecondaryMetric(this.value)
      })

    yDropdown
      .selectAll("option")
      .data(availableMetrics)
      .enter()
      .append("xhtml:option")
      .attr("value", (d) => d)
      .property("selected", (d) => d === secondaryMetric)
      .text((d) => formatMetricName(d))

    // Update selection highlighting
    function updateSelection() {
      g.selectAll("circle")
        .attr("stroke", (d) => {
          const index = processedData.indexOf(d)
          if (index === highlightedIndex || d.FIPS === highlightedFIPS) return "#00ffff" // Cyan for highlighting
          if (selectedIndices.includes(index)) return "#ff00ff" // Magenta for selection
          return "#fff"
        })
        .attr("stroke-width", (d) => {
          const index = processedData.indexOf(d)
          if (index === highlightedIndex || d.FIPS === highlightedFIPS || selectedIndices.includes(index)) return 2.5
          return 0.5
        })
        .attr("opacity", (d) => {
          const index = processedData.indexOf(d)
          if (selectedIndices.length === 0) return 0.7
          return selectedIndices.includes(index) || index === highlightedIndex || d.FIPS === highlightedFIPS ? 1 : 0.15
        })
    }

    // Call updateSelection initially
    updateSelection()

    // Update selection when it changes
    return () => {
      updateSelection()
    }
  }, [
    processedData,
    primaryMetric,
    secondaryMetric,
    compositeBurdenIndex,
    onSelection,
    onHighlight,
    availableMetrics,
    setPrimaryMetric,
    setSecondaryMetric,
  ])

  // Effect to update highlighting when selection changes
  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const g = svg.select("g")

    if (!g.empty()) {
      g.selectAll("circle")
        .attr("stroke", (d) => {
          const index = processedData.indexOf(d)
          if (index === highlightedIndex || d.FIPS === highlightedFIPS) return "#00ffff" // Cyan for highlighting
          if (selectedIndices.includes(index)) return "#ff00ff" // Magenta for selection
          return "#fff"
        })
        .attr("stroke-width", (d) => {
          const index = processedData.indexOf(d)
          if (index === highlightedIndex || d.FIPS === highlightedFIPS || selectedIndices.includes(index)) return 2.5
          return 0.5
        })
        .attr("opacity", (d) => {
          const index = processedData.indexOf(d)
          if (selectedIndices.length === 0) return 0.7
          return selectedIndices.includes(index) || index === highlightedIndex || d.FIPS === highlightedFIPS ? 1 : 0.15
        })
    }
  }, [selectedIndices, highlightedIndex, highlightedFIPS, processedData])

  // Helper function to format metric names
  function formatMetricName(metricName: string): string {
    if (metricName === "POPESTIMATE2023") return "Population"
    return metricName.replace(" raw value", "")
  }

  // Helper function to format values based on metric type
  function formatValue(value: any, metricName: string): string {
    if (value === undefined || value === null) return "N/A"

    if (typeof value === "number") {
      if (metricName.includes("Income")) {
        return `$${formatNumber(value)}`
      } else if (value >= 0 && value <= 1 && !metricName.includes("Index")) {
        return `${(value * 100).toFixed(1)}%`
      } else {
        return value.toLocaleString()
      }
    }

    return value.toString()
  }

  // Helper function to format numbers with commas
  function formatNumber(num: number): string {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }

  useEffect(() => {
    if (!tooltipRef.current) {
      const tooltipDiv = document.createElement("div")
      tooltipDiv.className = "tooltip-custom"
      tooltipDiv.style.display = "none"
      document.body.appendChild(tooltipDiv)
      tooltipRef.current = tooltipDiv
    }

    return () => {
      if (tooltipRef.current && document.body.contains(tooltipRef.current)) {
        document.body.removeChild(tooltipRef.current)
      }
    }
  }, [])

  // Update tooltip content and position
  useEffect(() => {
    if (!tooltipRef.current) return

    if (tooltipVisible) {
      tooltipRef.current.innerHTML = tooltipContent
      tooltipRef.current.style.display = "block"
      tooltipRef.current.style.left = `${tooltipPosition.x}px`
      tooltipRef.current.style.top = `${tooltipPosition.y}px`
    } else {
      tooltipRef.current.style.display = "none"
    }
  }, [tooltipVisible, tooltipContent, tooltipPosition])

  return (
    <div className="relative w-full h-full p-4">
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  )
}
