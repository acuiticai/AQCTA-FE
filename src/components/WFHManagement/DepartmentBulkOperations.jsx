import React, { useState } from 'react';
import { Users, Settings, Download, Upload } from 'lucide-react';
import { notifyError, notifySuccess } from '@/utils/toast';

const DepartmentBulkOperations = ({ 
  departments, 
  onBulkUpdate, 
  onExport, 
  onImport,
  type = "Allowance" 
}) => {
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkDescription, setBulkDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectAll = () => {
    if (selectedDepartments.length === departments.length) {
      setSelectedDepartments([]);
    } else {
      setSelectedDepartments(departments.map(dept => dept._id));
    }
  };

  const handleDepartmentToggle = (departmentId) => {
    setSelectedDepartments(prev => 
      prev.includes(departmentId) 
        ? prev.filter(id => id !== departmentId)
        : [...prev, departmentId]
    );
  };

  const handleBulkUpdate = async () => {
    if (selectedDepartments.length === 0) {
      notifyError('Please select at least one department');
      return;
    }

    if (type === "Allowance" && (!bulkValue || bulkValue < 0 || bulkValue > 7)) {
      notifyError('Please enter a valid WFH allowance (0-7 days)');
      return;
    }

    if (type === "Capacity" && (!bulkValue || bulkValue < 1)) {
      notifyError('Please enter a valid minimum people required (minimum 1)');
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        departmentIds: selectedDepartments,
        value: type === "Allowance" ? parseInt(bulkValue) : parseInt(bulkValue),
        description: type === "Capacity" ? bulkDescription : undefined,
        type: type.toLowerCase()
      };

      await onBulkUpdate(payload);
      setSelectedDepartments([]);
      setBulkValue('');
      setBulkDescription('');
      notifySuccess(`Bulk ${type.toLowerCase()} update completed successfully`);
    } catch (error) {
      notifyError(`Failed to update ${type.toLowerCase()} settings`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      await onExport();
      notifySuccess('Configuration exported successfully');
    } catch (error) {
      notifyError('Failed to export configuration');
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      await onImport(formData);
      notifySuccess('Configuration imported successfully');
    } catch (error) {
      notifyError('Failed to import configuration');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Bulk {type} Operations
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={handleExport}
            className="flex items-center px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          <label className="flex items-center px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            Import
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="space-y-4">
        {/* Department Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Select Departments
            </label>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {selectedDepartments.length === departments.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
            {departments.map((dept) => (
              <label key={dept._id} className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedDepartments.includes(dept._id)}
                  onChange={() => handleDepartmentToggle(dept._id)}
                  className="rounded border-gray-300 text-[#A6C437] focus:ring-[#A6C437]"
                />
                <span className="truncate">{dept.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Bulk Value Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === "Allowance" ? "WFH Days per Week" : "Minimum People Required"}
            </label>
            <input
              type="number"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              min={type === "Allowance" ? 0 : 1}
              max={type === "Allowance" ? 7 : undefined}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              placeholder={type === "Allowance" ? "0-7 days" : "Minimum 1"}
            />
          </div>

          {type === "Capacity" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={bulkDescription}
                onChange={(e) => setBulkDescription(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
                placeholder="Capacity requirements description"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {selectedDepartments.length} department(s) selected
          </div>
          
          <button
            onClick={handleBulkUpdate}
            disabled={isProcessing || selectedDepartments.length === 0}
            className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Settings className="w-4 h-4 mr-2" />
            {isProcessing ? 'Updating...' : `Update ${type}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentBulkOperations;
