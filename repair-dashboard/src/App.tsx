import { useEffect, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "./lib/msalConfig";
import { excelService } from "./lib/excelService";
import { shopService } from "./lib/shopService";
import { Dashboard } from "./components/Dashboard";
import { ROTable } from "./components/ROTable";
import { ShopDirectory } from "./components/ShopDirectory";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import { LogOut, RefreshCw, ClipboardList, Store } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import logo from "./assets/GENLOGO.png";

function App() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState<"repairs" | "shops">("repairs");

  useEffect(() => {
    if (isAuthenticated) {
      excelService.setMsalInstance(instance);
      shopService.setMsalInstance(instance);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-2xl shadow-xl border border-gray-100">
          <div className="text-center">
            <div className="mx-auto mb-6 flex justify-center">
              <img
                src={logo}
                alt="GenThrust Logo"
                className="h-20 w-auto object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              GenThrust RO Tracker
            </h1>
            <p className="text-base text-gray-600">
              Track aircraft parts sent to repair stations
            </p>
          </div>
          <Button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            Sign in with Microsoft
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="GenThrust Logo"
                className="h-12 w-auto object-contain"
              />
              <h1 className="text-2xl font-bold text-gray-900">
                RO Tracker
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {accounts[0]?.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="hover:bg-blue-50 hover:border-blue-300"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="hover:bg-red-50 hover:border-red-300"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 pb-3">
            <Button
              variant={currentView === "repairs" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("repairs")}
              className={
                currentView === "repairs"
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Repair Orders
            </Button>
            <Button
              variant={currentView === "shops" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("shops")}
              className={
                currentView === "shops"
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }
            >
              <Store className="h-4 w-4 mr-2" />
              Shop Directory
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {currentView === "repairs" ? (
            <>
              <Dashboard />
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Repair Orders
                </h2>
                <ROTable />
              </div>
            </>
          ) : (
            <ShopDirectory />
          )}
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
