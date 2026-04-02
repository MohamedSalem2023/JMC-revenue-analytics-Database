import { RawDataRow, ProcessedRow, DashboardStats } from "../types";
import { parse, format, startOfMonth, isBefore } from "date-fns";

export function parseExcelDate(dateValue: any): Date {
  if (!dateValue) return new Date();
  
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return new Date();
    
    // xlsx creates Date objects using UTC time. Always use the UTC date components.
    return new Date(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate());
  }
  
  if (typeof dateValue === 'number') {
    // Excel date serial number
    const dateInfo = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
    return new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate());
  }
  
  if (typeof dateValue === 'string') {
    let trimmed = dateValue.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // Convert Arabic digits to English digits
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    for (let i = 0; i < 10; i++) {
      trimmed = trimmed.replace(new RegExp(arabicNumbers[i], 'g'), i.toString());
    }
    
    // Handle Arabic months
    const arabicMonths: Record<string, string> = {
      'يناير': 'Jan', 'فبراير': 'Feb', 'مارس': 'Mar', 'أبريل': 'Apr', 'ابريل': 'Apr',
      'مايو': 'May', 'يونيو': 'Jun', 'يوليو': 'Jul', 'أغسطس': 'Aug', 'اغسطس': 'Aug',
      'سبتمبر': 'Sep', 'أكتوبر': 'Oct', 'اكتوبر': 'Oct', 'نوفمبر': 'Nov', 'ديسمبر': 'Dec'
    };
    
    for (const [ar, en] of Object.entries(arabicMonths)) {
      if (trimmed.includes(ar)) {
        trimmed = trimmed.replace(ar, en);
      }
    }

    // Check if it's a string representation of an Excel serial number
    if (/^\d+$/.test(trimmed) && Number(trimmed) > 20000) {
      const dateInfo = new Date(Math.round((Number(trimmed) - 25569) * 86400 * 1000));
      return new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate());
    }

    // Handle DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
    const parts = trimmed.split(/[-/.]/).map(p => p.trim());
    if (parts.length === 3) {
      if (parts[2].length === 4 || parts[2].length === 2) {
        let day = Number(parts[0]);
        let month = Number(parts[1]);
        let year = Number(parts[2]);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          if (year < 100) year += 2000;
          
          // If month > 12, it must be MM/DD/YYYY
          if (month > 12) {
            day = Number(parts[1]);
            month = Number(parts[0]);
          }
          return new Date(year, month - 1, day);
        }
      }
      if (parts[0].length === 4) {
        let year = Number(parts[0]);
        let month = Number(parts[1]);
        let day = Number(parts[2]);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          // Assume YYYY/MM/DD
          return new Date(year, month - 1, day);
        }
      }
    } else if (parts.length === 2) {
      let p0 = Number(parts[0]);
      let p1 = Number(parts[1]);
      if (!isNaN(p0) && !isNaN(p1)) {
        if (parts[1].length === 4) {
          // MM-YYYY
          return new Date(p1, p0 - 1, 1);
        } else if (parts[0].length === 4) {
          // YYYY-MM
          return new Date(p0, p1 - 1, 1);
        }
      }
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
       // YYYY-MM-DD is parsed as UTC midnight by default in JS
       if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
         return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
       }
       
       // Handle ISO strings (e.g., from localforage storage fallback or Firestore)
       if (trimmed.includes('T') && trimmed.endsWith('Z')) {
         // If the time is 22:00:00 or 23:00:00, it's likely a local midnight date that was converted to UTC.
         // In this case, we should use the local date components to restore the original date.
         if (trimmed.includes('T22:00:00') || trimmed.includes('T23:00:00')) {
           return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
         }
         // Otherwise, use the UTC date components.
         return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
       }
       
       // For any other string, JS parses it as local time. Return local midnight.
       return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  return new Date(); // fallback
}

