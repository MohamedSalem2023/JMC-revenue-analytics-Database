import { RawDataRow, ProcessedRow, DashboardStats } from "../types";
import { parse, format, startOfMonth, isBefore } from "date-fns";

export function parseExcelDate(dateValue: any): Date {
  if (!dateValue) return new Date();
  
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return new Date();
    
    // ✅ FIX: use LOCAL instead of UTC
    return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
  }
  
  if (typeof dateValue === 'number') {
    // Excel date serial number
    const dateInfo = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
    
    // ✅ FIX: use LOCAL instead of UTC
    return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate());
  }
  
  if (typeof dateValue === 'string') {
    let trimmed = dateValue.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    for (let i = 0; i < 10; i++) {
      trimmed = trimmed.replace(new RegExp(arabicNumbers[i], 'g'), i.toString());
    }
    
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

    if (/^\d+$/.test(trimmed) && Number(trimmed) > 20000) {
      const dateInfo = new Date(Math.round((Number(trimmed) - 25569) * 86400 * 1000));
      
      // ✅ FIX: use LOCAL instead of UTC
      return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate());
    }

    const parts = trimmed.split(/[-/.]/).map(p => p.trim());
    if (parts.length === 3) {
      if (parts[2].length === 4 || parts[2].length === 2) {
        let day = Number(parts[0]);
        let month = Number(parts[1]);
        let year = Number(parts[2]);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          if (year < 100) year += 2000;
          
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
          return new Date(year, month - 1, day);
        }
      }
    } else if (parts.length === 2) {
      let p0 = Number(parts[0]);
      let p1 = Number(parts[1]);
      if (!isNaN(p0) && !isNaN(p1)) {
        if (parts[1].length === 4) {
          return new Date(p1, p0 - 1, 1);
        } else if (parts[0].length === 4) {
          return new Date(p0, p1 - 1, 1);
        }
      }
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
       
       if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
         // ✅ FIX: use LOCAL instead of UTC
         return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
       }
       
       if (trimmed.includes('T') && trimmed.endsWith('Z')) {
         if (trimmed.includes('T22:00:00') || trimmed.includes('T23:00:00')) {
           return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
         }
         
         // ✅ FIX: use LOCAL instead of UTC
         return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
       }
       
       return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  return new Date();
}
