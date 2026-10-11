import React, { useState, useEffect } from 'react';
import { Clock, Eye, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';

const WFHAuditTrail = ({ businessId, onFetchAuditTrail }) => {
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (businessId) {
      fetchAuditTrail();
    }
  }, [businessId]);

  const fetchAuditTrail = async () => {
    setLoading(true);
    try {
      const response = await onFetchAuditTrail(businessId);
      setAuditTrail(response.data || []);
    } catch (error) {
      console.error('Failed to fetch audit trail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action.toLowerCase()) {
      case 'create':
        return '➕';
      case 'update':
        return '✏️';
      case 'delete':
        return '🗑️';
      case 'toggle':
        return '🔄';
      default:
        return '📝';
    }
  };

  const getActionColor = (action) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'text-green-600';
      case 'update':
        return 'text-blue-600';
      case 'delete':
        return 'text-red-600';
      case 'toggle':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Clock className="w-5 h-5 mr-2 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Audit Trail</h3>
        </div>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Eye className="w-4 h-4 mr-2" />
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {showPreview && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Settings Preview</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-blue-600" />
              <span className="text-blue-800">Business Default: 3 WFH days/week</span>
            </div>
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2 text-blue-600" />
              <span className="text-blue-800">Min People Required: 2 per department</span>
            </div>
            <div className="flex items-center">
              <span className="text-blue-800">Departments with custom settings: 3/8</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A6C437]"></div>
        </div>
      ) : auditTrail.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No audit trail available</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {auditTrail.map((entry, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex-shrink-0">
                <span className="text-lg">{getActionIcon(entry.action)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium ${getActionColor(entry.action)}`}>
                    {entry.action} - {entry.type}
                  </p>
                  <span className="text-xs text-gray-500">
                    {format(new Date(entry.timestamp), 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1">{entry.description}</p>
                {entry.details && (
                  <div className="mt-2 text-xs text-gray-600">
                    <strong>Details:</strong> {entry.details}
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500">
                  <strong>User:</strong> {entry.userName || 'System'} | 
                  <strong> Department:</strong> {entry.departmentName || 'Business-wide'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Total entries: {auditTrail.length}</span>
          <button
            onClick={fetchAuditTrail}
            className="text-[#A6C437] hover:text-[#A6C437]/80 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default WFHAuditTrail;
