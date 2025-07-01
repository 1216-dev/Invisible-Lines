"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"

interface DataTableProps {
  data: any[]
  selectedIndices: number[]
  onSelect: (indices: number[]) => void
}

export default function DataTable({ data, selectedIndices, onSelect }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const rowsPerPage = 10

  // Get columns (excluding long text fields)
  const columns = Object.keys(data[0] || {})
    .filter((col) => !["FIPS", "State FIPS Code", "County FIPS Code"].includes(col))
    .slice(0, 10) // Limit to 10 columns for readability

  // Filter data based on search term
  const filteredData = data.filter((row) => {
    if (!searchTerm) return true

    return Object.values(row).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase()))
  })

  // Sort data
  const sortedData = sortColumn
    ? [...filteredData].sort((a, b) => {
        const aValue = a[sortColumn]
        const bValue = b[sortColumn]

        // Handle numeric values
        if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
          return sortDirection === "asc" ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue)
        }

        // Handle string values
        const aString = String(aValue).toLowerCase()
        const bString = String(bValue).toLowerCase()

        return sortDirection === "asc" ? aString.localeCompare(bString) : bString.localeCompare(aString)
      })
    : filteredData

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const paginatedData = sortedData.slice(startIndex, startIndex + rowsPerPage)

  // Handle sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  // Handle row selection
  const handleRowClick = (index: number, ctrlKey: boolean) => {
    onSelect([index])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search counties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 bg-slate-800 border-slate-700"
          />
        </div>
        <div className="ml-4 flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="border-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-400">
            Page {currentPage} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="border-slate-700"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-slate-700 overflow-hidden">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="bg-slate-800">
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column}
                    className="text-slate-300 cursor-pointer hover:text-white"
                    onClick={() => handleSort(column)}
                  >
                    {column.replace(" raw value", "")}
                    {sortColumn === column && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, index) => (
                  <TableRow
                    key={index}
                    className={`
                      hover:bg-slate-800 cursor-pointer
                      ${selectedIndices.includes(index) ? "bg-slate-800" : ""}
                    `}
                    onClick={(e) => handleRowClick(index, e.ctrlKey || e.metaKey)}
                  >
                    {columns.map((column) => (
                      <TableCell key={column} className="text-slate-300">
                        {formatCellValue(row[column])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-slate-500">
                    No data found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="text-sm text-slate-500">
        Showing {paginatedData.length} of {filteredData.length} counties
      </div>
    </div>
  )
}

// Helper function to format cell values
function formatCellValue(value: any): string {
  if (value === undefined || value === null) return "-"

  // Format numbers
  if (!isNaN(Number(value))) {
    const num = Number(value)

    // Format percentages
    if (num >= 0 && num <= 1 && String(value).includes(".")) {
      return `${(num * 100).toFixed(1)}%`
    }

    // Format large numbers
    if (num >= 1000) {
      return num.toLocaleString()
    }

    // Format decimals
    if (String(value).includes(".")) {
      return num.toFixed(2)
    }
  }

  return String(value)
}
