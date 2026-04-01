import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { ProcessedRow, DashboardStats } from "../types";
import { format } from "date-fns";

export function exportToExcel(data: ProcessedRow[], filename: string = "Revenue_Report.xlsx") {
  try {
    if (!data || data.length === 0) {
      alert("No data available to export.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(data.map(row => ({
      Date: row.date && !isNaN(row.date.getTime()) ? format(row.date, "yyyy-MM-dd") : "Invalid Date",
      "File Code": row.fileCode,
      Category: row.category,
      "Insurance Company": row.insuranceCompany,
      Clinic: row.clinic,
      Doctor: row.doctor,
      "Company Due": row.companyDue,
      "Co Amount": row.coAmount,
      VAT: row.vat,
      Revenue: row.revenue,
      "B2B Revenue": row.b2bRevenue,
      "B2C Revenue": row.b2cRevenue,
      "B2C Cash Revenue": row.b2cCashRevenue,
      "B2C Insurance Revenue": row.b2cInsuranceRevenue,
      "Patient Type": row.isNewPatient ? "New" : "Existing"
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Revenue Data");
    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    alert("Failed to export to Excel. Please try again.");
  }
}

export async function exportToPDF(stats: DashboardStats, filename: string = "Revenue_Presentation.pdf") {
  try {
    // Create a landscape PDF for presentation style
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Background color
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // Try to add logo
    try {
      const logoUrl = "https://scontent.fdmm3-2.fna.fbcdn.net/v/t39.30808-6/450998298_1150415529461259_130598404335151586_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=LcOecER7Vb8Q7kNvwErsy3r&_nc_oc=Adruk9JnfgD1599db-aJMpbyCJdUsG2mznfW5aVdtusbLgTY2GPP_WIcIv72ta6DEADZYmkY3yAE63Brkm_x_qcj&_nc_zt=23&_nc_ht=scontent.fdmm3-2.fna&_nc_gid=2SF07jAdE6bjLjJFwgUb4g&_nc_ss=7a3a8&oh=00_AfyJpTLVbaYQ1MK8C1itpP9WmWPoHkCGJgXUhf4eDPavZA&oe=69D18B30";
      
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = logoUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg");
        doc.addImage(dataUrl, "JPEG", 20, 15, 30, 30);
      }
    } catch (e) {
      console.warn("Could not load logo for PDF", e);
    }

    // Header
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("Executive Revenue Report", 60, 25);
    
    // Arabic text might not render correctly in standard jsPDF without a custom font, 
    // so we'll use English or a simple representation if needed, but let's try to add the name.
    // Since jsPDF standard fonts don't support Arabic well, we might just see garbled text,
    // but we will add it anyway as requested.
    doc.setFontSize(16);
    doc.setTextColor(59, 130, 246); // blue-600
    // "Tawareyat Medical Care Center - Jubail"
    doc.text("Tawareyat Medical Care Center - Jubail", 60, 35);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on: ${format(new Date(), "PPpp")}`, 60, 45);

    // Draw a line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(1);
    doc.line(20, 55, pageWidth - 20, 55);

    // KPI Cards (Draw rectangles)
    const drawCard = (x: number, y: number, title: string, value: string, subtitle: string, color: number[]) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, 60, 40, 3, 3, "FD");
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(title, x + 5, y + 10);
      
      doc.setFontSize(16);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(value, x + 5, y + 22);
      
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(subtitle, x + 5, y + 32);
    };

    let startY = 70;
    drawCard(20, startY, "Total Revenue", `SAR ${stats.totalRevenue.toLocaleString()}`, "Combined B2B & B2C", [15, 23, 42]);
    drawCard(85, startY, "B2B Revenue", `SAR ${stats.b2bRevenue.toLocaleString()}`, "Company Due Amount", [59, 130, 246]);
    drawCard(150, startY, "B2C Revenue", `SAR ${stats.b2cRevenue.toLocaleString()}`, "Cash & Insurance", [16, 185, 129]);
    drawCard(215, startY, "Patient Volume", stats.totalVolume.toLocaleString(), `${stats.newPatients} New / ${stats.existingPatients} Existing`, [139, 92, 246]);

    startY += 50;
    drawCard(20, startY, "B2C Cash", `SAR ${stats.b2cCashRevenue.toLocaleString()}`, "Co Amount + VAT", [16, 185, 129]);
    drawCard(85, startY, "B2C Insurance", `SAR ${stats.b2cInsuranceRevenue.toLocaleString()}`, "Company Due Amount", [16, 185, 129]);
    drawCard(150, startY, "Average CPP", `SAR ${stats.cpp.toLocaleString()}`, "Cost Per Patient", [245, 158, 11]);

    // Add a footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Confidential & Proprietary - Tawareyat Medical Care Center", pageWidth / 2, pageHeight - 10, { align: "center" });

    doc.save(filename);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    alert("Failed to export to PDF. Please try again.");
  }
}
