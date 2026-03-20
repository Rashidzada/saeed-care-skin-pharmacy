// G:/msms/frontend/src/components/StatCard.jsx
export default function StatCard({ title, value, icon: Icon, color = 'blue', subtitle, onClick }) {
  const colors = {
    blue: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    purple: 'bg-teal-50 text-teal-700 border-teal-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  }

  const iconColors = {
    blue: 'bg-emerald-100 text-emerald-700',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-teal-100 text-teal-700',
    orange: 'bg-orange-100 text-orange-600',
  }

  return (
    <div
      className={`bg-white rounded-xl border p-5 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${colors[color]}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconColors[color]}`}>
            <Icon size={24} />
          </div>
        )}
      </div>
    </div>
  )
}
