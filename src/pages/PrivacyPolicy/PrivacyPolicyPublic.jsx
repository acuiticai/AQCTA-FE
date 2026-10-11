import React, { Fragment, useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const PrivacyPolicyPublic = () => {
  const history = useHistory();
  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    fetchPrivacyPolicy();
  }, []);

  const fetchPrivacyPolicy = async () => {
    try {
      setLoading(true);
      // Public endpoint - no authentication required
      const response = await axios.get(`${Base_URL}/configuration/public/privacy-policy`);

      if (response.data) {
        setPrivacyPolicy(response.data.privacy_policy || "");
        if (response.data.updatedAt) {
          const date = new Date(response.data.updatedAt);
          const formattedDate = date.toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          setLastUpdated(formattedDate);
        }
      }
    } catch (error) {
      console.error("Error fetching privacy policy:", error);
      // If endpoint doesn't exist or fails, try fallback
      try {
        const fallbackResponse = await axios.get(`${Base_URL}/configuration`);
        if (fallbackResponse.data && fallbackResponse.data.length > 0) {
          const config = fallbackResponse.data[0];
          setPrivacyPolicy(config.privacy_policy || "");
          if (config.updatedAt) {
            const date = new Date(config.updatedAt);
            const formattedDate = date.toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            setLastUpdated(formattedDate);
          }
        }
      } catch (fallbackError) {
        console.error("Error fetching privacy policy (fallback):", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    history.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <Fragment>
      <div className="min-h-screen bg-white overflow-y-auto" style={{ height: '100vh', overflowY: 'auto' }}>
        {/* Header with Back Button - similar to screenshot */}
        <div className="border-b border-gray-200 py-4 px-6 sticky top-0 bg-white z-10">
          <button
            onClick={handleBackToHome}
            className="flex items-center gap-2 text-p-blue hover:text-p-blue-dark transition-colors font-medium"
          >
            <FiArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back to Home</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-6 sm:px-8 md:px-12 py-12 pb-20">
          {/* Title Section */}
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
              Privacy Policy
            </h1>
            {lastUpdated && (
              <p className="text-base text-gray-600">Last updated: {lastUpdated}</p>
            )}
          </div>

          {/* Privacy Policy Content */}
          <div className="privacy-policy-content">
            {privacyPolicy ? (
              <div
                className="text-gray-800 leading-relaxed text-base"
                dangerouslySetInnerHTML={{ __html: privacyPolicy }}
              />
            ) : (
              <div className="text-gray-600 text-center py-16">
                <p className="text-lg mb-2">Privacy policy content is not available at this time.</p>
                <p className="text-sm">Please contact the administrator.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        body {
          overflow-y: auto !important;
          height: auto !important;
        }

        html {
          overflow-y: auto !important;
          height: auto !important;
        }

        #root {
          overflow-y: auto !important;
          height: auto !important;
        }

        .privacy-policy-content {
          line-height: 1.8;
          color: #1f2937;
        }

        .privacy-policy-content p {
          margin-bottom: 1.25rem;
          line-height: 1.8;
          color: #1f2937;
          font-size: 16px;
        }

        .privacy-policy-content h1,
        .privacy-policy-content h2,
        .privacy-policy-content h3,
        .privacy-policy-content h4 {
          color: #111827;
          font-weight: 700;
          margin-top: 2.5rem;
          margin-bottom: 1.25rem;
          line-height: 1.3;
        }

        .privacy-policy-content h1 {
          font-size: 2rem;
        }

        .privacy-policy-content h2 {
          font-size: 1.5rem;
          margin-top: 2rem;
        }

        .privacy-policy-content h3 {
          font-size: 1.25rem;
          margin-top: 1.75rem;
        }

        .privacy-policy-content h4 {
          font-size: 1.125rem;
          margin-top: 1.5rem;
        }

        .privacy-policy-content ul,
        .privacy-policy-content ol {
          margin-bottom: 1.25rem;
          padding-left: 2rem;
          color: #1f2937;
        }

        .privacy-policy-content li {
          margin-bottom: 0.75rem;
          line-height: 1.8;
          color: #1f2937;
          font-size: 16px;
        }

        .privacy-policy-content ul li {
          list-style-type: disc;
        }

        .privacy-policy-content ol li {
          list-style-type: decimal;
        }

        .privacy-policy-content strong,
        .privacy-policy-content b {
          font-weight: 600;
          color: #111827;
        }

        .privacy-policy-content a {
          color: var(--p-blue);
          text-decoration: underline;
          transition: color 0.2s;
        }

        .privacy-policy-content a:hover {
          color: var(--p-blue-dark);
        }

        .privacy-policy-content em {
          font-style: italic;
        }

        .privacy-policy-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1rem;
          margin: 1.5rem 0;
          color: #6b7280;
          font-style: italic;
        }

        .privacy-policy-content hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 2rem 0;
        }
      `}</style>
    </Fragment>
  );
};

export default PrivacyPolicyPublic;
