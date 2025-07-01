"use client"

import { useRef, useEffect, useContext, useState, useMemo } from "react"
import * as d3 from "d3"
import * as topojson from "topojson-client"
import { DataContext } from "@/lib/data-context"
import { getCachedTopoJSON } from "@/data/data-loader"

interface ChoroplethMapProps {
  aggregationLevel: "county" | "state" | "region"
  selectedMetric: string
  topoJSONLoaded: boolean
}

// Add a prop to handle the case where TopoJSON data isn't loaded
export default function ChoroplethMap({
  aggregationLevel,
  selectedMetric,
  topoJSONLoaded = false,
}: {
  aggregationLevel: "county" | "state" | "region"
  selectedMetric: string
  topoJSONLoaded?: boolean
}) {
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
  const [tooltipContent, setTooltipContent] = useState<string>("")
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false)
  const [mapData, setMapData] = useState<any>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [zoomState, setZoomState] = useState<{
    transform: d3.ZoomTransform
    isZoomed: boolean
    focusedRegion: string | null
  }>({
    transform: d3.zoomIdentity,
    isZoomed: false,
    focusedRegion: null,
  })

  // Create a FIPS lookup map for faster access
  const fipsLookup = useMemo(() => {
    const lookup = new Map()
    processedData.forEach((county) => {
      if (county.FIPS) {
        lookup.set(county.FIPS, county)
      }
    })
    return lookup
  }, [processedData])

  // Load map data
  useEffect(() => {
    const loadMapData = async () => {
      try {
        // Try to use cached TopoJSON first
        let topoData = getCachedTopoJSON(aggregationLevel === "county" ? "county" : "state")

        // If not cached, fetch it
        if (!topoData) {
          const url =
            aggregationLevel === "county"
              ? "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json"
              : "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"

          const response = await fetch(url, { cache: "force-cache" })
          topoData = await response.json()
        }

        setMapData(topoData)
      } catch (error) {
        console.error("Error loading map data:", error)
      }
    }

    loadMapData()
    // Reset zoom when aggregation level changes
    setZoomState({
      transform: d3.zoomIdentity,
      isZoomed: false,
      focusedRegion: null,
    })
  }, [aggregationLevel, topoJSONLoaded])

  // Function to zoom to a specific feature
  const zoomToFeature = (
    feature: any,
    path: d3.GeoPath,
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  ) => {
    if (!svgRef.current) return

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const margin = { top: 10, right: 10, bottom: 40, left: 10 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Get bounds of the feature
    const bounds = path.bounds(feature)
    const dx = bounds[1][0] - bounds[0][0]
    const dy = bounds[1][1] - bounds[0][1]
    const x = (bounds[0][0] + bounds[1][0]) / 2
    const y = (bounds[0][1] + bounds[1][1]) / 2

    // Calculate scale and translate
    const scale = 0.8 / Math.max(dx / innerWidth, dy / innerHeight)
    const translate = [innerWidth / 2 - scale * x, innerHeight / 2 - scale * y]

    // Create zoom transform
    const transform = d3.zoomIdentity.translate(translate[0] + margin.left, translate[1] + margin.top).scale(scale)

    // Apply zoom transition
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString())
        setZoomState({
          transform: event.transform,
          isZoomed: true,
          focusedRegion: feature.id || (feature.properties ? feature.properties.name : null),
        })
      })

    svg.call(zoom)
    svg.transition().duration(750).call(zoom.transform, transform)

    const g = svg.select("g")
  }

  // Function to reset zoom
  const resetZoom = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    const zoom = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => {
      svg.select("g").attr("transform", event.transform.toString())
      setZoomState({
        transform: event.transform,
        isZoomed: event.transform.k > 1,
        focusedRegion: null,
      })
    })

    svg.call(zoom)
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity)
  }

  // Create a custom tooltip component directly in the DOM
  useEffect(() => {
    // Create tooltip element if it doesn't exist
    if (!document.getElementById("map-tooltip")) {
      const tooltip = document.createElement("div")
      tooltip.id = "map-tooltip"
      tooltip.className =
        "fixed z-50 bg-slate-800 text-white p-2 rounded shadow-lg pointer-events-none opacity-0 transition-opacity duration-200"
      tooltip.style.maxWidth = "250px"
      document.body.appendChild(tooltip)
    }

    // Cleanup on unmount
    return () => {
      const tooltip = document.getElementById("map-tooltip")
      if (tooltip) {
        document.body.removeChild(tooltip)
      }
    }
  }, [])

  // Function to show tooltip
  const showTooltip = (content: string, x: number, y: number) => {
    const tooltip = document.getElementById("map-tooltip")
    if (tooltip) {
      tooltip.innerHTML = content
      tooltip.style.left = `${x + 10}px`
      tooltip.style.top = `${y + 10}px`
      tooltip.style.opacity = "1"
    }
  }

  // Function to hide tooltip
  const hideTooltip = () => {
    const tooltip = document.getElementById("map-tooltip")
    if (tooltip) {
      tooltip.style.opacity = "0"
    }
  }

  // Optimize the map rendering for better performance
  useEffect(() => {
    if (!svgRef.current || !mapData || processedData.length === 0) return

    // Add error handling for TopoJSON data
    if (!mapData) {
      setMapError("Map data could not be loaded. Showing placeholder.")
      // Render a placeholder map or message
      return
    }

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    // Create a more robust color scale that handles missing data better
    const getColorScale = (metric) => {
      // Default color scale for burden index
      let colorScale = d3.scaleSequential(d3.interpolateTurbo).domain([0, 1])

      if (!metric) return colorScale

      if (metric.includes("Income")) {
        // Blues for income-related metrics
        colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, 1])
      } else if (metric.includes("Death") || metric.includes("Poor")) {
        // Reds for negative health outcomes
        colorScale = d3.scaleSequential(d3.interpolateReds).domain([0, 1])
      } else if (metric.includes("Obesity") || metric.includes("Inactivity")) {
        // Oranges for lifestyle-related metrics
        colorScale = d3.scaleSequential(d3.interpolateOranges).domain([0, 1])
      } else if (metric.includes("Access")) {
        // Greens for access-related metrics
        colorScale = d3.scaleSequential(d3.interpolateGreens).domain([0, 1])
      }

      return colorScale
    }

    // Replace the existing colorScale definition with this call
    const colorScale = getColorScale(selectedMetric)

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const margin = { top: 10, right: 10, bottom: 40, left: 10 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Create main group
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`)

    // Create projection
    const projection = d3
      .geoAlbersUsa()
      .fitSize(
        [innerWidth, innerHeight],
        topojson.feature(mapData, aggregationLevel === "county" ? mapData.objects.counties : mapData.objects.states),
      )

    // Create path generator
    const path = d3.geoPath().projection(projection)

    // Pre-compute normalized values for better performance
    const metricValues = processedData
      .map((c) => c[selectedMetric])
      .filter((v) => v !== undefined && !isNaN(v))
      .map((v) => Number(v))

    const min = metricValues.length > 0 ? Math.min(...metricValues) : 0
    const max = metricValues.length > 0 ? Math.max(...metricValues) : 1
    const range = max - min

    // Create a lookup map for faster access
    const dataLookup = new Map()
    processedData.forEach((entity) => {
      if (aggregationLevel === "county" && entity.FIPS) {
        dataLookup.set(entity.FIPS, entity)
      } else if (aggregationLevel === "state" && entity["State Abbreviation"]) {
        dataLookup.set(entity["State Abbreviation"], entity)
      } else if (entity.Region) {
        dataLookup.set(entity.Region, entity)
      }
    })

    // Create a FIPS to state abbreviation lookup for better state matching
    const fipsToStateMap = new Map()
    processedData.forEach((entity) => {
      if (entity.FIPS && entity["State Abbreviation"]) {
        const stateFips = entity.FIPS.substring(0, 2)
        fipsToStateMap.set(stateFips, entity["State Abbreviation"])
      }
    })

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString())
        setZoomState({
          transform: event.transform,
          isZoomed: event.transform.k > 1,
          focusedRegion: zoomState.focusedRegion,
        })
      })

    svg.call(zoom)

    // Add reset zoom button if zoomed in
    if (zoomState.isZoomed) {
      const resetButton = svg
        .append("g")
        .attr("class", "reset-zoom-button")
        .attr("transform", `translate(${width - 40}, 40)`)
        .style("cursor", "pointer")
        .on("click", () => resetZoom(svg))

      resetButton
        .append("circle")
        .attr("r", 15)
        .attr("fill", "rgba(0, 0, 0, 0.5)")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)

      resetButton
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.3em")
        .attr("fill", "#fff")
        .attr("font-size", "12px")
        .text("⟲")
    }

    // Draw map features
    if (aggregationLevel === "county") {
      // Draw counties
      const counties = topojson.feature(mapData, mapData.objects.counties).features

      g.selectAll("path.county")
        .data(counties)
        .join("path")
        .attr("class", "county no-transition")
        .attr("d", path)
        .attr("fill", (d: any) => {
          const fips = d.id
          // Try to find the county in our data
          const county = dataLookup.get(String(fips))

          // If we have data for this county and the selected metric
          if (selectedMetric && county && county[selectedMetric] !== undefined) {
            // Use pre-computed min/max for normalization
            let normalizedValue
            if (county[selectedMetric] >= 0 && county[selectedMetric] <= 1 && max <= 1) {
              normalizedValue = county[selectedMetric]
            } else {
              normalizedValue = range > 0 ? (county[selectedMetric] - min) / range : 0.5
            }

            return colorScale(normalizedValue)
          }

          // Use the composite burden index as fallback
          if (compositeBurdenIndex[fips] !== undefined) {
            return colorScale(compositeBurdenIndex[fips])
          }

          // Try to find a state-level value for this county
          if (fips) {
            const stateFips = String(fips).substring(0, 2)
            const stateAbbr = fipsToStateMap.get(stateFips)
            const stateData = stateAbbr ? dataLookup.get(stateAbbr) : null

            if (stateData && selectedMetric && stateData[selectedMetric] !== undefined) {
              // Use state-level data as an approximation
              let normalizedValue
              if (stateData[selectedMetric] >= 0 && stateData[selectedMetric] <= 1 && max <= 1) {
                normalizedValue = stateData[selectedMetric]
              } else {
                normalizedValue = range > 0 ? (stateData[selectedMetric] - min) / range : 0.5
              }

              // Use a slightly different shade to indicate it's approximated
              return d3.color(colorScale(normalizedValue))?.darker(0.3).toString() || "#ccc"
            }
          }

          // Default color for missing data - use a light gray instead of medium gray
          return "#e0e0e0"
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.1)
        .attr("stroke-opacity", 0.5)
        .attr("data-fips", (d: any) => d.id)
        .on("mouseover", (event, d: any) => {
          // Find the index of this county in processedData
          const index = processedData.findIndex((county) => county.FIPS === d.id)
          if (index !== -1) {
            // Pass both index and FIPS for consistent highlighting
            onHighlight(index, d.id)

            // Show tooltip
            const county = processedData[index]
            if (county) {
              // Format tooltip content
              let content = `<div class="font-medium">${county.Name}, ${county["State Abbreviation"]}</div>`
              content += `<div class="text-xs text-gray-500">FIPS: ${county.FIPS}</div>`

              if (selectedMetric && county[selectedMetric] !== undefined) {
                const value = county[selectedMetric]
                const formattedValue = formatValue(value, selectedMetric)
                content += `<div class="mt-1">${formatMetricName(selectedMetric)}: <span class="font-medium">${formattedValue}</span></div>`
              }

              // Add health burden index
              if (compositeBurdenIndex[county.FIPS] !== undefined) {
                content += `<div class="mt-1">Health Burden Index: <span class="font-medium">${(compositeBurdenIndex[county.FIPS] * 100).toFixed(1)}%</span></div>`
              }

              showTooltip(content, event.pageX, event.pageY)
            }
          }
        })
        .on("mousemove", (event) => {
          const tooltip = document.getElementById("map-tooltip")
          if (tooltip && tooltip.style.opacity !== "0") {
            tooltip.style.left = `${event.pageX + 10}px`
            tooltip.style.top = `${event.pageY + 10}px`
          }
        })
        .on("mouseout", () => {
          onHighlight(null)
          hideTooltip()
        })
        .on("click", (event, d: any) => {
          const index = processedData.findIndex((county) => county.FIPS === d.id)
          if (index !== -1) {
            onSelection([index], event.ctrlKey || event.metaKey)
            console.log("Selected county:", processedData[index].Name, "Index:", index)

            // Zoom to the clicked county
            zoomToFeature(d, path, svg)
          } else {
            // If we can't find a direct match, log this for debugging
            console.log("No data found for FIPS:", d.id)
          }
        })

      // Draw state boundaries
      g.append("path")
        .datum(topojson.mesh(mapData, mapData.objects.states, (a, b) => a !== b))
        .attr("fill", "none")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .attr("d", path)
    } else {
      // Draw states or regions
      const states = topojson.feature(mapData, mapData.objects.states).features

      // Create a mapping from state id to state abbreviation
      const stateIdToAbbr = new Map()
      const stateFeatures = mapData.objects.states.geometries
      stateFeatures.forEach((feature) => {
        const stateId = feature.id
        const stateName = feature.properties.name

        // Find the state abbreviation for this state
        const stateAbbr = Object.keys(processedData).find((key) => {
          const entity = processedData[key]
          return entity["State Abbreviation"] === stateName
        })

        if (stateAbbr) {
          stateIdToAbbr.set(stateId, stateAbbr)
        }
      })

      g.selectAll("path.state")
        .data(states)
        .join("path")
        .attr("class", "state no-transition")
        .attr("d", path)
        .attr("fill", (d: any) => {
          if (aggregationLevel === "state") {
            // Find state in processed data - use the lookup map
            const stateAbbr = d.properties.name
            const state = dataLookup.get(stateAbbr)

            if (state) {
              if (selectedMetric && state[selectedMetric] !== undefined) {
                // Use pre-computed min/max for normalization
                let normalizedValue
                if (state[selectedMetric] >= 0 && state[selectedMetric] <= 1 && max <= 1) {
                  normalizedValue = state[selectedMetric]
                } else {
                  normalizedValue = range > 0 ? (state[selectedMetric] - min) / range : 0.5
                }

                return colorScale(normalizedValue)
              }
              return compositeBurdenIndex[state["State Abbreviation"]] !== undefined
                ? colorScale(compositeBurdenIndex[state["State Abbreviation"]])
                : "#ccc"
            }

            // Try to find the state by matching properties
            for (const entity of processedData) {
              if (entity["State Abbreviation"] === d.properties.name) {
                if (selectedMetric && entity[selectedMetric] !== undefined) {
                  let normalizedValue
                  if (entity[selectedMetric] >= 0 && entity[selectedMetric] <= 1 && max <= 1) {
                    normalizedValue = entity[selectedMetric]
                  } else {
                    normalizedValue = range > 0 ? (entity[selectedMetric] - min) / range : 0.5
                  }
                  return colorScale(normalizedValue)
                }
                return compositeBurdenIndex[entity["State Abbreviation"]] !== undefined
                  ? colorScale(compositeBurdenIndex[entity["State Abbreviation"]])
                  : "#ccc"
              }
            }
          } else {
            // Find region for this state
            const stateName = d.properties.name
            const regionName = getRegionFromState(stateName)
            const region = dataLookup.get(regionName)

            if (region) {
              if (selectedMetric && region[selectedMetric] !== undefined) {
                // Use pre-computed min/max for normalization
                let normalizedValue
                if (region[selectedMetric] >= 0 && region[selectedMetric] <= 1 && max <= 1) {
                  normalizedValue = region[selectedMetric]
                } else {
                  normalizedValue = range > 0 ? (region[selectedMetric] - min) / range : 0.5
                }

                return colorScale(normalizedValue)
              }
              return compositeBurdenIndex[region.Region] !== undefined
                ? colorScale(compositeBurdenIndex[region.Region])
                : "#ccc"
            }
          }
          return "#ccc"
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .on("mouseover", (event, d: any) => {
          // Find the index in processedData
          let index = -1
          let entity = null

          if (aggregationLevel === "state") {
            index = processedData.findIndex((s) => s["State Abbreviation"] === d.properties.name)
            if (index !== -1) entity = processedData[index]
          } else {
            const region = getRegionFromState(d.properties.name)
            index = processedData.findIndex((r) => r.Region === region)
            if (index !== -1) entity = processedData[index]
          }

          if (index !== -1 && entity) {
            onHighlight(index)

            // Show tooltip
            // Format tooltip content
            let content = `<div class="font-medium">${aggregationLevel === "state" ? entity["State Abbreviation"] : entity.Region}</div>`

            if (selectedMetric && entity[selectedMetric] !== undefined) {
              const value = entity[selectedMetric]
              const formattedValue = formatValue(value, selectedMetric)
              content += `<div class="mt-1">${formatMetricName(selectedMetric)}: <span class="font-medium">${formattedValue}</span></div>`
            }

            // Add health burden index
            const id = aggregationLevel === "state" ? entity["State Abbreviation"] : entity.Region
            if (compositeBurdenIndex[id] !== undefined) {
              content += `<div class="mt-1">Health Burden Index: <span class="font-medium">${(compositeBurdenIndex[id] * 100).toFixed(1)}%</span></div>`
            }

            // Add county count if available
            const countField = aggregationLevel === "state" ? "State AbbreviationCount" : "RegionCount"
            if (entity[countField]) {
              content += `<div class="mt-1">Counties: <span class="font-medium">${entity[countField]}</span></div>`
            }

            showTooltip(content, event.pageX, event.pageY)
          }
        })
        .on("mousemove", (event) => {
          const tooltip = document.getElementById("map-tooltip")
          if (tooltip && tooltip.style.opacity !== "0") {
            tooltip.style.left = `${event.pageX + 10}px`
            tooltip.style.top = `${event.pageY + 10}px`
          }
        })
        .on("mouseout", () => {
          onHighlight(null)
          hideTooltip()
        })
        .on("click", (event, d: any) => {
          let index = -1
          if (aggregationLevel === "state") {
            index = processedData.findIndex((s) => s["State Abbreviation"] === d.properties.name)
          } else {
            const region = getRegionFromState(d.properties.name)
            index = processedData.findIndex((r) => r.Region === region)
          }

          if (index !== -1) {
            onSelection([index], event.ctrlKey || event.metaKey)
            console.log(
              "Selected region:",
              aggregationLevel === "state" ? d.properties.name : getRegionFromState(d.properties.name),
              "Index:",
              index,
            )

            // Zoom to the clicked state/region
            zoomToFeature(d, path, svg)
          } else {
            console.log("No data found for region:", d.properties.name)
          }
        })
    }

    // Add legend
    const legendWidth = 200
    const legendHeight = 10
    const legendX = innerWidth - 180
    const legendY = innerHeight + 19

    const legend = svg.append("g").attr("transform", `translate(${legendX}, ${legendY})`)

    // Create gradient
    const defs = svg.append("defs")
    const gradient = defs
      .append("linearGradient")
      .attr("id", "burden-gradient")
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
    legend.append("rect").attr("width", legendWidth).attr("height", legendHeight).style("fill", "url(#burden-gradient)")

    // Add legend axis
    const legendScale = d3.scaleLinear().domain([0, 1]).range([0, legendWidth])

    // Format legend ticks based on metric type
    const legendTickFormat = (d: any) => {
      const value = +d

      if (selectedMetric) {
        if (selectedMetric.includes("Income")) {
          // For income metrics, show dollar values
          const actualValue = min + (max - min) * value
          return `$${Math.round(actualValue).toLocaleString()}`
        } else if (selectedMetric.includes("raw value") && !selectedMetric.includes("Index")) {
          // For percentage metrics (between 0 and 1)
          if (max <= 1) {
            return `${(value * 100).toFixed(0)}%`
          } else {
            // For other numeric metrics
            const actualValue = min + (max - min) * value
            return actualValue.toFixed(1)
          }
        }
      }

      // Default percentage format
      return `${(value * 100).toFixed(0)}%`
    }

    const legendAxis = d3.axisBottom(legendScale).ticks(5).tickFormat(legendTickFormat)

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
      .text(selectedMetric ? formatMetricName(selectedMetric) : "Composite Burden Index")

    // Update selection highlighting
    updateHighlighting()

    // If we have a previously zoomed state, restore it
    if (zoomState.isZoomed && zoomState.transform) {
      g.attr("transform", zoomState.transform.toString())
    }
  }, [
    mapData,
    processedData,
    aggregationLevel,
    selectedMetric,
    compositeBurdenIndex,
    fipsLookup,
    onSelection,
    onHighlight,
    topoJSONLoaded,
    zoomState.isZoomed,
    zoomState.transform,
  ])

  // Function to update highlighting
  const updateHighlighting = () => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)

    if (aggregationLevel === "county") {
      svg
        .selectAll("path.county")
        .attr("stroke", (d: any) => {
          const index = processedData.findIndex((county) => county.FIPS === d.id)
          if (highlightedFIPS === d.id || index === highlightedIndex) {
            return "#00ffff" // Cyan color for highlighting
          }
          if (selectedIndices.includes(index)) {
            return "#ff00ff" // Magenta color for selection
          }
          return "#fff"
        })
        .attr("stroke-width", (d: any) => {
          const index = processedData.findIndex((county) => county.FIPS === d.id)
          if (highlightedFIPS === d.id || index === highlightedIndex || selectedIndices.includes(index)) {
            return 2.5 // Thicker stroke for better visibility
          }
          return 0.1
        })
        .attr("opacity", (d: any) => {
          const index = processedData.findIndex((county) => county.FIPS === d.id)
          if (selectedIndices.length === 0) return 1
          return selectedIndices.includes(index) || index === highlightedIndex || highlightedFIPS === d.id ? 1 : 0.15
        })
    } else {
      svg
        .selectAll("path.state")
        .attr("stroke", (d: any) => {
          let index = -1
          if (aggregationLevel === "state") {
            index = processedData.findIndex((s) => s["State Abbreviation"] === d.properties.name)
          } else {
            const region = getRegionFromState(d.properties.name)
            index = processedData.findIndex((r) => r.Region === region)
          }

          if (index === highlightedIndex) {
            return "#00ffff" // Cyan color for highlighting
          }
          if (selectedIndices.includes(index)) {
            return "#ff00ff" // Magenta color for selection
          }
          return "#fff"
        })
        .attr("stroke-width", (d: any) => {
          let index = -1
          if (aggregationLevel === "state") {
            index = processedData.findIndex((s) => s["State Abbreviation"] === d.properties.name)
          } else {
            const region = getRegionFromState(d.properties.name)
            index = processedData.findIndex((r) => r.Region === region)
          }

          if (index === highlightedIndex || selectedIndices.includes(index)) {
            return 2.5 // Thicker stroke for better visibility
          }
          return 0.5
        })
        .attr("opacity", (d: any) => {
          let index = -1
          if (aggregationLevel === "state") {
            index = processedData.findIndex((s) => s["State Abbreviation"] === d.properties.name)
          } else {
            const region = getRegionFromState(d.properties.name)
            index = processedData.findIndex((r) => r.Region === region)
          }

          if (selectedIndices.length === 0) return 1
          return selectedIndices.includes(index) || index === highlightedIndex ? 1 : 0.15
        })
    }
  }

  // Effect to update highlighting when selection changes
  useEffect(() => {
    updateHighlighting()
  }, [selectedIndices, highlightedIndex, highlightedFIPS])

  // Helper function to get region from state
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

  // Helper function to format metric names
  function formatMetricName(metricName: string): string {
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

  // Add this before the final return statement:
  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 p-4">
        <div className="text-center">
          <p className="text-amber-400 mb-2">{mapError}</p>
          <div className="w-full h-[300px] bg-slate-800 rounded-lg flex items-center justify-center">
            <p className="text-slate-500">Map Placeholder</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full p-4">
      {!mapData ? (
        <div className="flex items-center justify-center h-full">
          <div className="h-12 w-12 border-4 border-t-teal-500 border-teal-500/30 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <svg ref={svgRef} width="100%" height="100%" className="no-transition" />
          {zoomState.isZoomed && (
            <button
              className="absolute top-4 right-4 bg-slate-800/80 text-white p-2 rounded-full hover:bg-slate-700"
              onClick={() => {
                if (svgRef.current) {
                  resetZoom(d3.select(svgRef.current))
                }
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  )
}
