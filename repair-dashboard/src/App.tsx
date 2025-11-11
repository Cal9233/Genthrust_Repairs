import { useEffect, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "./lib/msalConfig";
import { excelService } from "./lib/excelService";
import { shopService } from "./lib/shopService";
import { reminderService } from "./lib/reminderService";
import { sharePointService } from "./services/sharepoint";
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
    if (instance) {
      excelService.setMsalInstance(instance);
      shopService.setMsalInstance(instance);
      reminderService.setMsalInstance(instance);
      sharePointService.setMsalInstance(instance);
      console.log("[App] MSAL instance set for services");
    }
  }, [instance]);

  useEffect(() => {
    console.log("[App] Authentication status:", isAuthenticated);
  }, [isAuthenticated]);

  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (e: any) {
      console.error("Login error:", e);

      // If interaction is in progress, clear it and retry
      if (e.errorCode === "interaction_in_progress") {
        console.log("Clearing stuck authentication session...");
        await instance.clearCache();
        window.location.reload();
      } else if (e.message?.includes("popup") || e.message?.includes("CORS")) {
        // CORS/popup issues - try redirect flow instead
        console.log("Popup blocked, using redirect flow...");
        await instance.loginRedirect(loginRequest);
      }
    }
  };

  const handleLogout = async () => {
    try {
      // Clear any in-progress interactions first
      await instance.clearCache();
      await instance.logoutPopup();
    } catch (e: any) {
      console.error("Logout error:", e);
      // If logout fails, try clearing cache and reloading
      if (e.errorCode === "interaction_in_progress") {
        await instance.clearCache();
        window.location.reload();
      }
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>

        {/* Login Card */}
        <div className="relative max-w-md w-full mx-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Decorative header bar */}
            <div className="h-2 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600"></div>

            <div className="p-10 space-y-8">
              {/* Logo and Title */}
              <div className="text-center space-y-6">
                <div className="mx-auto flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-50"></div>
                    <img
                      src={logo}
                      alt="GenThrust Logo"
                      className="relative h-24 w-auto object-contain"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    GenThrust RO Tracker
                  </h1>
                  <p className="text-lg text-gray-600 font-medium">
                    Track aircraft parts sent to repair stations
                  </p>
                </div>
              </div>

              {/* Sign In Button */}
              <div className="space-y-4">
                <Button
                  onClick={handleLogin}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  size="lg"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 0H0V10H10V0Z" fill="currentColor"/>
                    <path d="M21 0H11V10H21V0Z" fill="currentColor"/>
                    <path d="M10 11H0V21H10V11Z" fill="currentColor"/>
                    <path d="M21 11H11V21H21V11Z" fill="currentColor"/>
                  </svg>
                  Sign in with Microsoft
                </Button>

                <p className="text-xs text-center text-gray-500">
                  Secure authentication powered by Microsoft Azure
                </p>
              </div>
            </div>

            {/* Decorative footer gradient */}
            <div className="h-1 bg-gradient-to-r from-indigo-600 via-blue-500 to-blue-600"></div>
          </div>

          {/* Shadow effect underneath */}
          <div className="absolute inset-x-0 -bottom-6 h-6 bg-gradient-to-b from-black/10 to-transparent blur-xl"></div>
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
