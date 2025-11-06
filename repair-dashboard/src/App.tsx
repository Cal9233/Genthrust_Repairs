import { useEffect } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "./lib/msalConfig";
import { excelService } from "./lib/excelService";
import { Dashboard } from "./components/Dashboard";
import { ROTable } from "./components/ROTable";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import { LogOut, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function App() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isAuthenticated) {
      excelService.setMsalInstance(instance);
    }
  }, [isAuthenticated, instance]);

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch((e) => {
      console.error("Login error:", e);
    });
  };

  const handleLogout = () => {
    instance.logoutPopup().catch((e) => {
      console.error("Logout error:", e);
    });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              GenThrust RO Tracker
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Track aircraft parts sent to repair stations
            </p>
          </div>
          <Button onClick={handleLogin} className="w-full" size="lg">
            Sign in with Microsoft
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              GenThrust RO Tracker
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{accounts[0]?.name}</span>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <Dashboard />
          <div>
            <h2 className="text-2xl font-bold mb-4">Repair Orders</h2>
            <ROTable />
          </div>
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
