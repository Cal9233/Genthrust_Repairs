import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, AlertTriangle, DollarSign, Package, Clock, CheckCircle } from 'lucide-react'
import { excelService } from '../services/excelService'
import RepairTable from './RepairTable'

function Dashboard() {
  const [selectedTable, setSelectedTable] = useState('RO Outside')

  const {
    data: tables = [],
    isLoading: tablesLoading,
    error: tablesError,
  } = useQuery({
    queryKey: ['tables'],
    queryFn: () => excelService.getTables(),
  })

  const {
    data: repairData = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['repairData', selectedTable],
    queryFn: () => excelService.getTableData(selectedTable),
    enabled: !!selectedTable,
  })

  const handleRefresh = () => {
    refetch()
  }

  const handleTableChange = (tableName) => {
    setSelectedTable(tableName)
  }

  // Calculate metrics
  const calculateMetrics = (data) => {
    const today = new Date()

    const totalParts = data.length
    const waitingQuote = data.filter(item => item['CURENT STATUS'] === 'WAITING QUOTE').length
    const approved = data.filter(item => item['CURENT STATUS'] === 'APPROVED >>>>').length
    const readyForPickup = data.filter(item => item['CURENT STATUS'] === 'READY FOR PICKUP').length

    const overdue = data.filter(item => {
      const nextUpdateDate = item['NEXT DATE TO UPDATE']
      if (!nextUpdateDate) return false
      const updateDate = new Date(nextUpdateDate)
      return updateDate < today && !['COMPLETED', 'CANCELLED'].includes(item['CURENT STATUS'])
    }).length

    const totalValue = data
      .filter(item => item['CURENT STATUS'] === 'APPROVED >>>>')
      .reduce((sum, item) => {
        const cost = parseFloat(item['FINAL COST']) || parseFloat(item['ESTIMATED COST']) || 0
        return sum + cost
      }, 0)

    return {
      totalParts,
      waitingQuote,
      approved,
      readyForPickup,
      overdue,
      totalValue,
    }
  }

  const metrics = calculateMetrics(repairData)

  if (tablesError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
          <p className="text-red-800">Failed to load tables: {tablesError.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with table selector and refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div>
            <label htmlFor="table-select" className="block text-sm font-medium text-gray-700 mb-1">
              Select Table
            </label>
            <select
              id="table-select"
              value={selectedTable}
              onChange={(e) => handleTableChange(e.target.value)}
              disabled={tablesLoading}
              className="block w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {tablesLoading ? (
                <option>Loading tables...</option>
              ) : (
                tables.map(table => (
                  <option key={table.id} value={table.name}>
                    {table.displayName}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Parts
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {metrics.totalParts}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Waiting Quote
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {metrics.waitingQuote}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Approved
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {metrics.approved}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Ready for Pickup
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {metrics.readyForPickup}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Overdue Updates
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {metrics.overdue}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Outstanding Value
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    ${metrics.totalValue.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-800">Failed to load repair data: {error.message}</p>
          </div>
        </div>
      ) : (
        <RepairTable data={repairData} isLoading={isLoading} />
      )}
    </div>
  )
}

export default Dashboard