export function processRawData(data: RawDataRow[]): ProcessedRow[] {
  const patientFirstSeen: Record<string, Date> = {};

  if (!data || data.length === 0) return [];

  // Determine column mapping from the first row's keys
  const headerRow = Object.keys(data[0]);
  const colMap: Record<string, string> = {};
  const isMapped = (targetCol: string) => !!colMap[targetCol];

  // First pass: look for exact or very strong matches
  for (const key of headerRow) {
    if (!key) continue;
    const normKey = String(key).toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
    
    if (!isMapped('Category') && (normKey === 'category' || normKey === 'type' || normKey === 'class' || normKey === 'فئة' || normKey === 'نوع')) colMap['Category'] = key;
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
    
    if (!isMapped('Company Due Amount') && (normKey.includes('companydue') || normKey.includes('claim') || normKey.includes('مطالبة') || normKey.includes('مستحق') || normKey.includes('شركة') || normKey.includes('تأمين') || normKey.includes('payor'))) colMap['Company Due Amount'] = key;
    if (!isMapped('Co Amount') && (normKey.includes('coamount') || normKey.includes('copay') || normKey.includes('patientshare') || normKey.includes('تحمل') || normKey.includes('مريض') || normKey.includes('كاش') || normKey.includes('نقدي') || normKey.includes('مساهمة') || normKey.includes('deductible'))) colMap['Co Amount'] = key;
    if (!isMapped('VAT') && (normKey.includes('vat') || normKey.includes('tax') || normKey.includes('ضريبة') || normKey.includes('مضافة'))) colMap['VAT'] = key;
    
    if (!isMapped('Total Value') && !normKey.includes('vat') && !normKey.includes('tax') && !normKey.includes('ضريبة') && 
        (normKey.includes('totalvalue') || normKey.includes('total') || normKey.includes('net') || normKey.includes('revenue') || normKey.includes('gross') || normKey.includes('amount') || normKey.includes('إجمالي') || normKey.includes('اجمالي') || normKey.includes('صافي') || normKey.includes('مبلغ') || normKey.includes('قيمة') || normKey.includes('مجموع'))) {
      colMap['Total Value'] = key;
    }
  }

  // Parse dates once before sorting to improve performance for mass data
  const dataWithParsedDates = data.map(row => {
    // If the row already has the normalized key, use it. Otherwise use the mapped key.
    const dateVal = row['Date'] !== undefined ? row['Date'] : (colMap['Date'] ? row[colMap['Date']] : undefined);
    return {
      ...row,
      parsedDate: parseExcelDate(dateVal)
    };
  });

  // Sort data by date to correctly identify new patients
  const sortedData = dataWithParsedDates.sort((a, b) => {
    return a.parsedDate.getTime() - b.parsedDate.getTime();
  });

  return sortedData.map((row) => {
    const date = row.parsedDate;
    
    // Helper to get value either from normalized key or mapped original key
    const getVal = (key: string) => {
      if (row[key] !== undefined) return row[key];
      if (colMap[key] && row[colMap[key]] !== undefined) return row[colMap[key]];
      return undefined;
    };

    const fileCode = String(getVal("File Code") || "");
    const rawCategory = String(getVal("Category") || "");
    const category = rawCategory.toUpperCase().includes("B2B") ? "B2B" : "B2C";
    
    const parseNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      let str = String(val).trim();
      
      // Convert Arabic digits to English digits
      const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
      for (let i = 0; i < 10; i++) {
        str = str.replace(new RegExp(arabicNumbers[i], 'g'), i.toString());
      }
      
      let isNegative = str.startsWith('(') && str.endsWith(')') || str.includes('-');
      
      // Remove everything except digits, dots, and commas
      str = str.replace(/[^0-9.,]/g, '');
      
      // Handle European format (e.g., 1.234,56 or 1234,56)
      const lastComma = str.lastIndexOf(',');
      const lastDot = str.lastIndexOf('.');
      
      // Count occurrences of commas and dots
      const commaCount = (str.match(/,/g) || []).length;
      const dotCount = (str.match(/\./g) || []).length;

      if (lastComma > lastDot && lastComma !== -1) {
        // If there are multiple commas, or if the comma is exactly 3 digits from the end and there's no dot, it's likely a US thousands separator
        if (commaCount > 1 || (lastDot === -1 && str.length - lastComma === 4)) {
           str = str.replace(/,/g, '');
        } else {
           // Comma is the decimal separator
           str = str.replace(/\./g, ''); // remove thousands separators
           str = str.replace(',', '.'); // convert decimal comma to dot
        }
      } else {
        // If there are multiple dots, or if the dot is exactly 3 digits from the end and there's no comma, it's likely a European thousands separator
        if (dotCount > 1 || (lastComma === -1 && str.length - lastDot === 4)) {
           str = str.replace(/\./g, '');
        } else {
           // Dot is the decimal separator
           str = str.replace(/,/g, ''); // remove thousands separators
        }
      }
      
      let num = Number(str);
      if (isNaN(num)) num = 0;
      return isNegative ? -num : num;
    };

    const companyDue = parseNumber(getVal("Company Due Amount"));
    const coAmount = parseNumber(getVal("Co Amount"));
    const vat = parseNumber(getVal("VAT"));
    let rawTotalValue = parseNumber(getVal("Total Value"));

    // Fallback: if Total Value is missing or 0, calculate it from the sum of its parts
    if (rawTotalValue === 0 && (companyDue > 0 || coAmount > 0 || vat > 0)) {
      rawTotalValue = companyDue + coAmount + vat;
    }

    const insStr = String(getVal("Insurance Company") || "").toLowerCase().trim();
    const isCash = insStr === "cash" || insStr === "كاش" || insStr === "نقدي" || insStr === "" || insStr === "none" || insStr === "null" || insStr === "-";
    
    let b2bRev = 0;
    let b2cCashRev = 0;
    let b2cInsRev = 0;
    let b2cRev = 0;

    if (category === "B2B") {
      b2bRev = rawTotalValue;
    } else {
      b2cCashRev = coAmount + vat;
      b2cInsRev = companyDue;
      b2cRev = rawTotalValue;
    }

    const revenue = rawTotalValue;

    const isNewPatient = !patientFirstSeen[fileCode];
    if (isNewPatient) {
      patientFirstSeen[fileCode] = date;
    }

    return {
      date,
      fileCode,
      category,
      insuranceCompany: getVal("Insurance Company") || "Cash",
      clinic: getVal("Clinic") || "Unknown",
      doctor: getVal("Doctor") || "Unknown",
      companyDue,
      coAmount,
      vat,
      totalValue: rawTotalValue,
      revenue,
      b2bRevenue: b2bRev,
      b2cRevenue: b2cRev,
      b2cCashRevenue: b2cCashRev,
      b2cInsuranceRevenue: b2cInsRev,
      isNewPatient,
    };
  });
}

