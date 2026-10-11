"use client"

import { useState, useEffect, useContext } from "react"
import { useTranslation } from "react-i18next"
import { Save, RefreshCw } from "lucide-react"
import axios from "axios"
import { useLocation } from "react-router-dom"
import { AdminContext } from "@/context/AdminContext"
import { notifyError, notifySuccess } from "@/utils/toast"

const BASE_URL = import.meta.env.VITE_APP_API_BASE_URL

const WFHAllowanceForm = ({ allowance, onSave, loading, saving }) => {
  const { t } = useTranslation()
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options })

  const [formData, setFormData] = useState({
    allowedWfh: 0,
  })

  useEffect(() => {
    setFormData({
      allowedWfh: allowance?.allowedWfh || 0,
    })
  }, [allowance])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prevData) => ({
      ...prevData,
      [name]: Number.parseInt(value) || 0,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleReset = () => {
    setFormData({
      allowedWfh: allowance?.allowedWfh || 0,
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {thr("wfh.workFromHomeAllowance", "Work From Home Allowance")}
        </h2>
        <p className="text-sm text-gray-600">
          {thr(
            "wfh.workFromHomeAllowanceDesc",
            "Set the number of work-from-home days allowed per week for this business."
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {thr("wfh.allowedWfhDaysPerWeek", "Allowed WFH Days per Week")}
            </label>
            <input
              type="number"
              name="allowedWfh"
              value={formData.allowedWfh}
              onChange={handleChange}
              min="0"
              max="7"
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              placeholder={thr(
                "wfh.enterDaysPlaceholder",
                "Enter number of days (0-7)"
              )}
              disabled={loading || saving}
            />
            <p className="text-xs text-gray-500 mt-1">
              {thr(
                "wfh.enterDaysHint",
                "Enter 0 to disable work from home, or any number between 1-7"
              )}
            </p>
          </div>

          <div className="flex flex-col justify-center">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                {thr("wfh.currentSetting", "Current Setting")}
              </h3>
              <div className="text-2xl font-bold text-[#A6C437]">
                {loading ? "..." : allowance?.allowedWfh || 0}{" "}
                {thr("days", "days")}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {loading
                  ? thr("loading", "Loading...")
                  : (allowance?.allowedWfh || 0) === 0
                    ? thr(
                        "wfh.workFromHomeDisabled",
                        "Work from home is disabled"
                      )
                    : thr(
                        "wfh.daysAllowedPerWeek",
                        "{{count}} days allowed per week",
                        { count: allowance?.allowedWfh }
                      )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading || saving}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {thr("reset", "Reset")}
          </button>

          <button
            type="submit"
            className="flex items-center px-6 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
            disabled={loading || saving}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving
              ? thr("saving", "Saving...")
              : thr("wfh.saveChanges", "Save Changes")}
          </button>
        </div>
      </form>
    </div>
  )
}

const WFHAllowancePage = () => {
  const { t } = useTranslation()
  const thr = (key, fallback, options) =>
    t(`settingsPage.hr.${key}`, { defaultValue: fallback, ...options })

  const { state } = useContext(AdminContext)
  const { adminInfo } = state
  const [allowance, setAllowance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [organization, setOrganization] = useState(null)
  const [isOrgLoaded, setIsOrgLoaded] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const selectedOrg = searchParams.get("selectedOrg")

    if (selectedOrg) {
      setOrganization(selectedOrg)
    }

    setIsOrgLoaded(true)
  }, [location])

  useEffect(() => {
    if (isOrgLoaded && organization) {
      fetchWFHAllowance(organization)
    }
  }, [organization, isOrgLoaded])

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${adminInfo.token}`,
  }

  const fetchWFHAllowance = async (selectedOrg) => {
    if (!selectedOrg) return

    setLoading(true)
    try {
      const payload = {
        business_id: selectedOrg,
      }

      const response = await axios.post(`${BASE_URL}/wfh-allowance/get`, payload, { headers })

      if (response.data.status) {
        setAllowance(response.data.data)
      }
      setError(null)
    } catch (err) {
      console.error("Failed to fetch WFH allowance:", err)
      setError(
        thr("wfh.failedToFetchWfhAllowance", "Failed to fetch WFH allowance")
      )
      // Set default values if no record exists
      setAllowance({
        business_id: selectedOrg,
        allowedWfh: 0,
        isNew: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (formData) => {
    if (!organization) return

    setSaving(true)
    try {
      const payload = {
        business_id: organization,
        allowedWfh: formData.allowedWfh,
      }

      const response = await axios.post(`${BASE_URL}/wfh-allowance/set`, payload, { headers })

      if (response.data.status) {
        setAllowance(response.data.data)
        notifySuccess(
          thr(
            "wfh.wfhAllowanceUpdatedSuccess",
            "WFH allowance updated successfully"
          )
        )
      }
      setError(null)
    } catch (err) {
      console.error("Failed to save WFH allowance:", err)
      notifyError(
        err.response?.data?.error ||
          thr("wfh.failedToSaveWfhAllowance", "Failed to save WFH allowance")
      )
      setError(
        thr("wfh.failedToSaveWfhAllowance", "Failed to save WFH allowance")
      )
    } finally {
      setSaving(false)
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

  if (error && !allowance) {
    return (
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">
            {thr("errorPrefix", "Error: {{error}}", { error })}
          </p>
          <button
            onClick={() => fetchWFHAllowance(organization)}
            className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            {thr("retry", "Retry")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="bg-gray-50 rounded-lg p-6">
      <WFHAllowanceForm allowance={allowance} onSave={handleSave} loading={loading} saving={saving} />
    </div>
    <button onClick={()=>{console.log("allowance is", allowance)}}>Click me</button>
    </>
  )
}

export default WFHAllowancePage
