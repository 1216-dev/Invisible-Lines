"use client"

import { useEffect, useRef, useContext, useState } from "react"
import * as d3 from "d3"
import { DataContext } from "@/lib/data-context"
import { feature } from "topojson-client"
import type { TopoJSON } from "topojson-specification"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

export default function USMap() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { processedData, selectedIndices, healthBurdenIndex, onSelection } = useContext(DataContext)
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform | null>(null)

  useEffect(() => {
    if (!svgRef.current || processedData.length === 0) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Clear previous content
    svg.selectAll("*").remove()

    // Create a color scale
    const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, 1]) // Assuming health burden index is normalized between 0-1

    // Helper function to ensure consistent FIPS code format
    const normalizeFips = (fips) => {
      if (!fips) return ""
      return String(fips).padStart(5, "0")
    }

    // Create a map of normalized FIPS to county data for faster lookup
    const countyMap = new Map()
    processedData.forEach((d) => {
      if (d.FIPS) {
        countyMap.set(normalizeFips(d.FIPS), d)
      }
    })

    // Load US counties TopoJSON
    d3.json<TopoJSON>("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-albers-10m.json")
      .then((us) => {
        if (!us) return

        // Convert TopoJSON to GeoJSON
        const counties = feature(us, us.objects.counties as any)

        // Create a projection
        const projection = d3.geoAlbersUsa().fitSize([width, height], counties)

        // Apply zoom transform if it exists
        if (zoomTransform) {
          projection
            .translate([zoomTransform.x + width / 2, zoomTransform.y + height / 2])
            .scale(projection.scale() * zoomTransform.k)
        }

        // Create a path generator
        const path = d3.geoPath().projection(projection)

        // Create a clip path
        svg
          .append("defs")
          .append("clipPath")
          .attr("id", "clip-map")
          .append("rect")
          .attr("width", width)
          .attr("height", height)

        const g = svg.append("g").attr("clip-path", "url(#clip-map)")

        // Draw counties
        g.append("g")
          .selectAll("path")
          .data(counties.features)
          .join("path")
          .attr("d", path)
          .attr("fill", (d) => {
            const fips = normalizeFips(d.id)
            const county = countyMap.get(fips)

            if (county) {
              return healthBurdenIndex[county.FIPS] ? colorScale(healthBurdenIndex[county.FIPS]) : "#ccc"
            }
            return "#ccc"
          })
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.1)
          .attr("class", (d) => {
            const fips = d.id as string
            // Find the index of the county with this FIPS code
            const index = processedData.findIndex((county) => county.FIPS === fips)
            return index !== -1 && selectedIndices.includes(index) ? "selected" : ""
          })
          .classed("county", true)
          .on("mouseover", (event, d) => {
            const fips = d.id as string
            const county = countyMap.get(fips)

            if (county) {
              d3.select(event.currentTarget).attr("stroke", "#fff").attr("stroke-width", 1.5)

              // Show tooltip
              const tooltip = svg
                .append("g")
                .attr("class", "tooltip")
                .attr(
                  "transform",
                  `translate(${event.pageX - svgRef.current!.getBoundingClientRect().left + 10}, ${event.pageY - svgRef.current!.getBoundingClientRect().top + 10})`,
                )

              tooltip
                .append("rect")
                .attr("width", 180)
                .attr("height", 80)
                .attr("fill", "rgba(0, 0, 0, 0.8)")
                .attr("rx", 4)

              tooltip
                .append("text")
                .attr("x", 10)
                .attr("y", 20)
                .attr("fill", "white")
                .text(`${county.Name}, ${county["State Abbreviation"]}`)

              tooltip.append("text").attr("x", 10).attr("y", 40).attr("fill", "white").text(`FIPS: ${county.FIPS}`)

              tooltip
                .append("text")
                .attr("x", 10)
                .attr("y", 60)
                .attr("fill", "white")
                .text(`Health Burden: ${(healthBurdenIndex[fips] * 100).toFixed(1)}%`)
            }
          })
          .on("mouseout", (event) => {
            d3.select(event.currentTarget).attr("stroke", "#fff").attr("stroke-width", 0.1)

            svg.select(".tooltip").remove()
          })
          .on("click", (event, d) => {
            const fips = d.id as string
            onSelection([fips], event.ctrlKey || event.metaKey)
          })

        // Add state boundaries
        g.append("path")
          .datum(feature(us, us.objects.states as any))
          .attr("fill", "none")
          .attr("stroke", "white")
          .attr("stroke-width", 0.5)
          .attr("d", path)

        // Add legend
        const legendWidth = 200
        const legendHeight = 20
        const legendX = width - legendWidth - 20
        const legendY = height - 40

        const legendScale = d3.scaleLinear().domain([0, 1]).range([0, legendWidth])

        const legendAxis = d3
          .axisBottom(legendScale)
          .ticks(5)
          .tickFormat((d) => `${(+d * 100).toFixed(0)}%`)

        const legend = svg.append("g").attr("transform", `translate(${legendX}, ${legendY})`)

        // Create gradient for legend
        const defs = svg.append("defs")

        const gradient = defs
          .append("linearGradient")
          .attr("id", "health-gradient")
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

        legend
          .append("rect")
          .attr("width", legendWidth)
          .attr("height", legendHeight)
          .style("fill", "url(#health-gradient)")

        legend
          .append("g")
          .attr("transform", `translate(0, ${legendHeight})`)
          .call(legendAxis)
          .selectAll("text")
          .attr("fill", "white")

        legend
          .append("text")
          .attr("x", 0)
          .attr("y", -5)
          .attr("fill", "white")
          .attr("font-size", "12px")
          .text("Health Burden Index")

        // Zoom functionality
        const zoom = d3
          .zoom()
          .scaleExtent([1, 8])
          .on("zoom", (event) => {
            setZoomTransform(event.transform)
            g.attr("transform", event.transform)
          })

        // Add zoom behavior to the SVG
        svg.call(zoom)
      })
      .catch((error) => console.error("Error loading US map:", error))

    // Update selected counties when selection changes
    return () => {
      svg.selectAll(".county").classed("selected", (d) => {
        const fips = d.id as string
        const index = processedData.findIndex((county) => county.FIPS === fips)
        return index !== -1 && selectedIndices.includes(index)
      })
    }
  }, [processedData, selectedIndices, healthBurdenIndex, onSelection, zoomTransform])

  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      const zoom = d3.zoom()
      svg.transition().call(zoom.scaleBy, 1.5)
    }
  }

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      const zoom = d3.zoom()
      svg.transition().call(zoom.scaleBy, 0.75)
    }
  }

  const handleResetZoom = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      const zoom = d3.zoom()
      svg.transition().call(zoom.transform, d3.zoomIdentity)
      setZoomTransform(null)
    }
  }

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="county-map"
        style={
          {
            "--selected-stroke": "#ff00ff", // Magenta for selection
            "--highlighted-stroke": "#00ffff", // Cyan for highlighting
            "--selected-stroke-width": "2.5px",
          } as any
        }
      />
      <style jsx>{`
        .county-map :global(.county.selected) {
          stroke: var(--selected-stroke);
          stroke-width: var(--selected-stroke-width);
        }
        .county-map :global(.county.highlighted) {
          stroke: var(--highlighted-stroke);
          stroke-width: var(--selected-stroke-width);
        }
        .county-map :global(.county) {
          transition: stroke 0.2s, stroke-width 0.2s, opacity 0.2s;
        }
      `}</style>

      {/* Map controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <Button variant="outline" size="icon" onClick={handleZoomIn} className="h-8 w-8 bg-white/10 backdrop-blur-sm">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomOut} className="h-8 w-8 bg-white/10 backdrop-blur-sm">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleResetZoom}
          className="h-8 w-8 bg-white/10 backdrop-blur-sm"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