export function calculateStats(data: ProcessedRow[]): DashboardStats {
  const stats: DashboardStats = {
    totalRevenue: 0,
    b2bRevenue: 0,
    b2cRevenue: 0,
    b2cCashRevenue: 0,
    b2cInsuranceRevenue: 0,
    totalVolume: 0,
    b2bVolume: 0,
    b2cVolume: 0,
    newPatients: 0,
    existingPatients: 0,
    cpp: 0,
    revenueByClinic: {},
    revenueByDoctor: {},
    revenueByInsurance: {},
    volumeByClinic: {},
    volumeByDoctor: {},
    volumeByInsurance: {},
    monthlyTrends: {},
  };

  const uniquePatientsInPeriod = new Set<string>();
  const uniqueNewPatientsInPeriod = new Set<string>();
  const uniqueB2B = new Set<string>();
  const uniqueB2C = new Set<string>();
  const clinicPatientMap: Record<string, Set<string>> = {};
  const doctorPatientMap: Record<string, Set<string>> = {};

  data.forEach((row) => {
    stats.totalRevenue += row.revenue;
    stats.b2bRevenue += row.b2bRevenue;
    stats.b2cRevenue += row.b2cRevenue;
    stats.b2cCashRevenue += row.b2cCashRevenue;
    stats.b2cInsuranceRevenue += row.b2cInsuranceRevenue;

    uniquePatientsInPeriod.add(row.fileCode);
    if (row.isNewPatient) {
      uniqueNewPatientsInPeriod.add(row.fileCode);
    }
    if (row.category === "B2B") uniqueB2B.add(row.fileCode);
    else uniqueB2C.add(row.fileCode);

    // Revenue Aggregations
    const updateRevenue = (map: Record<string, { b2b: number; b2c: number }>, key: string) => {
      if (!map[key]) map[key] = { b2b: 0, b2c: 0 };
      map[key].b2b += row.b2bRevenue;
      map[key].b2c += row.b2cRevenue;
    };

    updateRevenue(stats.revenueByClinic, row.clinic);
    updateRevenue(stats.revenueByDoctor, row.doctor);
    updateRevenue(stats.revenueByInsurance, row.insuranceCompany);

    // Volume Logic: Counted per Clinic/Doctor
    // Same patient visiting multiple clinics = counted in each clinic
    // Same patient with multiple invoices in same clinic = counted ONCE per clinic
    const updateVolume = (map: Record<string, { b2b: Set<string>; b2c: Set<string> }>, key: string) => {
      if (!map[key]) map[key] = { b2b: new Set(), b2c: new Set() };
      if (row.category === "B2B") map[key].b2b.add(row.fileCode);
      else map[key].b2c.add(row.fileCode);
    };

    updateVolume(stats.volumeByClinic, row.clinic);
    updateVolume(stats.volumeByDoctor, row.doctor);
    updateVolume(stats.volumeByInsurance, row.insuranceCompany);

    // Monthly Trends
    const monthKey = format(startOfMonth(row.date), "MMM yyyy");
    if (!stats.monthlyTrends[monthKey]) stats.monthlyTrends[monthKey] = { b2b: 0, b2c: 0 };
    stats.monthlyTrends[monthKey].b2b += row.b2bRevenue;
    stats.monthlyTrends[monthKey].b2c += row.b2cRevenue;
  });

  // Revert Total Volume to sum of clinic volumes as requested by user
  stats.b2bVolume = Object.values(stats.volumeByClinic).reduce((acc, val) => acc + val.b2b.size, 0);
  stats.b2cVolume = Object.values(stats.volumeByClinic).reduce((acc, val) => acc + val.b2c.size, 0);
  stats.totalVolume = stats.b2bVolume + stats.b2cVolume;

  // Calculate new vs existing patients based on unique patients in this filtered period
  stats.newPatients = uniqueNewPatientsInPeriod.size;
  stats.existingPatients = Math.max(0, stats.totalVolume - stats.newPatients);

  stats.cpp = stats.totalVolume > 0 ? stats.totalRevenue / stats.totalVolume : 0;

  // Round all values to nearest whole number
  stats.totalRevenue = Math.round(stats.totalRevenue);
  stats.b2bRevenue = Math.round(stats.b2bRevenue);
  stats.b2cRevenue = Math.round(stats.b2cRevenue);
  stats.b2cCashRevenue = Math.round(stats.b2cCashRevenue);
  stats.b2cInsuranceRevenue = Math.round(stats.b2cInsuranceRevenue);
  stats.cpp = Math.round(stats.cpp);

  const roundMap = (map: Record<string, { b2b: number; b2c: number }>) => {
    Object.keys(map).forEach(k => {
      map[k].b2b = Math.round(map[k].b2b);
      map[k].b2c = Math.round(map[k].b2c);
    });
  };

  roundMap(stats.revenueByClinic);
  roundMap(stats.revenueByDoctor);
  roundMap(stats.revenueByInsurance);
  roundMap(stats.monthlyTrends);

  return stats;
}
