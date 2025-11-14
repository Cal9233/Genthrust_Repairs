import { useEffect, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "./lib/msalConfig";
import { excelService } from "./lib/excelService";
import { shopService } from "./lib/shopService";
import { reminderService } from "./lib/reminderService";
import { sharePointService } from "./services/sharepoint";
import { loggingService } from "./lib/loggingService";
import { inventoryService } from "./services/inventoryService";
import { Dashboard } from "./components/Dashboard";
import { ROTable } from "./components/ROTable";
import { ShopDirectory } from "./components/ShopDirectory";
import { InventorySearchTab } from "./components/InventorySearchTab";
import { AICommandBar } from "./components/AICommandBar";
import { AIAgentDialog } from "./components/AIAgentDialog";
import { LogsDialog } from "./components/LogsDialog";
import { ThemeToggle } from "./components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import { LogOut, RefreshCw, ClipboardList, Store, Sparkles, FileText, Package } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import logo from "./assets/GENLOGO.png";

function App() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const queryClient = useQueryClient();
  const [currentView, setCurrentView] = useState<"repairs" | "inventory" | "shops">("repairs");
  const [showAICommand, setShowAICommand] = useState(false);
  const [showAIAgent, setShowAIAgent] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (instance) {
      excelService.setMsalInstance(instance);
      shopService.setMsalInstance(instance);
      reminderService.setMsalInstance(instance);
      sharePointService.setMsalInstance(instance);
      loggingService.setMsalInstance(instance);
      inventoryService.setMsalInstance(instance);
      console.log("[App] MSAL instance set for services");
    }
  }, [instance]);

  useEffect(() => {
    console.log("[App] Authentication status:", isAuthenticated);
  }, [isAuthenticated]);

  // Keyboard shortcut for AI agent (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowAIAgent(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, hsl(var(--primary-deep-blue)) 0px, hsl(var(--primary-deep-blue)) 1px, transparent 1px, transparent 20px)',
          }}></div>
        </div>

        {/* Login Card */}
        <div className="relative max-w-[420px] w-full mx-4">
          <div className="bg-card-blue rounded-2xl shadow-vibrant-xl border border-border overflow-hidden">
            <div className="p-8 sm:p-12 space-y-6 sm:space-y-8">
              {/* Logo and Title */}
              <div className="text-center space-y-4 sm:space-y-6">
                <div className="mx-auto flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-bright-blue/10 rounded-full blur-xl"></div>
                    <img
                      src={logo}
                      alt="GenThrust Logo"
                      className="relative h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-[28px] font-bold text-foreground tracking-tight">
                    GenThrust RO Tracker
                  </h1>
                  <p className="text-sm sm:text-[15px] text-muted-foreground font-normal">
                    Track aircraft parts sent to repair stations
                  </p>
                </div>
              </div>

              {/* Sign In Button */}
              <div className="space-y-4">
                <Button
                  onClick={handleLogin}
                  className="w-full bg-gradient-blue text-white font-semibold shadow-[0_4px_12px_rgba(2,132,199,0.3)] hover:shadow-[0_6px_20px_rgba(2,132,199,0.4)] button-lift transition-all duration-200 rounded-[10px] h-auto py-3 sm:py-3.5 text-sm sm:text-[15px]"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 0H0V10H10V0Z" fill="currentColor"/>
                    <path d="M21 0H11V10H21V0Z" fill="currentColor"/>
                    <path d="M10 11H0V21H10V11Z" fill="currentColor"/>
                    <path d="M21 11H11V21H21V11Z" fill="currentColor"/>
                  </svg>
                  Sign in with Microsoft
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Secure authentication powered by Microsoft Azure
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-background">
      <header className="bg-gradient-header border-b border-deep-blue/20 sticky top-0 z-50 shadow-[0_4px_16px_rgba(12,74,110,0.15)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 md:py-4">
            <div className="flex items-center gap-2 md:gap-3">
              <img
                src={logo}
                alt="GenThrust Logo"
                className="h-7 sm:h-8 md:h-9 w-auto object-contain"
              />
              <h1 className="text-base sm:text-lg md:text-[20px] font-semibold text-white">
                RO Tracker
              </h1>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              <span className="text-xs sm:text-sm font-medium text-white/90 hidden md:block">
                {accounts[0]?.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAIAgent(true)}
                className="relative group bg-gradient-blue border-electric text-white font-semibold shadow-[0_2px_8px_rgba(6,182,212,0.3)] hover:shadow-[0_4px_16px_rgba(6,182,212,0.4)] transition-all duration-200 rounded-lg button-lift px-2 sm:px-3"
                title="AI Assistant (Ctrl+K)"
              >
                <Sparkles className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">AI Assistant</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogs(true)}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40 rounded-lg px-2 sm:px-3"
                title="View AI Activity Logs"
              >
                <FileText className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden lg:inline">Logs</span>
              </Button>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40 rounded-lg px-2 sm:px-3"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40 rounded-lg px-2 sm:px-3 hidden sm:flex"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1.5 sm:gap-2 pb-2 sm:pb-3 overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("repairs")}
              className={
                currentView === "repairs"
                  ? "bg-white text-deep-blue hover:bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all duration-200 rounded-lg px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 font-semibold text-xs sm:text-sm whitespace-nowrap"
                  : "bg-white/15 text-white hover:bg-white/25 rounded-lg px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 transition-all duration-200 text-xs sm:text-sm whitespace-nowrap"
              }
            >
              <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Repair Orders</span>
              <span className="sm:hidden ml-1.5">Repairs</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("inventory")}
              className={
                currentView === "inventory"
                  ? "bg-white text-deep-blue hover:bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all duration-200 rounded-lg px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 font-semibold text-xs sm:text-sm whitespace-nowrap"
                  : "bg-white/15 text-white hover:bg-white/25 rounded-lg px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 transition-all duration-200 text-xs sm:text-sm whitespace-nowrap"
              }
            >
              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Inventory Search</span>
              <span className="sm:hidden ml-1.5">Inventory</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("shops")}
              className={
                currentView === "shops"
                  ? "bg-white text-deep-blue hover:bg-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all duration-200 rounded-lg px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 font-semibold text-xs sm:text-sm whitespace-nowrap"
                  : "bg-white/15 text-white hover:bg-white/25 rounded-lg px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 transition-all duration-200 text-xs sm:text-sm whitespace-nowrap"
              }
            >
              <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Shop Directory</span>
              <span className="sm:hidden ml-1.5">Shops</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="space-y-8">
          {currentView === "repairs" ? (
            <>
              <Dashboard />
              <div className="bg-background rounded-xl shadow-vibrant-lg border border-border p-6">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Repair Orders
                </h2>
                <ROTable />
              </div>
            </>
          ) : currentView === "inventory" ? (
            <InventorySearchTab />
          ) : (
            <ShopDirectory />
          )}
        </div>
      </main>

      <Toaster position="bottom-right" />

      {/* AI Command Bar (legacy) */}
      <AICommandBar isOpen={showAICommand} onClose={() => setShowAICommand(false)} />

      {/* AI Agent Dialog */}
      <AIAgentDialog open={showAIAgent} onOpenChange={setShowAIAgent} />

      {/* Logs Dialog */}
      <LogsDialog open={showLogs} onOpenChange={setShowLogs} />
    </div>
  );
}

export default App;
