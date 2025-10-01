import { Clock, CheckCircle, AlertCircle, XCircle, Pause, Quote } from 'lucide-react'

const statusConfig = {
  'WAITING QUOTE': {
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Quote,
  },
  'APPROVED >>>>': {
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
  },
  'WAITING FOR PARTS': {
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Clock,
  },
  'IN PROGRESS': {
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: Clock,
  },
  'READY FOR PICKUP': {
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CheckCircle,
  },
  'COMPLETED': {
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: CheckCircle,
  },
  'ON HOLD': {
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: Pause,
  },
  'CANCELLED': {
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
}

function StatusBadge({ status, isOverdue = false }) {
  const config = statusConfig[status] || {
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: AlertCircle,
  }

  const Icon = config.icon
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border'
  const colorClasses = isOverdue
    ? 'bg-red-100 text-red-800 border-red-200 animate-pulse'
    : config.color

  return (
    <span className={`${baseClasses} ${colorClasses}`}>
      <Icon className="w-3 h-3 mr-1" />
      {status}
      {isOverdue && (
        <span className="ml-1 text-red-600 font-bold">⚠</span>
      )}
    </span>
  )
}

export default StatusBadge