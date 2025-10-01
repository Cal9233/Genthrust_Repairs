import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import StatusBadge from './StatusBadge'

function RepairTable({ data, isLoading }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(item =>
      Object.values(item).some(value =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key] || ''
        const bValue = b[sortConfig.key] || ''

        // Handle dates
        if (sortConfig.key.includes('DATE')) {
          const aDate = new Date(aValue)
          const bDate = new Date(bValue)
          if (!isNaN(aDate) && !isNaN(bDate)) {
            return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate
          }
        }

        // Handle numbers
        const aNum = parseFloat(aValue)
        const bNum = parseFloat(bValue)
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
        }

        // Handle strings
        const aStr = aValue.toString().toLowerCase()
        const bStr = bValue.toString().toLowerCase()
        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [data, searchTerm, sortConfig])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentData = filteredAndSortedData.slice(startIndex, endIndex)

  // Reset pagination when search or sort changes
  useMemo(() => {
    setCurrentPage(1)
  }, [searchTerm, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }

  const isOverdue = (item) => {
    const nextUpdateDate = item['NEXT DATE TO UPDATE']
    if (!nextUpdateDate) return false
    const updateDate = new Date(nextUpdateDate)
    const today = new Date()
    return updateDate < today && !['COMPLETED', 'CANCELLED'].includes(item['CURENT STATUS'])
  }

  const formatCurrency = (value) => {
    const num = parseFloat(value)
    return isNaN(num) ? '-' : `$${num.toLocaleString()}`
  }

  const formatDate = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    return isNaN(date) ? value : date.toLocaleDateString()
  }

  // Priority columns to show first
  const priorityColumns = [
    'RO #',
    'PART #',
    'SERIAL #',
    'SHOP NAME',
    'CURENT STATUS',
    'DATE DROPPED OFF',
    'ESTIMATED DELIVERY DATE',
    'ESTIMATED COST',
    'FINAL COST',
  ]

  // Get all unique columns from data
  const allColumns = data.length > 0 ? Object.keys(data[0]) : []
  const otherColumns = allColumns.filter(col => !priorityColumns.includes(col))
  const displayColumns = [...priorityColumns.filter(col => allColumns.includes(col)), ...otherColumns]

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Search Bar */}
      <div className="p-6 border-b border-gray-200">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search all fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Showing {currentData.length} of {filteredAndSortedData.length} results
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {displayColumns.map(column => (
                <th
                  key={column}
                  onClick={() => handleSort(column)}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  <div className="flex items-center space-x-1">
                    <span>{column}</span>
                    {getSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentData.map((item, index) => {
              const rowOverdue = isOverdue(item)
              return (
                <tr
                  key={index}
                  className={`hover:bg-gray-50 ${rowOverdue ? 'bg-red-50 border-l-4 border-red-400' : ''}`}
                >
                  {displayColumns.map(column => (
                    <td key={column} className="px-6 py-4 whitespace-nowrap text-sm">
                      {column === 'CURENT STATUS' ? (
                        <StatusBadge status={item[column]} isOverdue={rowOverdue} />
                      ) : column.includes('COST') ? (
                        <span className="text-gray-900 font-medium">
                          {formatCurrency(item[column])}
                        </span>
                      ) : column.includes('DATE') ? (
                        <span className="text-gray-900">
                          {formatDate(item[column])}
                        </span>
                      ) : (
                        <span className="text-gray-900">
                          {item[column] || '-'}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{startIndex + 1}</span>
                {' '}to{' '}
                <span className="font-medium">
                  {Math.min(endIndex, filteredAndSortedData.length)}
                </span>
                {' '}of{' '}
                <span className="font-medium">{filteredAndSortedData.length}</span>
                {' '}results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Page numbers */}
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1
                  const isCurrentPage = page === currentPage

                  // Show first page, last page, current page, and 2 pages around current
                  const showPage =
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 2 && page <= currentPage + 2)

                  if (!showPage) {
                    // Show ellipsis
                    if (page === currentPage - 3 || page === currentPage + 3) {
                      return (
                        <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          ...
                        </span>
                      )
                    }
                    return null
                  }

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        isCurrentPage
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RepairTable