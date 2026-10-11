import React from "react";
import { useHistory } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function DailyReportsAnalytics() {
  const history = useHistory();

  // Redirect to Dashboard since all analytics are now merged there
  React.useEffect(() => {
    history.replace("/daily-reports/dashboard");
  }, [history]);

  return (
    <div className="bg-gray-50 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Redirecting to Dashboard...</p>
        <button
          onClick={() => history.push("/daily-reports/dashboard")}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:opacity-90 transition-colors mx-auto"
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
