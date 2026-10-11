"use client"

const CountryBar = ({ country, value, maxValue, color = "#22c55e" }) => {
  const percentage = (value / maxValue) * 100

  return (
    <div className="flex items-center space-x-3 mb-3">
      <div className="w-20 text-sm font-medium text-white bg-gray-800 px-2 py-1 rounded text-center">{country}</div>
      <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
        <div
          className="h-6 rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}

export default CountryBar
