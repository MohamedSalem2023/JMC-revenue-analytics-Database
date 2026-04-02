import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { RawDataRow } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface FileUploadProps {
  onDataLoaded: (data: RawDataRow[], onProgress?: (msg: string) => void) => void | Promise<void>;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onerror = () => {
        setError("Failed to read file from disk.");
        setIsLoading(false);
      };
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Get headers explicitly to avoid missing columns if the first row has empty cells
          const headerRow = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 })[0] as string[];
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: "" });

          if (!headerRow || headerRow.length === 0 || jsonData.length === 0) {
            setError("The uploaded file is empty or invalid.");
            setIsLoading(false);
            return;
          }

          // Determine column mapping ONCE from the headers
          const colMap: Record<string, string> = {};
          
          // Helper to check if a key is already mapped
          const isMapped = (targetCol: string) => !!colMap[targetCol];

          // First pass: look for exact or very strong matches
          for (const key of headerRow) {
            if (!key) continue;
            const normKey = String(key).toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
            
            if (!isMapped('Category') && (normKey === 'category' || normKey === 'فئة')) colMap['Category'] = key;
            if (!isMapped('Date') && (normKey === 'date' || normKey === 'تاريخ')) colMap['Date'] = key;
            if (!isMapped('File Code') && (normKey === 'filecode' || normKey === 'patientid' || normKey === 'id' || normKey === 'mrn' || normKey === 'رقمالملف')) colMap['File Code'] = key;
            if (!isMapped('Insurance Company') && (normKey === 'insurancecompany' || normKey === 'insurance' || normKey === 'شركةالتأمين')) colMap['Insurance Company'] = key;
            if (!isMapped('Clinic') && (normKey === 'clinic' || normKey === 'department' || normKey === 'العيادة' || normKey === 'القسم')) colMap['Clinic'] = key;
            if (!isMapped('Doctor') && (normKey === 'doctor' || normKey === 'physician' || normKey === 'الطبيب' || normKey === 'الدكتور')) colMap['Doctor'] = key;
            if (!isMapped('Company Due Amount') && (normKey === 'companydueamount' || normKey === 'companydue' || normKey === 'مستحقالشركة')) colMap['Company Due Amount'] = key;
            if (!isMapped('Co Amount') && (normKey === 'coamount' || normKey === 'copayment' || normKey === 'patientshare' || normKey === 'تحملالمريض')) colMap['Co Amount'] = key;
            if (!isMapped('VAT') && (normKey === 'vat' || normKey === 'tax' || normKey === 'vatamount' || normKey === 'الضريبة' || normKey === 'قيمةمضافة')) colMap['VAT'] = key;
            if (!isMapped('Total Value') && (normKey === 'totalvalue' || normKey === 'net' || normKey === 'revenue' || normKey === 'الاجمالي' || normKey === 'الصافي')) colMap['Total Value'] = key;
          }

          // Second pass: look for partial matches if not found yet
          for (const key of headerRow) {
            if (!key) continue;
            const normKey = String(key).toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
            
            if (!isMapped('Category') && (normKey.includes('category') || normKey.includes('class') || normKey.includes('b2b') || normKey.includes('b2c') || normKey.includes('فئة'))) colMap['Category'] = key;
            if (!isMapped('Date') && (normKey.includes('date') || normKey.includes('تاريخ'))) colMap['Date'] = key;
            if (!isMapped('File Code') && (normKey.includes('filecode') || normKey.includes('patientid') || normKey.includes('mrn') || normKey.includes('رقم') || normKey.includes('ملف'))) colMap['File Code'] = key;
            if (!isMapped('Insurance Company') && (normKey.includes('insurance') || normKey.includes('تأمين') || normKey.includes('شركة'))) colMap['Insurance Company'] = key;
            if (!isMapped('Clinic') && (normKey.includes('clinic') || normKey.includes('department') || normKey.includes('عيادة') || normKey.includes('قسم'))) colMap['Clinic'] = key;
            if (!isMapped('Doctor') && (normKey.includes('doctor') || normKey.includes('physician') || normKey.includes('طبيب') || normKey.includes('دكتور'))) colMap['Doctor'] = key;
            
            // Be careful with partial matches for amounts to avoid mixing them up
            if (!isMapped('Company Due Amount') && (normKey.includes('companydue') || normKey.includes('claim') || normKey.includes('مطالبة') || normKey.includes('مستحق') || normKey.includes('شركة') || normKey.includes('تأمين') || normKey.includes('payor'))) colMap['Company Due Amount'] = key;
            if (!isMapped('Co Amount') && (normKey.includes('coamount') || normKey.includes('copay') || normKey.includes('patientshare') || normKey.includes('تحمل') || normKey.includes('مريض') || normKey.includes('كاش') || normKey.includes('نقدي') || normKey.includes('مساهمة') || normKey.includes('deductible'))) colMap['Co Amount'] = key;
            if (!isMapped('VAT') && (normKey.includes('vat') || normKey.includes('tax') || normKey.includes('ضريبة') || normKey.includes('مضافة'))) colMap['VAT'] = key;
            
            // Total value should be matched last to avoid matching "Total VAT" etc.
            if (!isMapped('Total Value') && !normKey.includes('vat') && !normKey.includes('tax') && !normKey.includes('ضريبة') && 
                (normKey.includes('totalvalue') || normKey.includes('total') || normKey.includes('net') || normKey.includes('revenue') || normKey.includes('gross') || normKey.includes('amount') || normKey.includes('إجمالي') || normKey.includes('اجمالي') || normKey.includes('صافي') || normKey.includes('مبلغ') || normKey.includes('قيمة') || normKey.includes('مجموع'))) {
              colMap['Total Value'] = key;
            }
          }

          // Normalize data using the pre-computed column map
          const normalizedData = jsonData.map((row: any) => {
            const normRow: any = { ...row };
            
            let categoryVal = colMap['Category'] ? String(row[colMap['Category']]).toUpperCase() : '';
            if (categoryVal.includes('B2B')) categoryVal = 'B2B';
            else if (categoryVal.includes('B2C')) categoryVal = 'B2C';
            else {
               const ins = colMap['Insurance Company'] ? String(row[colMap['Insurance Company']]).toLowerCase().trim() : '';
               const isCash = ins === "cash" || ins === "كاش" || ins === "نقدي" || ins === "" || ins === "none" || ins === "null" || ins === "-";
               categoryVal = isCash ? 'B2C' : 'B2B';
            }
            normRow['Category'] = categoryVal;

            if (colMap['Date']) normRow['Date'] = row[colMap['Date']];
            if (colMap['File Code']) normRow['File Code'] = row[colMap['File Code']];
            if (colMap['Insurance Company']) normRow['Insurance Company'] = row[colMap['Insurance Company']];
            if (colMap['Clinic']) normRow['Clinic'] = row[colMap['Clinic']];
            if (colMap['Doctor']) normRow['Doctor'] = row[colMap['Doctor']];
            if (colMap['Company Due Amount']) normRow['Company Due Amount'] = row[colMap['Company Due Amount']];
            if (colMap['Co Amount']) normRow['Co Amount'] = row[colMap['Co Amount']];
            if (colMap['VAT']) normRow['VAT'] = row[colMap['VAT']];
            if (colMap['Total Value']) normRow['Total Value'] = row[colMap['Total Value']];

            return normRow as RawDataRow;
          });

          // Basic validation on normalized data
          const requiredColumns = ["Date", "File Code", "Clinic", "Doctor"];
          const firstRow = normalizedData[0] || {};
          const missingColumns = requiredColumns.filter(col => !(col in firstRow) && !colMap[col]);

          if (missingColumns.length > 0) {
            setError(`Missing required columns: ${missingColumns.join(", ")}. Please ensure your Excel file has these columns.`);
            setIsLoading(false);
            return;
          }

          // Call onDataLoaded and wait for it to finish before hiding loading state
          Promise.resolve(onDataLoaded(normalizedData, setProgressMsg))
            .catch((err) => {
              console.error("Upload failed:", err);
              setError(err.message || "Upload failed. Please check your connection and try again.");
            })
            .finally(() => {
              setIsLoading(false);
              setProgressMsg(null);
            });
        } catch (err) {
          console.error(err);
          setError("Error parsing Excel file. Please ensure it's a valid .xlsx or .xls file.");
          setIsLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError("Failed to read file.");
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      processFile(file);
    } else {
      setError("Please upload a valid Excel file (.xlsx or .xls)");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer",
          isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/50",
          isLoading && "pointer-events-none opacity-60"
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx, .xls"
          className="hidden"
        />

        <div className="mb-6 p-4 bg-blue-50 rounded-2xl text-blue-600">
          {isLoading ? <Loader2 className="w-12 h-12 animate-spin" /> : <Upload className="w-12 h-12" />}
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {isLoading ? "Processing Data..." : "Upload Master Data Sheet"}
        </h2>
        <p className="text-slate-500 text-center max-w-sm mb-8">
          {isLoading 
            ? (progressMsg || "Please wait while we process your Excel file. This might take a moment for large datasets.")
            : "Drag and drop your healthcare revenue Excel file here, or click to browse."}
        </p>

        <div className="flex gap-4 text-xs font-medium text-slate-400">
          <span className="flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" /> XLSX / XLS</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Auto-Validation</span>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute -bottom-16 left-0 right-0 flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
