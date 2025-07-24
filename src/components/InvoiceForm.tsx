import React, { useState } from "react";
import * as XLSX from "xlsx";

const GST_RATE = 0.18; // 18%
const CGST_RATE = 0.09;
const SGST_RATE = 0.09;

interface InvoiceRow {
  [key: string]: string | number | { [key: string]: string | number }[] | undefined;
}

interface InvoiceFormProps {
  onChange?: (invoices: InvoiceRow[]) => void;
  onPreview?: () => void;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ onChange, onPreview }) => {
  const [share, setShare] = useState<number>(45); // default 45%
  const [gstType, setGstType] = useState<'IGST' | 'CGST/SGST'>('CGST/SGST');
  const [gstRate, setGstRate] = useState<number>(18); // default 18%
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [error, setError] = useState<string>("");
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  const handleShareChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShare(Number(e.target.value));
    // Update parent immediately
    onChange && onChange(invoices.map(inv => ({ ...inv, share: Number(e.target.value), gstType, gstRate })));
  };
  const handleGstTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGstType(e.target.value as 'IGST' | 'CGST/SGST');
    // Update parent immediately
    onChange && onChange(invoices.map(inv => ({ ...inv, share, gstType: e.target.value as 'IGST' | 'CGST/SGST', gstRate })));
  };
  const handleGstRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGstRate(Number(e.target.value));
    // Update parent immediately
    onChange && onChange(invoices.map(inv => ({ ...inv, share, gstType, gstRate: Number(e.target.value) })));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFileName(file ? file.name : "");
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (!evt.target) return;
      const data = new Uint8Array(evt.target.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });
      if (!rows.length) {
        setError("No data found in Excel file.");
        return;
      }
      // For each row, build invoice object with table array and summary fields
      const processed = rows.map((row) => {
        // Invoice-level fields (map Excel columns to expected keys)
        const today = new Date();
        const pad = (n: number) => n < 10 ? '0' + n : n;
        const todayStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
        const invoiceFields = {
          clientName: row["BILL TO"] || "",
          clientAddress: row["ADDRESS"] || "",
          panNo: row["PAN NO."] || "",
          gstinNo: row["GST NUMBER"] || "",
          property: row["CINEMA NAME"] || "",
          centre: row["CENTRE"] || "",
          placeOfService: row["PLACE OF SERVICE"] || "",
          businessTerritory: row["CIRCUIT"] || "",
          invoiceNo: row["Invoice No"] || row["INVOICE NO"] || "INV_01",
          invoiceDate: row["Invoice Date"] || row["INVOICE DATE"] || todayStr,
          movieName: row["Movie Name"] || row["MOVIE NAME"] || "",
          movieVersion: row["Movie Version"] || row["MOVIE VERSION"] || "",
          language: row["Language"] || row["LANGUAGE"] || "",
          screenFormat: row["Screen Formate"] || row["SCREEN FORMATE"] || "",
          week: row["Release Week"] || row["RELEASE WEEK"] || "",
          cinemaWeek: row["Cinema Week"] || row["CINEMA WEEK"] || "",
          screeningFrom: row["Screening Date From"] || row["Screening Date"] || row["SCREENING DATE"] || row["Screening Start Date"] || row["SCREENING START DATE"] || row["H"] || "",
          screeningTo: row["Screening Date To"] || row["Screening End Date"] || row["SCREENING END DATE"] || row["I"] || "",
          hsnSacCode: row["HSN/SAC Code"] || row["HSN/SAC CODE"] || "",
          description: row["Description"] || row["DESCRIPTION"] || "",
        };
        // Build table array for all date columns dynamically
        const table: { date: string; show: number; aud: number; collection: number; deduction: string; deductionAmt: number }[] = [];
        let totalShow = 0, totalAud = 0, totalCollection = 0;
        // Find all keys that match the pattern 'DATE SHOW', 'DATE AUDIENCE', 'DATE COLLECTION'
        const dateShowRegex = /^([0-9]{1,2}-[0-9]{2}) SHOW$/i;
        const dateColumns = Object.keys(row)
          .map((key) => {
            const match = key.match(dateShowRegex);
            if (match) return match[1];
            return null;
          })
          .filter((date): date is string => !!date);
        // For each found date, build the row
        dateColumns.forEach((date) => {
          const show = Number(row[`${date} SHOW`]) || 0;
          const aud = Number(row[`${date} AUDIENCE`]) || 0;
          const collection = Number(row[`${date} COLLECTION`]) || 0;
          if (show || aud || collection) {
            table.push({
              date,
              show,
              aud,
              collection,
              deduction: '',
              deductionAmt: 0,
            });
          }
          totalShow += show;
          totalAud += aud;
          totalCollection += collection;
        });
        // Summary fields
        const totalShowVal = Number(row["TOTAL SHOW"]) || totalShow;
        const totalAudVal = Number(row["TOTAL AUDIENCE"]) || totalAud;
        const totalCollectionVal = Number(row["TOTAL COLLECTION"]) || totalCollection;
        const showTax = Number(row["SHOW TAX"]) || 0;
        const otherDeduction = Number(row["OTHERS"]) || 0;
        return {
          ...invoiceFields,
          table,
          totalShow: totalShowVal,
          totalAud: totalAudVal,
          totalCollection: totalCollectionVal,
          showTax,
          otherDeduction,
        };
      });
      setInvoices(processed);
      setError("");
      // Pass share, gstType, gstRate to parent for preview
      onChange && onChange(processed.map(inv => ({ ...inv, share, gstType, gstRate })));
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!invoices.length) {
      setError("Please upload a valid Excel file.");
      return;
    }
    onChange && onChange(invoices.map(inv => ({ ...inv, share, gstType, gstRate })));
    if (onPreview) onPreview();
  };

  return (
    <form className="space-y-4 text-gray-800 w-full max-w-xs bg-white p-6 rounded-lg shadow-md" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold mb-4">Upload the file and set GST & Share</h2>
      <div>
        <label className="block text-xs font-semibold mb-1">Excel File</label>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            id="excel-upload"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => document.getElementById('excel-upload')?.click()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded shadow"
          >
            Select File
          </button>
          <span className="text-xs text-gray-600 truncate max-w-[120px]">{selectedFileName || "No file chosen"}</span>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">Share %</label>
        <input type="number" min="0" max="100" value={share} onChange={handleShareChange} className="w-24 border px-2 py-1 rounded" />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">GST Type</label>
        <select value={gstType} onChange={handleGstTypeChange} className="w-32 border px-2 py-1 rounded">
          <option value="IGST">IGST</option>
          <option value="CGST/SGST">CGST/SGST</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">GST %</label>
        <input type="number" min="0" max="100" value={gstRate} onChange={handleGstRateChange} className="w-24 border px-2 py-1 rounded" />
      </div>
      {error && <div className="text-red-500 text-xs">{error}</div>}
      <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded w-full">Preview Invoices</button>
    </form>
  );
};

export default InvoiceForm; 