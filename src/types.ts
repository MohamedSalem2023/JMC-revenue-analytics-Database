export interface RawDataRow {
  Date: string | number | Date;
  "File Code": string | number;
  Category: string; // B2B / B2C
  "Insurance Company": string;
  Clinic: string;
  Doctor: string;
  "Company Due Amount": number;
  "Co Amount": number;
  VAT: number;
  "Total Value": number;
}

export interface ProcessedRow {
  date: Date;
  fileCode: string;
  category: "B2B" | "B2C";
  insuranceCompany: string;
  clinic: string;
  doctor: string;
  companyDue: number;
  coAmount: number;
  vat: number;
  totalValue: number;
  revenue: number;
  b2bRevenue: number;
  b2cRevenue: number;
  b2cCashRevenue: number;
  b2cInsuranceRevenue: number;
  isNewPatient: boolean;
}

export interface DashboardStats {
  totalRevenue: number;
  b2bRevenue: number;
  b2cRevenue: number;
  b2cCashRevenue: number;
  b2cInsuranceRevenue: number;
  totalVolume: number;
  b2bVolume: number;
  b2cVolume: number;
  newPatients: number;
  existingPatients: number;
  cpp: number;
  revenueByClinic: Record<string, { b2b: number; b2c: number }>;
  revenueByDoctor: Record<string, { b2b: number; b2c: number }>;
  revenueByInsurance: Record<string, { b2b: number; b2c: number }>;
  volumeByClinic: Record<string, { b2b: Set<string>; b2c: Set<string> }>;
  volumeByDoctor: Record<string, { b2b: Set<string>; b2c: Set<string> }>;
  volumeByInsurance: Record<string, { b2b: Set<string>; b2c: Set<string> }>;
  monthlyTrends: Record<string, { b2b: number; b2c: number }>;
}
