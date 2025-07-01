"use client"

import { useRef, useEffect, useContext, useState } from "react"
import * as d3 from "d3"
import { DataContext } from "@/lib/data-context"

export default function CorrelationMatrix() {
  const svgRef = useRef<SVGSVGElement>(null)
  const { processedData, selectedMetric } = useContext(DataContext)
  const [tooltipContent, setTooltipContent] = useState<string>("")
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false)

  useEffect(() => {
    if (processedData.length > 0) {
      // Log the first data item to see its structure
      console.log("Sample data item:", processedData[0])

      // Check which fields contain numeric values
      const numericFields = Object.entries(processedData[0])
        .filter(([key, value]) => typeof value === "number")
        .map(([key]) => key)

      console.log("Fields with numeric values:", numericFields)
    }
  }, [processedData])

  useEffect(() => {
    if (!svgRef.current || processedData.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const margin = { top: 50, right: 20, bottom: 20, left: 120 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Select metrics to display - modify to use the actual field names in your data
    // Look for both raw values and regular field names
    const allMetrics = Object.keys(processedData[0] || {})

    // Try to find numeric fields in the data
    const numericMetrics = allMetrics.filter((metric) => {
      // Check if this field contains numeric data in at least some rows
      return processedData.some((d) => {
        const val = d[metric]
        return val !== undefined && val !== null && !isNaN(Number(val))
      })
    })

    // Prioritize these health metrics if they exist in the data
    const preferredMetrics = [
      "Adult Obesity",
      "Adult Obesity raw value",
      "Food Insecurity",
      "Food Insecurity raw value",
      "Physical Inactivity",
      "Physical Inactivity raw value",
      "Poor or Fair Health",
      "Poor or Fair Health raw value",
      "Median Household Income",
      "Median Household Income raw value",
      "Children in Poverty",
      "Children in Poverty raw value",
    ]

    // Filter to metrics that actually exist in the data
    const availablePreferredMetrics = preferredMetrics.filter((m) => numericMetrics.includes(m))

    // Use preferred metrics first, then add other numeric metrics if needed
    let metricsToShow = availablePreferredMetrics.length > 0 ? availablePreferredMetrics : numericMetrics

    // Add the selected metric if it's not already in the list
    if (selectedMetric && !metricsToShow.includes(selectedMetric) && numericMetrics.includes(selectedMetric)) {
      metricsToShow = [selectedMetric, ...metricsToShow]
    }

    // Limit to 8 metrics for readability and take unique values
    const metrics = Array.from(new Set(metricsToShow)).slice(0, 8)

    // Log the metrics we're using to help debug
    console.log("Using metrics for correlation matrix:", metrics)

    // Calculate correlation matrix
    const correlationMatrix = calculateCorrelationMatrix(processedData, metrics)

    // Create scales
    const x = d3.scaleBand().range([0, innerWidth]).domain(metrics).padding(0.05)
    const y = d3.scaleBand().range([0, innerHeight]).domain(metrics).padding(0.05)
    const color = d3.scaleLinear<string>().domain([-1, 0, 1]).range(["#4a5568", "#1a202c", "#38b2ac"])

    // Create main group
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`)

    // Add cells
    g.selectAll()
      .data(correlationMatrix)
      .join("rect")
      .attr("x", (d) => x(d.x))
      .attr("y", (d) => y(d.y))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", (d) => (isNaN(d.correlation) ? "#1a202c" : color(d.correlation)))
      .attr("stroke", "#1a202c")
      .attr("stroke-width", 1)
      .on("mouseover", (event, d) => {
        // Format tooltip content
        let content = `<div class="font-medium">Correlation</div>`
        content += `<div class="mt-1">${d.x.replace(" raw value", "")} vs ${d.y.replace(" raw value", "")}</div>`

        if (isNaN(d.correlation)) {
          content += `<div class="mt-1">Value: <span class="font-medium">Not available</span></div>`
        } else {
          content += `<div class="mt-1">r = <span class="font-medium">${d.correlation.toFixed(3)}</span></div>`

          // Add interpretation
          let interpretation = ""
          const absCorr = Math.abs(d.correlation)
          if (absCorr > 0.7) {
            interpretation = "Strong"
          } else if (absCorr > 0.5) {
            interpretation = "Moderate"
          } else if (absCorr > 0.3) {
            interpretation = "Weak"
          } else {
            interpretation = "Very weak"
          }

          content += `<div class="mt-1">Strength: <span class="font-medium">${interpretation}</span></div>`
          content += `<div class="mt-1">Direction: <span class="font-medium">${
            d.correlation > 0 ? "Positive" : d.correlation < 0 ? "Negative" : "None"
          }</span></div>`
        }

        setTooltipContent(content)
        setTooltipPosition({ x: event.pageX, y: event.pageY })
        setTooltipVisible(true)

        // Highlight row and column
        g.selectAll("rect")
          .attr("opacity", (e) => {
            if (e.x === d.x || e.y === d.y) {
              return 1
            }
            return 0.3
          })
          .attr("stroke-width", (e) => {
            if (e === d) {
              return 2
            }
            return 1
          })
      })
      .on("mousemove", (event) => {
        setTooltipPosition({ x: event.pageX + 10, y: event.pageY + 10 })
      })
      .on("mouseout", (event) => {
        setTooltipVisible(false)
        g.selectAll("rect").attr("opacity", 1).attr("stroke-width", 1)
      })

    // Add correlation values
    g.selectAll()
      .data(correlationMatrix)
      .join("text")
      .attr("x", (d) => x(d.x) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.y) + y.bandwidth() / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "10px")
      .attr("fill", (d) => {
        if (isNaN(d.correlation)) return "rgba(255, 255, 255, 0.5)"
        return Math.abs(d.correlation) > 0.5 ? "white" : "rgba(255, 255, 255, 0.7)"
      })
      .text((d) => {
        if (d.x === d.y) return ""
        if (isNaN(d.correlation)) return "N/A"
        return d.correlation.toFixed(2)
      })

    // Add x axis labels
    g.append("g")
      .attr("transform", `translate(0, ${-10})`)
      .selectAll()  
      .data(metrics)
      .join("text")
      .attr("x", (d) => x(d) + x.bandwidth() / 2)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .attr("transform", (d) => `rotate(-20, ${x(d) + x.bandwidth() / 2}, 0)`)
      .attr("font-size", "10px")
      .attr("fill", "white")
      .text((d) => d.replace(" raw value", ""))

    // Add y axis labels
    g.append("g")
      .selectAll()
      .data(metrics)
      .join("text")
      .attr("x", -10)
      .attr("y", (d) => y(d) + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "10px")
      .attr("fill", "white")
      .text((d) => d.replace(" raw value", ""))

    // Add title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("fill", "white")
      .text("Correlation Matrix of Health Metrics")

    // Add legend
    const legendWidth = 200
    const legendHeight = 10
    const legendX = width - legendWidth - 23
    const legendY = 225

    const legend = svg.append("g").attr("transform", `translate(${legendX}, ${legendY})`)

    // Create gradient
    const defs = svg.append("defs")
    const gradient = defs
      .append("linearGradient")
      .attr("id", "correlation-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%")

    gradient
      .selectAll("stop")
      .data([
        { offset: "0%", color: color(-1) },
        { offset: "50%", color: color(0) },
        { offset: "100%", color: color(1) },
      ])
      .join("stop")
      .attr("offset", (d) => d.offset)
      .attr("stop-color", (d) => d.color)

    // Draw legend rectangle
    // legend
    //   .append("rect")
    //   .attr("width", legendWidth)
    //   .attr("height", legendHeight-5)
    //   .style("fill", "url(#correlation-gradient)")

    // Add legend axis
    // const legendScale = d3.scaleLinear().domain([-1, 1]).range([0, legendWidth-10])
    // const legendAxis = d3.axisBottom(legendScale).ticks(5).tickFormat(d3.format(".1f"))

    // legend
    //   .append("g")
    //   .attr("transform", `translate(0, ${legendHeight})`)
    //   .call(legendAxis)
    //   .selectAll("text")
    //   .attr("fill", "white")
    //   .attr("font-size", "8px")

    // Add legend title
    // legend
    //   .append("text")
    //   .attr("x", 0)
    //   .attr("y", 220)
    //   .attr("fill", "white")
    //   .attr("font-size", "10px")
    //   .text("Correlation Coefficient (r)")
  }, [processedData, selectedMetric])

  // Calculate correlation matrix
  function calculateCorrelationMatrix(data: any[], metrics: string[]) {
    const result = []

    for (const y of metrics) {
      for (const x of metrics) {
        const correlation = calculateCorrelation(data, x, y)
        result.push({ x, y, correlation })
      }
    }

    return result
  }

  // Calculate correlation between two variables
  function calculateCorrelation(data: any[], xMetric: string, yMetric: string) {
    // Extract values and ensure we're working with numbers
    const pairs = data
      .map((d) => {
        const x = typeof d[xMetric] === "string" ? Number.parseFloat(d[xMetric]) : d[xMetric]
        const y = typeof d[yMetric] === "string" ? Number.parseFloat(d[yMetric]) : d[yMetric]
        return { x, y }
      })
      .filter(
        (d) => d.x !== undefined && d.y !== undefined && !isNaN(d.x) && !isNaN(d.y) && d.x !== null && d.y !== null,
      )

    // Need at least 2 pairs to calculate correlation
    if (pairs.length < 2) return Number.NaN

    // Calculate means
    const xMean = pairs.reduce((sum, d) => sum + d.x, 0) / pairs.length
    const yMean = pairs.reduce((sum, d) => sum + d.y, 0) / pairs.length

    // Calculate correlation
    let numerator = 0
    let xDenominator = 0
    let yDenominator = 0

    for (const pair of pairs) {
      const xDiff = pair.x - xMean
      const yDiff = pair.y - yMean
      numerator += xDiff * yDiff
      xDenominator += xDiff * xDiff
      yDenominator += yDiff * yDiff
    }

    if (xDenominator === 0 || yDenominator === 0) return Number.NaN

    return numerator / Math.sqrt(xDenominator * yDenominator)
  }

  return (
    <div className="relative w-full h-full p-4">
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
