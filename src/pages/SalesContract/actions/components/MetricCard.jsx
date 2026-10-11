"use client"

const MetricCard = ({ title, value, icon, bgColor = "bg-white", textColor = "text-gray-900" }) => {
  return (
    <div className={`${bgColor} rounded-lg p-6 shadow-sm border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold ${textColor} mt-1`}>{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  )
}

export default MetricCard
