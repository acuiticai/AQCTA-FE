import React, { useState } from 'react';
import { FiMail, FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import { notifySuccess, notifyError } from '@/utils/toast';
import axios from 'axios';

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const SendVendorEmailModal = ({ isOpen, onClose, contract, vendorEmail }) => {
  const [emailData, setEmailData] = useState({
    to: vendorEmail || '',
    cc: ['']
  });
  const [loading, setLoading] = useState(false);

  const addCCField = () => {
    setEmailData(prev => ({
      ...prev,
      cc: [...prev.cc, '']
    }));
  };

  const removeCCField = (index) => {
    setEmailData(prev => ({
      ...prev,
      cc: prev.cc.filter((_, i) => i !== index)
    }));
  };

  const updateCCField = (index, value) => {
    setEmailData(prev => ({
      ...prev,
      cc: prev.cc.map((cc, i) => i === index ? value : cc)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!emailData.to.trim()) {
      notifyError('Vendor email is required');
      return;
    }

    setLoading(true);
    
    try {
      // Filter out empty CC fields
      const validCCs = emailData.cc.filter(cc => cc.trim() !== '');
      
      const payload = {
        contractId: contract._id,
        contractNo: contract.contractNo,
        to: emailData.to,
        cc: validCCs,
        contractType: 'purchase'
      };

      console.log('📧 Sending vendor email with payload:', payload);

      await axios.post(`${Base_URL}/purchase-contracts/send-approval-email`, payload);
      
      notifySuccess('Purchase contract approval email sent successfully!');
      onClose();
      
    } catch (error) {
      console.error('❌ Error sending vendor email:', error);
      notifyError(error.response?.data?.message || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FiMail className="text-orange-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Send Purchase Contract Approval Email
              </h2>
              <p className="text-sm text-gray-500">
                Contract: {contract?.contractNo || 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Vendor Email (To) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Email *
            </label>
            <input
              type="email"
              value={emailData.to}
              onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              placeholder="vendor@example.com"
              required
            />
          </div>

          {/* CC Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                CC (Optional)
              </label>
              <button
                type="button"
                onClick={addCCField}
                className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 transition-colors"
              >
                <FiPlus size={16} />
                Add CC
              </button>
            </div>
            <div className="space-y-2">
              {emailData.cc.map((cc, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={cc}
                    onChange={(e) => updateCCField(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    placeholder="cc@example.com"
                  />
                  {emailData.cc.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCCField(index)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Email Template Info */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <FiMail className="text-orange-600 mt-0.5" size={16} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-orange-900 mb-1">
                  Email Template
                </h4>
                <p className="text-sm text-orange-700">
                  The system will use the standard purchase contract approval email template that includes contract details, approval link, and professional formatting.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : (
                <>
                  <FiMail size={16} />
                  Send Email
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendVendorEmailModal;
