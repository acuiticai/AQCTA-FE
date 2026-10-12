import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function RolesTab({ profileData }) {
  const [expandedSections, setExpandedSections] = useState({
    sales: true,
    purchase: true,
  });
  const [role, setRole] = useState("");
  const [assignedModules, setAssignedModules] = useState([]);
  const [assignedBusinesses, setAssignedBusinesses] = useState([]);

  useEffect(() => {
    if (profileData) {
      setRole(profileData.role?.name || "");
      setAssignedModules(profileData.role?.modules || []);
      setAssignedBusinesses(profileData.businesses || []);
    }
  }, [profileData]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="space-y-6">
      <h3 className="ep-title">User Roles</h3>

      <div>
        <label className="ep-label">Role</label>
        <input type="text" value={role} readOnly className="ep-input" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="ep-label" style={{ fontSize: 14, color: "#2f2f2f" }}>
            Assigned Roles
          </h4>
          <div className="space-y-2">
            {assignedModules.length === 0 && (
              <p className="text-sm text-[#6e6e6e]">No modules assigned.</p>
            )}
            {assignedModules.map((module) => (
              <div key={module._id} className="mb-2">
                <button
                  type="button"
                  onClick={() => toggleSection(module.name.toLowerCase())}
                  className="ep-list-item"
                >
                  <span>{module.name}</span>
                  {module.subModules && module.subModules.length > 0 &&
                    (expandedSections[module.name.toLowerCase()] ? (
                      <ChevronUp className="w-4 h-4 text-[#6e6e6e]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#6e6e6e]" />
                    ))}
                </button>
                {expandedSections[module.name.toLowerCase()] &&
                  module.subModules && (
                    <div className="mt-1 pl-2">
                      {module.subModules.map((subModule) => (
                        <div
                          key={subModule._id}
                          className="py-2 px-3 text-sm text-[#6e6e6e]"
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
          <h4 className="ep-label" style={{ fontSize: 14, color: "#2f2f2f" }}>
            Assigned Businesses
          </h4>
          <div className="space-y-2">
            {assignedBusinesses.length === 0 && (
              <p className="text-sm text-[#6e6e6e]">No businesses assigned.</p>
            )}
            {assignedBusinesses.map((business) => (
              <div key={business._id} className="ep-list-item" style={{ cursor: "default" }}>
                {business.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
