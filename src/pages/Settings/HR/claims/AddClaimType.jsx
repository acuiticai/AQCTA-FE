"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { AiOutlineClose, AiOutlinePlus, AiOutlineDelete } from "react-icons/ai"
import axios from "axios"
import ClaimTypeDropdown from "./ClaimTypeDropdown" // Import the new component

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL

const AddClaimType = ({ onClose, onSuccess, selectedOrg, claimGroups }) => {
  const { t } = useTranslation()
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options })

  const [formData, setFormData] = useState({
    bid: selectedOrg,
    type: "",
    defaultLimit: 0,
    claimGroupIds: [], // Array to store selected claim group IDs
    claimLimits: [],
    status: true,
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    })
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      })
    }
  }

  // Handle claim group selection from dropdown
  const handleClaimGroupsChange = (selectedGroupIds) => {
    setFormData({
      ...formData,
      claimGroupIds: selectedGroupIds,
    })

    // Clear error when field is edited
    if (errors.claimGroupIds) {
      setErrors({
        ...errors,
        claimGroupIds: "",
      })
    }
  }

  const handleLimitChange = (index, field, value) => {
    const updatedLimits = [...formData.claimLimits]
    updatedLimits[index][field] = field === "maxAmount" ? Number.parseFloat(value) : Number.parseInt(value, 10)
    setFormData({
      ...formData,
      claimLimits: updatedLimits,
    })
  }

  const addClaimLimit = () => {
    // Get the highest toYear from existing limits
    const highestYear =
      formData.claimLimits.length > 0 ? Math.max(...formData.claimLimits.map((limit) => limit.toYear)) : 0

    setFormData({
      ...formData,
      claimLimits: [
        ...formData.claimLimits,
        {
          fromYear: highestYear, // Start from the highest year
          toYear: highestYear + 1, // End one year later
          maxAmount: 0,
        },
      ],
    })
  }

  const removeClaimLimit = (index) => {
    const updatedLimits = [...formData.claimLimits]
    updatedLimits.splice(index, 1)
    setFormData({
      ...formData,
      claimLimits: updatedLimits,
    })
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.bid) newErrors.bid = thr("bidIsRequired", "BID is required")
    if (!formData.type) newErrors.type = thr("claimTypes.claimTypeRequired", "Claim Type is required")
    if (!formData.defaultLimit) newErrors.defaultLimit = thr("claimTypes.defaultLimitRequired", "default Limit is required")
    if (formData.claimGroupIds.length === 0) newErrors.claimGroupIds = thr("claimTypes.atLeastOneClaimGroupRequired", "At least one Claim Group is required")

    // Validate claim limits
    formData.claimLimits.forEach((limit, index) => {
      if (limit.fromYear < 0) {
        newErrors[`claimLimits.${index}.fromYear`] = thr("claimTypes.fromYearMinZero", "From year must be at least 0")
      }
      if (limit.toYear <= 0) {
        newErrors[`claimLimits.${index}.toYear`] = thr("claimTypes.toYearMinOne", "To year must be at least 1")
      }
      if (limit.fromYear >= limit.toYear) {
        newErrors[`claimLimits.${index}.toYear`] = thr("claimTypes.toYearGreaterThanFrom", "To year must be greater than From year")
      }
      if (limit.maxAmount < 0) {
        newErrors[`claimLimits.${index}.maxAmount`] = thr("claimTypes.amountMustBePositive", "Amount must be positive")
      }

      // Check for overlapping year ranges
      formData.claimLimits.forEach((otherLimit, otherIndex) => {
        if (index !== otherIndex) {
          // Check if this range overlaps with another range
          if (limit.fromYear < otherLimit.toYear && limit.toYear > otherLimit.fromYear) {
            newErrors[`claimLimits.${index}.overlap`] = thr("claimTypes.yearRangesCannotOverlap", "Year ranges cannot overlap")
          }
        }
      })
    })

    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validate()

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await axios.post(`${Base_URL}/claim-types`, formData)
      onSuccess()
    } catch (error) {
      console.error("Error creating claim type:", error)
      if (error.response && error.response.data) {
        setErrors({
          form: error.response.data.message || thr("claimTypes.createFailed", "Failed to create claim type"),
        })
      } else {
        setErrors({ form: thr("claimTypes.createFailedRetry", "Failed to create claim type. Try again later.") })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{thr("claimTypes.addClaimType", "Add Claim Type")}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <AiOutlineClose size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4">
            {errors.form && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">{errors.form}</div>
            )}

            {/* Type */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="col-span-1">
                {thr("claimTypes.claimType", "Claim Type")} <span className="text-red-500">*</span>
              </label>
              <div className="col-span-2">
                <input
                  type="text"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className={`w-full p-2 bg-gray-100 rounded border ${
                    errors.type ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type}</p>}
              </div>
            </div>

            {/* Claim Groups - Dropdown Selection */}
            <div className="grid grid-cols-3 gap-4 items-start">
              <label className="col-span-1 pt-2">
                {thr("claimTypes.claimGroups", "Claim Groups")} <span className="text-red-500">*</span>
              </label>
              <div className="col-span-2">
                <ClaimTypeDropdown
                  options={claimGroups}
                  value={formData.claimGroupIds}
                  onChange={handleClaimGroupsChange}
                  label=""
                />
                {errors.claimGroupIds && <p className="text-red-500 text-xs mt-1">{errors.claimGroupIds}</p>}
              </div>
            </div>

            {/* Default Claim Limits */}
            <div className="grid grid-cols-3 gap-4 items-start">
              <label className="col-span-1 pt-2">
                {thr("claimTypes.defaultLimit", "Default Limit")} <span className="text-red-500">*</span>
              </label>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  name="defaultLimit"
                  value={formData.defaultLimit}
                  onChange={handleChange}
                  className={`w-full p-2 bg-gray-100 rounded border ${
                    errors.defaultLimit ? "border-red-500" : "border-gray-200"
                  }`}
                />
              </div>
              {errors.defaultLimit && <p className="text-red-500 text-xs mt-1">{errors.defaultLimit}</p>}
            </div>

            {/* Claim Limits - Now Optional */}
            <div className="grid grid-cols-3 gap-4 items-start">
              <label className="col-span-1 pt-2">
                {thr("claimTypes.customClaimLimits", "Custom Claim Limits")}
                <span className="block text-xs text-gray-500 mt-1">{thr("claimTypes.basedOnYearsInCompanyOptional", "Based on years in company (Optional)")}</span>
              </label>
              <div className="col-span-2 space-y-2">
                {formData.claimLimits.length > 0 && (
                  <>
                    {formData.claimLimits.map((limit, index) => (
                      <>
                        <div key={index} className="flex items-center space-x-2">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">{thr("claimTypes.yearsFrom", "Years From")}</label>
                            <input
                              type="number"
                              min="0"
                              value={limit.fromYear}
                              onChange={(e) => handleLimitChange(index, "fromYear", e.target.value)}
                              className={`w-full p-2 bg-gray-100 rounded border ${
                                errors[`claimLimits.${index}.fromYear`] ? "border-red-500" : "border-gray-200"
                              }`}
                            />
                            {errors[`claimLimits.${index}.fromYear`] && (
                              <p className="text-red-500 text-xs mt-1">{errors[`claimLimits.${index}.fromYear`]}</p>
                            )}
                          </div>

                          <div className="flex-1">
                            <label className="text-xs text-gray-500">{thr("claimTypes.yearsTo", "Years To")}</label>
                            <input
                              type="number"
                              value={limit.toYear}
                              onChange={(e) => handleLimitChange(index, "toYear", e.target.value)}
                              className={`w-full p-2 bg-gray-100 rounded border ${
                                errors[`claimLimits.${index}.toYear`] ? "border-red-500" : "border-gray-200"
                              }`}
                            />
                            {errors[`claimLimits.${index}.toYear`] && (
                              <p className="text-red-500 text-xs mt-1">{errors[`claimLimits.${index}.toYear`]}</p>
                            )}
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">{thr("claimTypes.maxAmount", "Max Amount")}</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={limit.maxAmount}
                              onChange={(e) => handleLimitChange(index, "maxAmount", e.target.value)}
                              className={`w-full p-2 bg-gray-100 rounded border ${
                                errors[`claimLimits.${index}.maxAmount`] ? "border-red-500" : "border-gray-200"
                              }`}
                            />
                            {errors[`claimLimits.${index}.maxAmount`] && (
                              <p className="text-red-500 text-xs mt-1">{errors[`claimLimits.${index}.maxAmount`]}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeClaimLimit(index)}
                            className="mt-5 text-red-500 hover:text-red-700"
                          >
                            <AiOutlineDelete size={20} />
                          </button>
                        </div>
                        {errors[`claimLimits.${index}.overlap`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`claimLimits.${index}.overlap`]}</p>
                        )}
                      </>
                    ))}
                  </>
                )}

                <button
                  type="button"
                  onClick={addClaimLimit}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded flex items-center text-sm hover:bg-gray-300"
                >
                  <AiOutlinePlus className="mr-1" />
                  {formData.claimLimits.length === 0
                    ? thr("claimTypes.addCustomLimit", "Add Custom Limit")
                    : thr("claimTypes.addAnotherLimit", "Add Another Limit")}
                </button>
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <label className="col-span-1">{thr("status", "Status")}</label>
              <div className="col-span-2 flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="status"
                    className="sr-only peer"
                    checked={formData.status}
                    onChange={handleChange}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    {formData.status ? thr("active", "Active") : thr("inactive", "Inactive")}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="p-4 border-t flex justify-end gap-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-gray-700">
              {thr("cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#A6C437] text-white rounded hover:bg-[#A6C437] disabled:bg-lime-300"
            >
              {isSubmitting ? thr("saving", "Saving...") : thr("save", "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddClaimType
