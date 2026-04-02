import React, { useState, useMemo, useEffect } from "react";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  Building2, 
  Download, 
  Maximize2, 
  FileSpreadsheet, 
  FileText,
  Stethoscope,
  DollarSign,
  PieChart as PieChartIcon,
  ChevronRight,
  Menu,
  X,
  Database,
  Loader2,
  RefreshCw,
  LogOut,
  LogIn
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RawDataRow, ProcessedRow, DashboardStats } from "./types";
import { processRawData, calculateStats, parseExcelDate } from "./utils/dataProcessor";
import { FileUpload } from "./components/FileUpload";
import { Filters } from "./components/Filters";
import { KPICard } from "./components/KPICard";
import { DashboardChart } from "./components/Charts";
import { PresentationMode } from "./components/PresentationMode";
import { DataManagement } from "./components/DataManagement";
import { exportToExcel, exportToPDF } from "./utils/exportUtils";
import { cn } from "./lib/utils";
import { format, isWithinInterval, parseISO } from "date-fns";
import { auth, signInWithGoogle, logout } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";

export default function App() {
  const [rawData, setRawData] = useState<RawDataRow[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"revenue" | "volume" | "cpp" | "data">("revenue");
  const [user, setUser] = useState<User | null>(null);
  
  const isAdmin = user?.email === 'medoelkateb@gmail.com';

  const [filters, setFilters] = useState({
    year: "All",
    startDate: "",
    endDate: "",
    revenueType: "All" as "All" | "B2B" | "B2C",
    clinics: [] as string[],
    doctors: [] as string[],
    insurance: [] as string[],
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const response = await fetch('/api/data');
      if (!response.ok) {
        const text = await response.text();
        let errorMessage = `Server error (${response.status})`;
        try {
          const errData = JSON.parse(text);
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          errorMessage += `: ${text.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
      }
      const result = await response.json();
      
      if (result.data && result.data.length > 0) {
        setRawData(result.data);
      } else {
        setRawData(null);
      }
    } catch (error: any) {
      console.error("Failed to load data from MongoDB", error);
      alert("Error loading data from database: " + error.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDataLoaded = async (newData: RawDataRow[], onProgress?: (msg: string) => void) => {
    if (!isAdmin) {
      alert("Only the administrator can upload data.");
      return;
    }

    try {
      if (onProgress) onProgress("Merging new data with existing records...");
      // Merge logic: replace existing data for the dates present in the new sheet
      const newDates = new Set<string>();
      for (let i = 0; i < newData.length; i++) {
        const d = parseExcelDate(newData[i].Date);
        if (!isNaN(d.getTime())) {
          newDates.add(d.toDateString());
        }
      }

      const existingData = rawData || [];
      const filteredExistingData = [];
      for (let i = 0; i < existingData.length; i++) {
        const row = existingData[i];
        const d = parseExcelDate(row.Date);
        if (isNaN(d.getTime()) || !newDates.has(d.toDateString())) {
          filteredExistingData.push(row);
        }
      }

      const mergedData = [...filteredExistingData, ...newData];
      
      // Save to MongoDB in chunks to avoid payload limits
      const CHUNK_SIZE = 5000;
      const chunks = [];
      for (let i = 0; i < mergedData.length; i += CHUNK_SIZE) {
        chunks.push(mergedData.slice(i, i + CHUNK_SIZE));
      }

      if (onProgress) onProgress("Clearing old data...");
      const clearRes = await fetch('/api/data/clear', { method: 'DELETE' });
      if (!clearRes.ok) {
        throw new Error('Failed to clear old data');
      }

      if (onProgress) onProgress("Uploading data to MongoDB...");
      
      for (let i = 0; i < chunks.length; i++) {
        if (onProgress) onProgress(`Uploading chunk ${i + 1} of ${chunks.length}...`);
        const response = await fetch('/api/data/upload-chunk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chunk: chunks[i], index: i }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Upload failed at chunk ${i + 1}`);
        }
      }

      if (onProgress) onProgress("Finalizing upload...");

      setRawData(mergedData);
    } catch (error) {
      console.error("Error saving to MongoDB", error);
      alert("Failed to save data to cloud. " + (error as Error).message);
      throw error;
    }
  };

  const handleClearData = async () => {
    if (!isAdmin) {
      alert("Only the administrator can clear data.");
      return;
    }
    try {
      const response = await fetch('/api/data/clear', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear data');
      }
      
      setRawData(null);
    } catch (error) {
      console.error("Error clearing data", error);
      alert("Failed to clear data. " + (error as Error).message);
    }
  };

  const handleRefresh = async () => {
    await loadData();
  };

  const baseProcessedData = useMemo(() => {
    if (!rawData) return [];
    return processRawData(rawData);
  }, [rawData]);

  const processedData = useMemo(() => {
    if (!baseProcessedData || baseProcessedData.length === 0) return [];
    let data = baseProcessedData;
    
    if (filters.year !== "All") {
      const yearNum = parseInt(filters.year, 10);
      data = data.filter(row => row.date.getFullYear() === yearNum);
    }

    // Apply Filters
    if (filters.startDate) {
      const [year, month, day] = filters.startDate.split('-').map(Number);
      // Create start date at local midnight
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      data = data.filter(row => {
        // Ensure row.date is treated as local midnight for comparison
        const rowDate = new Date(row.date.getFullYear(), row.date.getMonth(), row.date.getDate());
        return rowDate >= start;
      });
    }
    if (filters.endDate) {
      const [year, month, day] = filters.endDate.split('-').map(Number);
      // Create end date at local 23:59:59.999
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);
      data = data.filter(row => {
        // Ensure row.date is treated as local midnight for comparison
        const rowDate = new Date(row.date.getFullYear(), row.date.getMonth(), row.date.getDate());
        return rowDate <= end;
      });
    }
    if (filters.revenueType !== "All") {
      data = data.filter(row => row.category === filters.revenueType);
    }
    if (filters.clinics.length > 0) {
      data = data.filter(row => filters.clinics.includes(row.clinic));
    }
    if (filters.doctors.length > 0) {
      data = data.filter(row => filters.doctors.includes(row.doctor));
    }
    if (filters.insurance.length > 0) {
      data = data.filter(row => filters.insurance.includes(row.insuranceCompany));
    }

    return data;
  }, [baseProcessedData, filters]);

  const stats = useMemo(() => calculateStats(processedData), [processedData]);

  const filterOptions = useMemo(() => {
    if (!baseProcessedData || baseProcessedData.length === 0) return { years: [], clinics: [], doctors: [], insurance: [] };
    return {
      years: Array.from(new Set(baseProcessedData.map(r => r.date.getFullYear().toString()))).sort((a, b) => b.localeCompare(a)),
      clinics: Array.from(new Set(baseProcessedData.map(r => r.clinic))).sort(),
      doctors: Array.from(new Set(baseProcessedData.map(r => r.doctor))).sort(),
      insurance: Array.from(new Set(baseProcessedData.map(r => r.insuranceCompany))).sort(),
    };
  }, [baseProcessedData]);

  const cppByClinic = useMemo(() => {
    return Object.entries(stats.revenueByClinic)
      .map(([name, val]: [string, any]) => {
        const vol = stats.volumeByClinic[name];
        const totalVol = vol ? vol.b2b.size + vol.b2c.size : 0;
        const cpp = totalVol > 0 ? (val.b2b + val.b2c) / totalVol : 0;
        return { name, cpp: Math.round(cpp), revenue: Math.round(val.b2b + val.b2c), volume: totalVol };
      })
      .sort((a, b) => b.cpp - a.cpp);
  }, [stats]);

  const cppByDoctor = useMemo(() => {
    return Object.entries(stats.revenueByDoctor)
      .map(([name, val]: [string, any]) => {
        const vol = stats.volumeByDoctor[name];
        const totalVol = vol ? vol.b2b.size + vol.b2c.size : 0;
        const cpp = totalVol > 0 ? (val.b2b + val.b2c) / totalVol : 0;
        return { name, cpp: Math.round(cpp), revenue: Math.round(val.b2b + val.b2c), volume: totalVol };
      })
      .sort((a, b) => b.cpp - a.cpp);
  }, [stats]);

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading your database...</p>
      </div>
    );
  }

  if (!rawData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-12">
          <div className="flex flex-col items-center justify-center mb-8">
            <img 
              src="https://scontent.fdmm3-2.fna.fbcdn.net/v/t39.30808-6/450998298_1150415529461259_130598404335151586_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=LcOecER7Vb8Q7kNvwErsy3r&_nc_oc=Adruk9JnfgD1599db-aJMpbyCJdUsG2mznfW5aVdtusbLgTY2GPP_WIcIv72ta6DEADZYmkY3yAE63Brkm_x_qcj&_nc_zt=23&_nc_ht=scontent.fdmm3-2.fna&_nc_gid=2SF07jAdE6bjLjJFwgUb4g&_nc_ss=7a3a8&oh=00_AfyJpTLVbaYQ1MK8C1itpP9WmWPoHkCGJgXUhf4eDPavZA&oe=69D18B30" 
              alt="مركز طوارئيات للعناية الطبية - الجبيل" 
              className="w-32 h-32 object-contain rounded-2xl shadow-lg mb-4"
              referrerPolicy="no-referrer"
            />
            <h2 className="text-2xl font-bold text-slate-800">مركز طوارئيات للعناية الطبية - الجبيل</h2>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Revenue Analytics</h1>
          <p className="text-slate-500 max-w-md mx-auto text-lg">
            Transform your healthcare data into executive-level insights. Upload your master data sheet to begin.
          </p>
        </div>
        <div className="mt-12 w-full max-w-2xl mx-auto">
          {isAdmin ? (
            <FileUpload onDataLoaded={handleDataLoaded} />
          ) : (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
              <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">No Data Available</h3>
              <p className="text-slate-500 mb-6">The database is currently empty. The administrator needs to upload the initial data.</p>
              <button 
                onClick={signInWithGoogle}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all"
              >
                <LogIn className="w-5 h-5" />
                Admin Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Filters */}
      <div className={cn(
        "fixed lg:sticky top-0 left-0 h-screen bg-white border-r border-slate-200 w-80 z-40 transform transition-transform duration-300 ease-in-out flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Mobile Close Button */}
        <div className="lg:hidden p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-slate-800">Menu & Filters</h2>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Filters
            years={filterOptions.years}
            clinics={filterOptions.clinics}
            doctors={filterOptions.doctors}
            insuranceCompanies={filterOptions.insurance}
            selectedFilters={filters}
            onFilterChange={setFilters}
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              setIsMobileMenuOpen(false); // Close menu on mobile when tab changes
            }}
            isAdmin={isAdmin}
          />
        </div>
        
        {/* Auth Section at bottom of sidebar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                  {user.email?.[0].toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-900 truncate">{user.displayName || 'Admin'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all text-sm"
            >
              <LogIn className="w-4 h-4" />
              Admin Login
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-12 overflow-y-auto custom-scrollbar w-full">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 lg:mb-12">
          <div className="flex items-start gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden mt-1 p-2 text-slate-600 hover:bg-slate-200 rounded-lg bg-white shadow-sm border border-slate-200 shrink-0"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm uppercase tracking-widest mb-2">
                {activeTab === "revenue" && <><TrendingUp className="w-4 h-4" /> Executive Dashboard</>}
                {activeTab === "volume" && <><Users className="w-4 h-4" /> Volume Dashboard</>}
                {activeTab === "cpp" && <><PieChartIcon className="w-4 h-4" /> CPP Dashboard</>}
                {activeTab === "data" && <><Database className="w-4 h-4" /> Data Management</>}
              </div>
              <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                {activeTab === "revenue" && "Revenue Performance"}
                {activeTab === "volume" && "Volume Analysis"}
                {activeTab === "cpp" && "Cost Per Patient (CPP) Analysis"}
                {activeTab === "data" && "Database & Uploads"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setIsPresentationMode(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              <Maximize2 className="w-4 h-4" />
              Presentation Mode
            </button>
            <div className="h-10 w-px bg-slate-200 mx-2" />
            <button
              onClick={() => exportToExcel(processedData)}
              className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
            <button
              onClick={() => exportToPDF(stats)}
              className="p-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
              title="Export to PDF"
            >
              <FileText className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* --- REVENUE TAB --- */}
        {activeTab === "data" && (
          <DataManagement 
            rawData={rawData} 
            onDataLoaded={handleDataLoaded} 
            onClearData={handleClearData} 
          />
        )}

        {activeTab === "revenue" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard
                title="Total Revenue"
                value={`SAR ${stats.totalRevenue.toLocaleString()}`}
                icon={<DollarSign className="w-5 h-5" />}
                subtitle="Combined B2B & B2C"
              />
              <KPICard
                title="B2B Revenue"
                value={`SAR ${stats.b2bRevenue.toLocaleString()}`}
                icon={<Building2 className="w-5 h-5" />}
                className="border-l-4 border-l-blue-500"
              />
              <KPICard
                title="B2C Revenue"
                value={`SAR ${stats.b2cRevenue.toLocaleString()}`}
                icon={<Users className="w-5 h-5" />}
                className="border-l-4 border-l-green-500"
              />
              <KPICard
                title="Patient Volume"
                value={stats.totalVolume.toLocaleString()}
                icon={<Stethoscope className="w-5 h-5" />}
                subtitle={`${stats.newPatients} New / ${stats.existingPatients} Existing`}
              />
            </div>

            {/* Revenue Breakdown Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  B2B Revenue Analysis
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <span className="text-slate-600 font-medium">Company Due Amount</span>
                    <span className="text-xl font-black text-blue-600">SAR {stats.b2bRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  B2C Revenue Analysis
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <span className="text-slate-600 font-medium">Cash (Co Amount + VAT)</span>
                    <span className="text-xl font-black text-green-600">SAR {stats.b2cCashRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                    <span className="text-slate-600 font-medium">Insurance (Company Due Amount)</span>
                    <span className="text-xl font-black text-green-600">SAR {stats.b2cInsuranceRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl border border-green-100">
                    <span className="text-green-800 font-bold">Total B2C Revenue</span>
                    <span className="text-xl font-black text-green-700">SAR {stats.b2cRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section 1: Trends & Insurance */}
            <div className="grid grid-cols-1 gap-12">
              <div className="h-[500px]">
                <DashboardChart
                  title="Revenue Trends (B2B vs B2C)"
                  type="line"
                  data={Object.entries(stats.monthlyTrends).map(([name, val]: [string, any]) => ({ name, ...val }))}
                  dataKeys={["b2b", "b2c"]}
                  colors={["#3b82f6", "#10b981"]}
                />
              </div>
              <div className="h-[500px]">
                <DashboardChart
                  title="Revenue by Insurance Company"
                  type="stackedBar"
                  data={Object.entries(stats.revenueByInsurance)
                    .sort((a: [string, any], b: [string, any]) => (b[1].b2b + b[1].b2c) - (a[1].b2b + a[1].b2c))
                    .slice(0, 10)
                    .map(([name, val]: [string, any]) => ({ name, ...val }))}
                  dataKeys={["b2b", "b2c"]}
                />
              </div>
            </div>

            {/* Charts Section 2: Clinic & Doctor */}
            <div className="grid grid-cols-1 gap-12">
              <div className="h-[500px]">
                <DashboardChart
                  title="Revenue by Clinic"
                  type="bar"
                  data={Object.entries(stats.revenueByClinic)
                    .sort((a: [string, any], b: [string, any]) => (b[1].b2b + b[1].b2c) - (a[1].b2b + a[1].b2c))
                    .map(([name, val]: [string, any]) => ({ name, ...val }))}
                  dataKeys={["b2b", "b2c"]}
                />
              </div>
              <div className="h-[500px]">
                <DashboardChart
                  title="Revenue by Doctor (Top 10)"
                  type="bar"
                  data={Object.entries(stats.revenueByDoctor)
                    .sort((a: [string, any], b: [string, any]) => (b[1].b2b + b[1].b2c) - (a[1].b2b + a[1].b2c))
                    .slice(0, 10)
                    .map(([name, val]: [string, any]) => ({ name, ...val }))}
                  dataKeys={["b2b", "b2c"]}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* --- VOLUME TAB --- */}
        {activeTab === "volume" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard
                title="Total B2B Volume"
                value={stats.b2bVolume.toLocaleString()}
                icon={<Building2 className="w-5 h-5" />}
                className="border-l-4 border-l-blue-500"
              />
              <KPICard
                title="Total B2C Volume"
                value={stats.b2cVolume.toLocaleString()}
                icon={<Users className="w-5 h-5" />}
                className="border-l-4 border-l-green-500"
              />
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Patient Type Breakdown</h3>
                <div className="h-32">
                  <DashboardChart
                    title=""
                    type="pie"
                    data={[
                      { name: "New Patients", value: stats.newPatients },
                      { name: "Existing Patients", value: stats.existingPatients }
                    ]}
                    dataKeys={["value"]}
                    colors={["#3b82f6", "#94a3b8"]}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-12">
              <div className="h-[500px]">
                <DashboardChart
                  title="Volume by Insurance"
                  type="stackedBar"
                  data={Object.entries(stats.volumeByInsurance)
                    .map(([name, val]: [string, any]) => ({ name, b2b: val.b2b.size, b2c: val.b2c.size }))
                    .sort((a, b) => (b.b2b + b.b2c) - (a.b2b + a.b2c))
                    .slice(0, 10)}
                  dataKeys={["b2b", "b2c"]}
                />
              </div>
              <div className="h-[500px]">
                <DashboardChart
                  title="Volume by Clinic"
                  type="bar"
                  data={Object.entries(stats.volumeByClinic)
                    .map(([name, val]: [string, any]) => ({ name, b2b: val.b2b.size, b2c: val.b2c.size }))
                    .sort((a, b) => (b.b2b + b.b2c) - (a.b2b + a.b2c))}
                  dataKeys={["b2b", "b2c"]}
                />
              </div>
            </div>
            
            <div className="h-[500px]">
              <DashboardChart
                title="Volume by Doctor"
                type="bar"
                data={Object.entries(stats.volumeByDoctor)
                  .map(([name, val]: [string, any]) => ({ name, b2b: val.b2b.size, b2c: val.b2c.size }))
                  .sort((a, b) => (b.b2b + b.b2c) - (a.b2b + a.b2c))
                  .slice(0, 15)}
                dataKeys={["b2b", "b2c"]}
              />
            </div>
          </motion.div>
        )}

        {/* --- CPP TAB --- */}
        {activeTab === "cpp" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard
                title="Average CPP (Overall)"
                value={`SAR ${stats.cpp}`}
                icon={<PieChartIcon className="w-5 h-5" />}
                subtitle="Cost Per Patient Volume"
                className="border-l-4 border-l-purple-500"
              />
              <KPICard
                title="Highest Clinic CPP"
                value={`SAR ${cppByClinic[0]?.cpp || "0"}`}
                icon={<Building2 className="w-5 h-5" />}
                subtitle={cppByClinic[0]?.name || "N/A"}
              />
              <KPICard
                title="Highest Doctor CPP"
                value={`SAR ${cppByDoctor[0]?.cpp || "0"}`}
                icon={<Stethoscope className="w-5 h-5" />}
                subtitle={cppByDoctor[0]?.name || "N/A"}
              />
            </div>

            <div className="grid grid-cols-1 gap-12">
              <div className="h-[500px]">
                <DashboardChart
                  title="CPP per Clinic"
                  type="bar"
                  data={cppByClinic}
                  dataKeys={["cpp"]}
                  colors={["#8b5cf6"]}
                />
              </div>
              <div className="h-[500px]">
                <DashboardChart
                  title="CPP per Doctor (Top 10)"
                  type="bar"
                  data={cppByDoctor.slice(0, 10)}
                  dataKeys={["cpp"]}
                  colors={["#8b5cf6"]}
                />
              </div>
            </div>

            {/* Exact Numbers Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Clinic CPP Details */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Detailed CPP by Clinic
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {cppByClinic.map((c, i) => (
                    <div key={c.name} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-400 w-5">{i + 1}.</span>
                        <div>
                          <p className="font-semibold text-slate-800">{c.name}</p>
                          <p className="text-xs text-slate-500">Vol: {c.volume} | Rev: SAR {c.revenue.toLocaleString()}</p>
                        </div>
                      </div>
                      <span className="font-black text-lg text-purple-600">SAR {c.cpp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Doctor CPP Details */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-blue-600" />
                  Detailed CPP by Doctor
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {cppByDoctor.map((c, i) => (
                    <div key={c.name} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-400 w-5">{i + 1}.</span>
                        <div>
                          <p className="font-semibold text-slate-800">{c.name}</p>
                          <p className="text-xs text-slate-500">Vol: {c.volume} | Rev: SAR {c.revenue.toLocaleString()}</p>
                        </div>
                      </div>
                      <span className="font-black text-lg text-purple-600">SAR {c.cpp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Presentation Mode Overlay */}
      <AnimatePresence>
        {isPresentationMode && (
          <PresentationMode
            stats={stats}
            onClose={() => setIsPresentationMode(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
