import React, { useState } from "react";
import { Database, Trash2, UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { RawDataRow } from "../types";
import { FileUpload } from "./FileUpload";
import { format } from "date-fns";
import { motion } from "motion/react";
import { parseExcelDate } from "../utils/dataProcessor";

interface DataManagementProps {
  rawData: RawDataRow[] | null;
  onDataLoaded: (data: RawDataRow[], onProgress?: (msg: string) => void) => Promise<void>;
  onClearData: () => Promise<void>;
}

export const DataManagement: React.FC<DataManagementProps> = ({ rawData, onDataLoaded, onClearData }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleUpload = async (data: RawDataRow[], onProgress?: (msg: string) => void) => {
    setIsUploading(true);
    try {
      await onDataLoaded(data, onProgress);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving data:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = async () => {
    await onClearData();
    setShowConfirmClear(false);
  };

  const totalRecords = rawData?.length || 0;
  
  // Find date range using useMemo to prevent recalculating on every render
  const dateRange = React.useMemo(() => {
    if (!rawData || rawData.length === 0) return "No data available";
    
    let minT = Infinity;
    let maxT = -Infinity;
    for (let i = 0; i < rawData.length; i++) {
      const t = parseExcelDate(rawData[i].Date).getTime();
      if (!isNaN(t)) {
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }
    }
    if (minT !== Infinity && maxT !== -Infinity) {
      const minDate = new Date(minT);
      const maxDate = new Date(maxT);
      return `${format(minDate, "MMM dd, yyyy")} - ${format(maxDate, "MMM dd, yyyy")}`;
    }
    return "No data available";
  }, [rawData]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Database Status</h2>
            <p className="text-slate-500">Manage your stored revenue and volume data</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Records</p>
            <p className="text-3xl font-black text-slate-900">{totalRecords.toLocaleString()}</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Date Range</p>
            <p className="text-xl font-bold text-slate-900 mt-2">{dateRange}</p>
          </div>
        </div>

        {totalRecords > 0 && (
          <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-3 text-amber-800">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">
                Uploading a new sheet will <strong>merge</strong> the new data with existing data. 
                If the new sheet contains dates that already exist in the database, the old data for those specific dates will be replaced to prevent duplicates.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-blue-600" />
          Upload Daily Update
        </h3>
        
        {uploadSuccess ? (
          <div className="flex flex-col items-center justify-center p-12 bg-green-50 rounded-xl border border-green-200 text-green-700">
            <CheckCircle2 className="w-16 h-16 mb-4" />
            <h4 className="text-xl font-bold mb-2">Upload Successful!</h4>
            <p className="text-center">The new data has been successfully merged into your database.</p>
          </div>
        ) : (
          <div className={isUploading ? "opacity-50 pointer-events-none" : ""}>
            <FileUpload onDataLoaded={handleUpload} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-sm border border-red-100">
        <h3 className="text-xl font-bold text-red-600 mb-2 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Danger Zone
        </h3>
        <p className="text-slate-500 mb-6">
          Clearing the database will permanently remove all stored records. You will need to upload your master sheet again.
        </p>

        {showConfirmClear ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
            <p className="text-red-800 font-medium">Are you absolutely sure?</p>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowConfirmClear(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleClear}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Yes, Clear Database
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowConfirmClear(true)}
            disabled={totalRecords === 0}
            className="px-6 py-3 text-sm font-bold text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All Data
          </button>
        )}
      </div>
    </motion.div>
  );
};
