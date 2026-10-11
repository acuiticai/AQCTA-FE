import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

export default function RolesTab({ profileData }) {
  const [expandedSections, setExpandedSections] = useState({
    sales: true,
    purchase: true,
  })
  const [role, setRole] = useState("")
  const [assignedModules, setAssignedModules] = useState([])
  const [assignedBusinesses, setAssignedBusinesses] = useState([])

  useEffect(() => {
    if (profileData) {
      setRole(profileData.role?.name || "")
      setAssignedModules(profileData.role?.modules || [])
      setAssignedBusinesses(profileData.businesses || [])
    }
  }, [profileData])

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm text-gray-600 mb-2">Role</label>
        <input
          type="text"
          value={role}
          readOnly
          className="w-full px-4 py-2.5 bg-gray-200 rounded-md text-gray-700"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="text-base font-medium text-gray-800 mb-4">Assigned Roles</h4>
          <div className="space-y-2">
            {assignedModules.map((module) => (
              <div key={module._id} className="mb-2">
                <button
                  onClick={() => toggleSection(module.name.toLowerCase())}
                  className="w-full flex items-center justify-between p-3 bg-gray-100 rounded-md"
                >
                  <span className="text-gray-700">{module.name}</span>
                  {module.subModules && module.subModules.length > 0 && (
                    expandedSections[module.name.toLowerCase()] ? 
                      <ChevronUp className="w-4 h-4 text-gray-400" /> : 
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {expandedSections[module.name.toLowerCase()] && module.subModules && (
                  <div className="mt-1">
                    {module.subModules.map((subModule) => (
                      <div 
                        key={subModule._id} 
                        className="py-2 px-4 text-sm text-gray-600 hover:bg-gray-50"
                      >
                        {subModule.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-base font-medium text-gray-800 mb-4">Assigned Businesses</h4>
          <div className="space-y-2">
            {assignedBusinesses.map((business) => (
              <div key={business._id} className="p-3 bg-gray-100 rounded-md text-gray-700">
                {business.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comment out Save button as requested */}
      {/*
      <div className="flex justify-end pt-4">
        <button className="bg-lime-400 text-white px-8 py-2 rounded-lg hover:bg-lime-500 transition-colors">
          Save
        </button>
      </div>
      */}
    </div>
  )
}