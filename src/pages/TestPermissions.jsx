import React, { useContext, useEffect, useState } from "react";
import { AdminContext } from "@/context/AdminContext";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const TestPermissions = () => {
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const [userModules, setUserModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminInfo?.token) {
      fetchUserModules();
    }
  }, [adminInfo]);

  const fetchUserModules = async () => {
    try {
      const headers = {
        "Content-Type": "application/json",
        authorization: `Bearer ${adminInfo.token}`,
      };

      const response = await axios.get(
        `${Base_URL}/Module/get_Dynamic_Modules/${adminInfo.id}`,
        { headers }
      );

      console.log("Full API response:", response.data);
      setUserModules(response.data.role.modules || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching user modules:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">User Permissions Test</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Current User Info</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>Name:</strong> {adminInfo?.name}
          </div>
          <div>
            <strong>Email:</strong> {adminInfo?.email}
          </div>
          <div>
            <strong>Role:</strong> {adminInfo?.role?.name}
          </div>
          <div>
            <strong>Landing Page:</strong> {adminInfo?.role?.landing_page}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Assigned Modules</h2>
        {userModules.length === 0 ? (
          <p className="text-gray-500">No modules assigned to this user.</p>
        ) : (
          <div className="space-y-4">
            {userModules.map((module) => (
              <div key={module._id} className="border rounded p-4">
                <h3 className="font-semibold text-lg mb-2">{module.name}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <strong>Path:</strong> {module.path}
                  </div>
                  <div>
                    <strong>Permissions:</strong> {module.permissions?.length || 0}
                  </div>
                </div>
                
                {module.subModules && module.subModules.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-medium mb-2">Sub-modules:</h4>
                    <div className="space-y-2 ml-4">
                      {module.subModules.map((subModule) => (
                        <div key={subModule._id} className="border-l-2 pl-3">
                          <div className="font-medium">{subModule.name}</div>
                          <div className="text-sm text-gray-600">
                            Path: {subModule.path} | Permissions: {subModule.permissions?.length || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">How to Test:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Try accessing different pages via URL</li>
          <li>Pages you have access to should load normally</li>
          <li>Pages you don't have access to should redirect to /unauthorized</li>
          <li>Check the browser console for any errors</li>
        </ol>
      </div>

      <div className="mt-6 bg-yellow-50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Debug Information:</h3>
        <div className="text-sm">
          <p><strong>Current Path:</strong> {window.location.pathname}</p>
          <p><strong>User ID:</strong> {adminInfo?.id}</p>
          <p><strong>Role:</strong> {adminInfo?.role?.name}</p>
          <p><strong>Total Modules:</strong> {userModules.length}</p>
        </div>
      </div>
    </div>
  );
};

export default TestPermissions; 