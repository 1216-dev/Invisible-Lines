"use client"

import { useEffect, useRef, useContext } from "react"
import * as d3 from "d3"
import { DataContext } from "@/lib/data-context"

export default function IncomeVsPoverty() {
  const svgRef = useRef<SVGSVGElement>(null)
  const { processedData, clusters, selectedIndices, healthBurdenIndex, onSelection } = useContext(DataContext)

  useEffect(() => {
    if (!svgRef.current || processedData.length === 0) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const margin = { top: 20, right: 20, bottom: 40, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Clear previous content
    svg.selectAll("*").remove()

    // Get income and poverty data
    const incomeKey = "Median Household Income raw value"
    const povertyKey = "Children in Poverty raw value"

    // Filter data with valid values
    const validData = processedData.filter(
      (d) =>
        d[incomeKey] !== undefined && d[povertyKey] !== undefined && !isNaN(+d[incomeKey]) && !isNaN(+d[povertyKey]),
    )

    // Create scales
    const xExtent = d3.extent(validData, (d) => +d[incomeKey]) as [number, number]
    const yExtent = d3.extent(validData, (d) => +d[povertyKey]) as [number, number]

    const xScale = d3
      .scaleLinear()
      .domain([0, xExtent[1] * 1.1])
      .range([0, innerWidth])

    const yScale = d3
      .scaleLinear()
      .domain([0, yExtent[1] * 1.1])
      .range([innerHeight, 0])

    // Create color scale for clusters
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)

    // Create size scale for health burden
    const sizeScale = d3
      .scaleLinear()
      .domain(d3.extent(Object.values(healthBurdenIndex)) as [number, number])
      .range([3, 8])

    // Create main group
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`)

    // Add axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(5)
      .tickFormat((d) => `$${d3.format(",.0f")(+d)}`)

    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => `${(+d * 100).toFixed(0)}%`)

    g.append("g")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(xAxis)
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", 30)
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .text("Median Household Income")

    g.append("g")
      .call(yAxis)
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -40)
      .attr("x", -innerHeight / 2)
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .text("Children in Poverty")

    // Add points
    g.selectAll("circle")
      .data(validData)
      .join("circle")
      .attr("cx", (d) => xScale(+d[incomeKey]))
      .attr("cy", (d) => yScale(+d[povertyKey]))
      .attr("r", (d) => sizeScale(healthBurdenIndex[d.FIPS] || 0))
      .attr("fill", (d, i) => colorScale(clusters[i].toString()))
      .attr("opacity", 0.7)
      .attr("stroke", "white")
      .attr("stroke-width", 0.5)
      .attr("class", (d) => {
        const index = processedData.findIndex((county) => county.FIPS === d.FIPS)
        return index !== -1 && selectedIndices.includes(index) ? "selected" : ""
      })
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget)
          .attr("r", (d) => sizeScale(healthBurdenIndex[d.FIPS] || 0) + 2)
          .attr("stroke-width", 1.5)

        // Show tooltip
        const tooltip = g
          .append("g")
          .attr("class", "tooltip")
          .attr("transform", `translate(${xScale(+d[incomeKey]) + 10}, ${yScale(+d[povertyKey]) - 10})`)

        tooltip.append("rect").attr("width", 180).attr("height", 80).attr("fill", "rgba(0, 0, 0, 0.8)").attr("rx", 4)

        tooltip
          .append("text")
          .attr("x", 10)
          .attr("y", 20)
          .attr("fill", "white")
          .text(`${d.Name}, ${d["State Abbreviation"]}`)

        tooltip
          .append("text")
          .attr("x", 10)
          .attr("y", 40)
          .attr("fill", "white")
          .text(`Income: $${(+d[incomeKey]).toLocaleString()}`)

        tooltip
          .append("text")
          .attr("x", 10)
          .attr("y", 60)
          .attr("fill", "white")
          .text(`Poverty: ${(+d[povertyKey] * 100).toFixed(1)}%`)
      })
      .on("mouseout", (event, d) => {
        d3.select(event.currentTarget)
          .attr("r", (d) => sizeScale(healthBurdenIndex[d.FIPS] || 0))
          .attr("stroke-width", 0.5)

        g.select(".tooltip").remove()
      })
      .on("click", (event, d) => {
        onSelection([d.FIPS], event.ctrlKey || event.metaKey)
      })

    // Add brush
    const brush = d3
      .brush()
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .on("end", (event) => {
        if (!event.selection) return

        const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]]

        const selected = validData.filter((d) => {
          const cx = xScale(+d[incomeKey])
          const cy = yScale(+d[povertyKey])
          return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1
        })

        onSelection(
          selected.map((d) => d.FIPS),
          event.sourceEvent.ctrlKey || event.sourceEvent.metaKey,
        )
      })

    g.append("g").attr("class", "brush").call(brush)

    // Add trend line
    const xValues = validData.map((d) => +d[incomeKey])
    const yValues = validData.map((d) => +d[povertyKey])

    const { slope, intercept } = linearRegression(xValues, yValues)

    const x1 = xExtent[0]
    const y1 = slope * x1 + intercept
    const x2 = xExtent[1]
    const y2 = slope * x2 + intercept

    g.append("line")
      .attr("x1", xScale(x1))
      .attr("y1", yScale(y1))
      .attr("x2", xScale(x2))
      .attr("y2", yScale(y2))
      .attr("stroke", "rgba(255, 255, 255, 0.5)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4")

    // Update selected points when selection changes
    return () => {
      svg.selectAll("circle").classed("selected", (d) => {
        const index = processedData.findIndex((county) => county.FIPS === d.FIPS)
        return index !== -1 && selectedIndices.includes(index)
      })
    }
  }, [processedData, clusters, selectedIndices, healthBurdenIndex, onSelection])

  // Helper function for linear regression
  function linearRegression(x: number[], y: number[]) {
    const n = x.length

    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / n
    const yMean = y.reduce((sum, val) => sum + val, 0) / n

    // Calculate slope and intercept
    let numerator = 0
    let denominator = 0

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean)
      denominator += (x[i] - xMean) * (x[i] - xMean)
    }

    const slope = numerator / denominator
    const intercept = yMean - slope * xMean

    return { slope, intercept }
  }

  return (
    <div className="w-full h-full">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="scatter-plot"
        style={
          {
            "--selected-stroke": "#ff0",
            "--selected-stroke-width": "2px",
          } as any
        }
      />
      <style jsx>{`
        .scatter-plot :global(circle.selected) {
          stroke: var(--selected-stroke);
          stroke-width: var(--selected-stroke-width);
        }
      `}</style>
    </div>
  )
}
