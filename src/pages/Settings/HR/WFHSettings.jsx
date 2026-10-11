"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Save, Users, Building2, ChevronDown, ChevronUp, Edit } from "lucide-react"
import Header from "@/components/header/Header"
import AppLayout from "../app-layout"
import { useLocation } from "react-router-dom"
import ToggleSwitch from "@/components/toggle/ToggleSwitch"
import { notifyError } from "@/utils/toast"
import { useWFHManagement } from "@/hooks/useWFHManagement"
import SettingsOrgBanner from "../SettingsOrgBanner"
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions"

const BusinessDefaultsCard = ({ allowance, onSave, loading, saving, canUpdate }) => {
  const { t } = useTranslation()
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options })

  const [formData, setFormData] = useState({
    allowedWfh: 0,
    defaultMinimumPeopleRequired: 0,
  })
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setFormData({
      allowedWfh: allowance?.allowedWfh || 0,
      defaultMinimumPeopleRequired: allowance?.defaultMinimumPeopleRequired || 0,
    })
  }, [allowance])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: Number.parseInt(value) || 0,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canUpdate) return
    try {
      await onSave(formData)
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error("Failed to save business defaults:", error)
      notifyError(
        thr("wfh.failedToSaveBusinessDefaults", "Failed to save business defaults")
      )
    }
  }

  const handleCancel = () => {
    setFormData({
      allowedWfh: allowance?.allowedWfh || 0,
      defaultMinimumPeopleRequired: allowance?.defaultMinimumPeopleRequired || 0,
    })
    setIsEditing(false)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Building2 className="w-5 h-5 text-[#A6C437] mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            {thr("wfh.businessDefaultSettings", "Business Default Settings")}
          </h2>
        </div>
        {!isEditing && canUpdate && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            <Edit className="w-4 h-4 mr-1" />
            {thr("edit", "Edit")}
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-6">
        {thr(
          "wfh.businessDefaultsDesc",
          "These settings apply to all departments unless overridden by department-specific rules."
        )}
      </p>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {thr("wfh.defaultWfhDaysPerWeek", "Default WFH Days per Week")}
              </label>
              <input
                type="number"
                name="allowedWfh"
                value={formData.allowedWfh}
                onChange={handleChange}
                min="0"
                max="7"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {thr(
                  "wfh.defaultMinimumPeopleRequired",
                  "Default Minimum People Required"
                )}
              </label>
              <input
                type="number"
                name="defaultMinimumPeopleRequired"
                value={formData.defaultMinimumPeopleRequired}
                onChange={handleChange}
                min="0"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                disabled={saving}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              {thr("cancel", "Cancel")}
            </button>
            <button
              type="submit"
              className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving
                ? thr("saving", "Saving...")
                : thr("wfh.saveChanges", "Save Changes")}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-[#A6C437] mb-1">
              {loading ? "..." : allowance?.allowedWfh || 0}{" "}
              {thr("days", "days")}
            </div>
            <p className="text-sm text-gray-600">
              {thr("wfh.wfhAllowancePerWeek", "WFH allowance per week")}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-[#A6C437] mb-1">
              {loading ? "..." : allowance?.defaultMinimumPeopleRequired || 0}{" "}
              {thr("people", "people")}
            </div>
            <p className="text-sm text-gray-600">
              {thr("wfh.minimumPeopleRequiredLabel", "Minimum people required")}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

const DepartmentRow = ({
  department,
  allowances,
  capacities,
  businessDefaults,
  onEditAllowance,
  onEditCapacity,
  onToggleAllowance,
  onToggleCapacity,
  toggleLoading = {},
  canUpdate,
}) => {
  const { t } = useTranslation()
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options })

  const [isExpanded, setIsExpanded] = useState(false)

  const departmentAllowance = allowances?.find((a) => a.department_id === department._id && !a.isDefault)
  const defaultAllowance = allowances?.find((a) => a.isDefault)
  const departmentCapacity = capacities?.departmentCapacities?.find((c) => c.department_id?._id === department._id)

  const hasCustomAllowance = departmentAllowance && departmentAllowance.isActive === true
  const hasCustomCapacity = departmentCapacity && departmentCapacity.isActive === true
  const hasAnyCustom = hasCustomAllowance || hasCustomCapacity

  const effectiveWfhDays = hasCustomAllowance
    ? departmentAllowance?.allowedWfh || 0
    : defaultAllowance?.allowedWfh || businessDefaults?.allowedWfh || 0

  const effectiveMinPeople = hasCustomCapacity
    ? departmentCapacity?.minimumPeopleRequired || 0
    : capacities?.defaultMinimumPeopleRequired || businessDefaults?.defaultMinimumPeopleRequired || 0

  const allowanceToggleLoading = toggleLoading[`allowance-${department._id}`] || false
  const capacityToggleLoading = toggleLoading[`capacity-${department._id}`] || false

  return (
    <div className="border border-gray-200 rounded-lg mb-3">
      <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h3 className="font-medium text-gray-900">{department.name}</h3>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-sm text-gray-600">
                  {thr("wfh.wfhDaysPerWeekShort", "{{count}} WFH days/week", {
                    count: effectiveWfhDays,
                  })}
                </span>
                <span className="text-sm text-gray-600">
                  {thr(
                    "wfh.minPeopleRequiredShort",
                    "Min {{count}} people required",
                    { count: effectiveMinPeople }
                  )}
                </span>
                {!hasAnyCustom && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                    {thr("wfh.usingDefaults", "Using defaults")}
                  </span>
                )}
                {hasAnyCustom && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-[#A6C437] bg-opacity-10 text-[#A6C437]">
                    {thr("wfh.customSettings", "Custom settings")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {canUpdate && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEditAllowance(department, departmentAllowance)
                }}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                title={thr("wfh.editWfhAllowanceTitle", "Edit WFH allowance")}
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* WFH Allowance Section */}
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">
                  {thr("wfh.wfhAllowance", "WFH Allowance")}
                </h4>
                <div className="flex items-center space-x-2">
                  <ToggleSwitch
                    isOn={hasCustomAllowance}
                    handleToggle={() => onToggleAllowance(department, departmentAllowance)}
                    disabled={allowanceToggleLoading || !canUpdate}
                  />
                  {allowanceToggleLoading && (
                    <span className="text-xs text-gray-500">
                      {thr("updating", "Updating...")}
                    </span>
                  )}
                  {canUpdate && hasCustomAllowance && !allowanceToggleLoading && (
                    <button
                      onClick={() => onEditAllowance(department, departmentAllowance)}
                      className="p-1 text-blue-600 hover:text-blue-800"
                      title={thr("wfh.editAllowanceTitle", "Edit allowance")}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {thr("wfh.daysPerWeek", "{{count}} days per week", {
                  count: effectiveWfhDays,
                })}
              </div>
              <p className="text-sm text-gray-600">
                {hasCustomAllowance
                  ? thr("wfh.customSetting", "Custom setting")
                  : thr("wfh.usingDefaultDays", "Using default ({{count}} days)", {
                      count:
                        defaultAllowance?.allowedWfh ||
                        businessDefaults?.allowedWfh ||
                        0,
                    })}
              </p>
            </div>

            {/* Capacity Requirements Section */}
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">
                  {thr("wfh.capacityRequirements", "Capacity Requirements")}
                </h4>
                <div className="flex items-center space-x-2">
                  <ToggleSwitch
                    isOn={hasCustomCapacity}
                    handleToggle={() => onToggleCapacity(department, departmentCapacity)}
                    disabled={capacityToggleLoading || !canUpdate}
                  />
                  {capacityToggleLoading && (
                    <span className="text-xs text-gray-500">
                      {thr("updating", "Updating...")}
                    </span>
                  )}
                  {canUpdate && hasCustomCapacity && !capacityToggleLoading && (
                    <button
                      onClick={() => onEditCapacity(department, departmentCapacity)}
                      className="p-1 text-blue-600 hover:text-blue-800"
                      title={thr("wfh.editCapacityTitle", "Edit capacity")}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-lg font-semibold text-gray-900 mb-1">
                {thr("wfh.peopleMinimum", "{{count}} people minimum", {
                  count: effectiveMinPeople,
                })}
              </div>
              <p className="text-sm text-gray-600">
                {hasCustomCapacity
                  ? departmentCapacity?.description ||
                    thr("wfh.customSetting", "Custom setting")
                  : thr(
                      "wfh.usingDefaultPeople",
                      "Using default ({{count}} people)",
                      {
                        count:
                          capacities?.defaultMinimumPeopleRequired ||
                          businessDefaults?.defaultMinimumPeopleRequired ||
                          0,
                      }
                    )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Edit Modal Component - UPDATED to handle new API structure
const EditModal = ({ isOpen, onClose, type, item, department, onSubmit, businessDefaults, canSubmit }) => {
  const { t } = useTranslation()
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options })

  const [formData, setFormData] = useState({
    _id: "",
    allowedWfh: 0,
    minimumPeopleRequired: 1,
    description: "",
    status: "active",
  })

  useEffect(() => {
    if (item) {
      setFormData({
        _id: item._id || "",
        allowedWfh: item.allowedWfh || businessDefaults?.allowedWfh || 0,
        minimumPeopleRequired: item.minimumPeopleRequired || businessDefaults?.defaultMinimumPeopleRequired || 0,
        description: item.description || "",
        status: item.isActive ? "active" : "inactive", // Updated to use isActive
      })
    } else {
      setFormData({
        _id: "",
        allowedWfh: businessDefaults?.allowedWfh || 0,
        minimumPeopleRequired: businessDefaults?.defaultMinimumPeopleRequired || 0,
        description: "",
        status: "active",
      })
    }
  }, [item, isOpen, businessDefaults])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "allowedWfh" || name === "minimumPeopleRequired" ? Number.parseInt(value) || 0 : value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData, department)
  }

  if (!isOpen) return null

  const typeLabel =
    type === "WFH Allowance"
      ? thr("wfh.wfhAllowance", "WFH Allowance")
      : thr("wfh.capacityRequirements", "Capacity Requirements")

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[500px] max-w-[90%] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {item
              ? thr(
                  "wfh.editTypeForDepartment",
                  "Edit {{type}} for {{department}}",
                  { type: typeLabel, department: department?.name }
                )
              : thr(
                  "wfh.addTypeForDepartment",
                  "Add {{type}} for {{department}}",
                  { type: typeLabel, department: department?.name }
                )}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === "WFH Allowance" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {thr("wfh.wfhDaysPerWeek", "WFH Days per Week")}
              </label>
              <input
                type="number"
                name="allowedWfh"
                value={formData.allowedWfh}
                onChange={handleChange}
                min="0"
                max="7"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {thr("wfh.defaultDaysHint", "Default: {{count}} days", {
                  count: businessDefaults?.allowedWfh || 0,
                })}
              </p>
            </div>
          )}

          {type === "Capacity Requirements" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {thr("wfh.minimumPeopleRequired", "Minimum People Required")}
                </label>
                <input
                  type="number"
                  name="minimumPeopleRequired"
                  value={formData.minimumPeopleRequired}
                  onChange={handleChange}
                  min="0"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {thr("wfh.defaultPeopleHint", "Default: {{count}} people", {
                    count: businessDefaults?.defaultMinimumPeopleRequired || 0,
                  })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {thr("description", "Description")}
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                  placeholder={thr(
                    "wfh.capacityDescriptionPlaceholder",
                    "Describe the capacity requirements..."
                  )}
                />
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {thr("cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
            >
              {item ? thr("update", "Update") : thr("add", "Add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const WFHSettingsPage = () => {
  const { t } = useTranslation()
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options })

  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [modalType, setModalType] = useState("WFH Allowance")
  const [organization, setOrganization] = useState(null)
  const [isOrgLoaded, setIsOrgLoaded] = useState(false)
  const [toggleLoading, setToggleLoading] = useState({})
  const location = useLocation()
  const { canUpdate } = useSettingsCrudPermissions()

  const {
    businessAllowance,
    businessLoading,
    businessSaving,
    departments,
    departmentAllowances,
    departmentCapacities,
    departmentsLoading,
    error,
    saveBusinessAllowance,
    saveDepartmentAllowance,
    deleteDepartmentAllowance,
    toggleDepartmentAllowanceStatus,
    saveDepartmentCapacity,
    deleteDepartmentCapacity,
    toggleDepartmentCapacityStatus,
  } = useWFHManagement(organization)

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const selectedOrg = searchParams.get("selectedOrg")
    if (selectedOrg) {
      setOrganization(selectedOrg)
    }
    setIsOrgLoaded(true)
  }, [location])

  const handleToggleAllowance = async (department, departmentAllowance) => {
    if (!canUpdate) return
    const toggleKey = `allowance-${department._id}`
    setToggleLoading((prev) => ({ ...prev, [toggleKey]: true }))

    try {
      await toggleDepartmentAllowanceStatus(department, departmentAllowance)
      // Force page reload after successful toggle
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error("Toggle allowance failed:", error)
      notifyError(
        thr("wfh.failedToToggleWfhAllowance", "Failed to toggle WFH allowance")
      )
      setToggleLoading((prev) => ({ ...prev, [toggleKey]: false }))
    }
  }

  const handleToggleCapacity = async (department, departmentCapacity) => {
    if (!canUpdate) return
    const toggleKey = `capacity-${department._id}`
    setToggleLoading((prev) => ({ ...prev, [toggleKey]: true }))

    try {
      await toggleDepartmentCapacityStatus(department, departmentCapacity)
      // Force page reload after successful toggle
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      console.error("Toggle capacity failed:", error)
      notifyError(
        thr(
          "wfh.failedToToggleCapacityRequirements",
          "Failed to toggle capacity requirements"
        )
      )
      setToggleLoading((prev) => ({ ...prev, [toggleKey]: false }))
    }
  }

  const handleSubmit = async (formData, department) => {
    if (!canUpdate) return
    try {
      if (modalType === "WFH Allowance") {
        await saveDepartmentAllowance(formData, department)
      } else if (modalType === "Capacity Requirements") {
        await saveDepartmentCapacity(formData, department)
      }

      setModalOpen(false)
      setEditItem(null)
      setSelectedDepartment(null)

      setTimeout(() => {
        window.location.reload()
      }, 300)
    } catch (err) {
      console.error("Failed to save item", err)
      notifyError(thr("wfh.failedToSaveItem", "Failed to save item"))
    }
  }

  if (!isOrgLoaded || !organization) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <p className="text-gray-600">
          {thr("loadingOrganization", "Loading organization...")}
        </p>
      </div>
    )
  }

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {thr("wfh.wfhManagement", "WFH Management")}
              </h1>
              <p className="text-gray-600 mt-1">
                {thr(
                  "wfh.wfhManagementDesc",
                  "Configure work-from-home policies and department-specific overrides"
                )}
              </p>
            </div>
          </div>
          <SettingsOrgBanner />

          <BusinessDefaultsCard
            allowance={businessAllowance}
            onSave={saveBusinessAllowance}
            loading={businessLoading}
            saving={businessSaving}
            canUpdate={canUpdate}
          />

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Users className="w-5 h-5 text-[#A6C437] mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {thr("wfh.departmentSettings", "Department Settings")}
                </h2>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              {thr(
                "wfh.departmentSettingsDesc",
                "Override default settings for specific departments. Toggle switches enable/disable custom settings."
              )}
            </p>

            {departmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-gray-600">
                  {thr("wfh.loadingDepartments", "Loading departments...")}
                </p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-red-600">
                  {thr("errorPrefix", "Error: {{error}}", { error })}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {departments.map((dept) => (
                  <DepartmentRow
                    key={dept._id}
                    department={dept}
                    allowances={departmentAllowances}
                    capacities={departmentCapacities}
                    businessDefaults={businessAllowance}
                    onEditAllowance={(dept, item) => {
                      if (!canUpdate) return
                      setModalType("WFH Allowance")
                      setEditItem(item)
                      setSelectedDepartment(dept)
                      setModalOpen(true)
                    }}
                    onEditCapacity={(dept, item) => {
                      if (!canUpdate) return
                      setModalType("Capacity Requirements")
                      setEditItem(item)
                      setSelectedDepartment(dept)
                      setModalOpen(true)
                    }}
                    onToggleAllowance={handleToggleAllowance}
                    onToggleCapacity={handleToggleCapacity}
                    toggleLoading={toggleLoading}
                    canUpdate={canUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <EditModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setEditItem(null)
            setSelectedDepartment(null)
          }}
          type={modalType}
          item={editItem}
          department={selectedDepartment}
          onSubmit={handleSubmit}
          businessDefaults={businessAllowance}
          canSubmit={canUpdate}
        />
      </div>
    </AppLayout>
  )
}

export default WFHSettingsPage
