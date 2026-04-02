import React from "react";
import { Filter, X, Calendar, User, Building2, Briefcase, TrendingUp, Users, PieChart as PieChartIcon, Database } from "lucide-react";
import { cn } from "../lib/utils";

interface FiltersProps {
  clinics: string[];
  doctors: string[];
  insuranceCompanies: string[];
  selectedFilters: {
    startDate: string;
    endDate: string;
    revenueType: "All" | "B2B" | "B2C";
    clinics: string[];
    doctors: string[];
    insurance: string[];
  };
  onFilterChange: (filters: any) => void;
  activeTab: "revenue" | "volume" | "cpp" | "data";
  setActiveTab: (tab: "revenue" | "volume" | "cpp" | "data") => void;
  isAdmin?: boolean;
}

export const Filters: React.FC<FiltersProps> = ({
  clinics,
  doctors,
  insuranceCompanies,
  selectedFilters,
  onFilterChange,
  activeTab,
  setActiveTab,
  isAdmin = false
}) => {
  const toggleItem = (list: string[], item: string, key: string) => {
    const newList = list.includes(item)
      ? list.filter((i) => i !== item)
      : [...list, item];
    onFilterChange({ ...selectedFilters, [key]: newList });
  };

  return (
    <div className="w-full h-full p-4 sm:p-6">
      <div className="flex flex-col items-center gap-3 mb-6 sm:mb-8 pb-6 border-b border-slate-100">
        <img 
          src="https://scontent.fdmm3-2.fna.fbcdn.net/v/t39.30808-6/450998298_1150415529461259_130598404335151586_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=LcOecER7Vb8Q7kNvwErsy3r&_nc_oc=Adruk9JnfgD1599db-aJMpbyCJdUsG2mznfW5aVdtusbLgTY2GPP_WIcIv72ta6DEADZYmkY3yAE63Brkm_x_qcj&_nc_zt=23&_nc_ht=scontent.fdmm3-2.fna&_nc_gid=2SF07jAdE6bjLjJFwgUb4g&_nc_ss=7a3a8&oh=00_AfyJpTLVbaYQ1MK8C1itpP9WmWPoHkCGJgXUhf4eDPavZA&oe=69D18B30" 
          alt="مركز طوارئيات للعناية الطبية - الجبيل" 
          className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-xl shadow-sm"
          referrerPolicy="no-referrer"
        />
        <h2 className="font-bold text-slate-900 text-center text-xs sm:text-sm">مركز طوارئيات للعناية الطبية - الجبيل</h2>
      </div>

      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
        <h2 className="font-bold text-slate-900 text-sm sm:text-base">Navigation & Filters</h2>
      </div>

      <div className="mb-6 sm:mb-8 space-y-2">
        <button 
          onClick={() => setActiveTab("revenue")} 
          className={cn("w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-medium transition-all text-sm sm:text-base", activeTab === "revenue" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50")}
        >
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /> Revenue
        </button>
        <button 
          onClick={() => setActiveTab("volume")} 
          className={cn("w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-medium transition-all text-sm sm:text-base", activeTab === "volume" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50")}
        >
          <Users className="w-4 h-4 sm:w-5 sm:h-5" /> Volume
        </button>
        <button 
          onClick={() => setActiveTab("cpp")} 
          className={cn("w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-medium transition-all text-sm sm:text-base", activeTab === "cpp" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50")}
        >
          <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5" /> CPP Analysis
        </button>
        {isAdmin && (
          <button 
            onClick={() => setActiveTab("data")} 
            className={cn("w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-medium transition-all text-sm sm:text-base", activeTab === "data" ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50")}
          >
            <Database className="w-4 h-4 sm:w-5 sm:h-5" /> Data Management
          </button>
        )}
      </div>

      <hr className="border-slate-100 my-4 sm:my-6" />

      <div className="space-y-6 sm:space-y-8 pb-6">
        {/* Date Range */}
        <section>
          <label className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 sm:mb-4">
            <Calendar className="w-3 h-3" /> Date Range
          </label>
          <div className="grid gap-2">
            <input
              type="date"
              value={selectedFilters.startDate}
              onChange={(e) => onFilterChange({ ...selectedFilters, startDate: e.target.value })}
              className="w-full p-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <input
              type="date"
              value={selectedFilters.endDate}
              onChange={(e) => onFilterChange({ ...selectedFilters, endDate: e.target.value })}
              className="w-full p-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </section>

        {/* Revenue Type */}
        <section>
          <label className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 sm:mb-4">
            <Briefcase className="w-3 h-3" /> Revenue Type
          </label>
          <div className="flex p-1 bg-slate-50 rounded-xl">
            {["All", "B2B", "B2C"].map((type) => (
              <button
                key={type}
                onClick={() => onFilterChange({ ...selectedFilters, revenueType: type })}
                className={cn(
                  "flex-1 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium rounded-lg transition-all",
                  selectedFilters.revenueType === type
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </section>

        {/* Clinics */}
        <section>
          <label className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 sm:mb-4">
            <Building2 className="w-3 h-3" /> Clinics
          </label>
          <div className="space-y-1 max-h-32 sm:max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            {clinics.map((clinic) => (
              <button
                key={clinic}
                onClick={() => toggleItem(selectedFilters.clinics, clinic, "clinics")}
                className={cn(
                  "w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs rounded-lg transition-all",
                  selectedFilters.clinics.includes(clinic)
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {clinic}
              </button>
            ))}
          </div>
        </section>

        {/* Doctors */}
        <section>
          <label className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 sm:mb-4">
            <User className="w-3 h-3" /> Doctors
          </label>
          <div className="space-y-1 max-h-32 sm:max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            {doctors.map((doctor) => (
              <button
                key={doctor}
                onClick={() => toggleItem(selectedFilters.doctors, doctor, "doctors")}
                className={cn(
                  "w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs rounded-lg transition-all",
                  selectedFilters.doctors.includes(doctor)
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {doctor}
              </button>
            ))}
          </div>
        </section>

        {/* Insurance */}
        <section>
          <label className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 sm:mb-4">
            <Building2 className="w-3 h-3" /> Insurance
          </label>
          <div className="space-y-1 max-h-32 sm:max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            {insuranceCompanies.map((company) => (
              <button
                key={company}
                onClick={() => toggleItem(selectedFilters.insurance, company, "insurance")}
                className={cn(
                  "w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs rounded-lg transition-all",
                  selectedFilters.insurance.includes(company)
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {company}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
