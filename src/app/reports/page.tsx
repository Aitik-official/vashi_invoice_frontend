"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

const ReportsPage = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMovie, setSelectedMovie] = useState('');
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    fetch('/api/proxy')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setInvoices(data);
        } else {
          console.error('ReportsPage: Invalid data format received from server', data);
          setInvoices([]);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching invoices:', error);
        setLoading(false);
        setInvoices([]);
      });
  }, []);

  // Always work with a safe array to avoid runtime errors if data is malformed
  const invoicesArray = Array.isArray(invoices) ? invoices : [];

  // Helper to safely get numeric grand total from invoice data
  const getGrandTotalFromInvoice = (inv: any): number => {
    const data = inv?.data || {};
    const raw =
      data.grandTotalRs ??
      data.grandTotal ??
      data.netAmount ??
      data.totalCollection ??
      0;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string' && raw.trim() !== '') {
      const cleaned = raw.replace(/[^0-9.\-]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Calculate report statistics
  const totalInvoices = invoicesArray.length;
  const totalRevenue = invoicesArray.reduce((sum, inv) => {
    return sum + getGrandTotalFromInvoice(inv);
  }, 0);
  
  // Helper function to parse date safely for month calculations
  const parseDateForMonth = (dateString: string) => {
    if (!dateString) return null;
    
    // Handle DD/MM/YYYY or DD-MM-YYYY format
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
    } else if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
    }
    
    // Handle other formats
    const date = new Date(dateString);
    return !isNaN(date.getTime()) ? date : null;
  };

  const thisMonthInvoices = invoicesArray.filter(inv => {
    const date = inv.data?.invoiceDate || inv.createdAt;
    if (!date) return false;
    const invoiceDate = parseDateForMonth(date);
    if (!invoiceDate) return false;
    const now = new Date();
    return invoiceDate.getMonth() === now.getMonth() && invoiceDate.getFullYear() === now.getFullYear();
  }).length;

  const thisMonthRevenue = invoicesArray.filter(inv => {
    const date = inv.data?.invoiceDate || inv.createdAt;
    if (!date) return false;
    const invoiceDate = parseDateForMonth(date);
    if (!invoiceDate) return false;
    const now = new Date();
    return invoiceDate.getMonth() === now.getMonth() && invoiceDate.getFullYear() === now.getFullYear();
  }).reduce((sum, inv) => {
    return sum + getGrandTotalFromInvoice(inv);
  }, 0);

  // Calculate last month statistics
  const lastMonthInvoices = invoicesArray.filter(inv => {
    const date = inv.data?.invoiceDate || inv.createdAt;
    if (!date) return false;
    const invoiceDate = parseDateForMonth(date);
    if (!invoiceDate) return false;
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return invoiceDate.getMonth() === lastMonth.getMonth() && invoiceDate.getFullYear() === lastMonth.getFullYear();
  }).length;

  const lastMonthRevenue = invoicesArray.filter(inv => {
    const date = inv.data?.invoiceDate || inv.createdAt;
    if (!date) return false;
    const invoiceDate = parseDateForMonth(date);
    if (!invoiceDate) return false;
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return invoiceDate.getMonth() === lastMonth.getMonth() && invoiceDate.getFullYear() === lastMonth.getFullYear();
  }).reduce((sum, inv) => {
    return sum + getGrandTotalFromInvoice(inv);
  }, 0);

  // Helper function to parse date safely
  const parseDate = (dateString: string) => {
    if (!dateString) return null;
    
    // Handle different date formats
    let date: Date | null = null;
    
    // Try parsing as ISO string (backend format)
    if (dateString.includes('T') || dateString.includes('Z')) {
      date = new Date(dateString);
    }
    // Try parsing DD/MM/YYYY format
    else if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
    // Try parsing DD-MM-YYYY format
    else if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        // Check if it's YYYY-MM-DD format
        if (parts[0].length === 4) {
          date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          // DD-MM-YYYY format
          date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      }
    }
    
    return date && !isNaN(date.getTime()) ? date : null;
  };

  // Get unique client names (Mr. Ra. Ra. style) for dropdown
  const uniqueClients = Array.from(new Set(
    invoicesArray
      .map(inv => inv.data?.mrRaRa || '')
      .filter(name => name && name.trim() !== '')
  )).sort();

  // Filter invoices by date range and/or client name
  const filteredInvoices = invoicesArray.filter(inv => {
    // Date filter (optional)
    let dateMatch = true;
    if (startDate && endDate) {
      const invoiceDate = parseDate(inv.data?.invoiceDate || inv.createdAt);
      if (!invoiceDate) return false;
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      dateMatch = invoiceDate >= start && invoiceDate <= end;
    }
    
    // Client filter (optional)
    const movieMatch = !selectedMovie || inv.data?.mrRaRa === selectedMovie;
    
    return dateMatch && movieMatch;
  });

  // Generate Excel report
  const generateExcelReport = () => {
    // Check if at least one filter is applied (date range or client)
    if (!startDate && !endDate && !selectedMovie) {
      alert('Please select at least one filter (date range or client)');
      return;
    }

    if (filteredInvoices.length === 0) {
      let message = 'No invoices found';
      if (startDate && endDate && selectedMovie) {
        message = `No invoices found for the selected date range and client "${selectedMovie}"`;
      } else if (startDate && endDate) {
        message = 'No invoices found for the selected date range';
      } else if (selectedMovie) {
        message = `No invoices found for client "${selectedMovie}"`;
      }
      alert(message);
      return;
    }

    setGeneratingReport(true);

    try {
      // Get all unique dates from all invoices to create dynamic headers
      const allDates = new Set<string>();
      filteredInvoices.forEach(inv => {
        const data = inv.data || {};
        const table = data.table || [];
        table.forEach((row: any) => {
          if (row.date) {
            allDates.add(row.date);
          }
        });
      });

      // Sort dates for consistent column order
      const sortedDates = Array.from(allDates).sort();

      // Prepare data for Excel
      const excelData = filteredInvoices.map((inv, index) => {
        const data = inv.data || {};
        
        // Extract daily collections from table (if present)
        const table = data.table || [];
        const dailyCollections: { [key: string]: number } = {};
        table.forEach((row: any) => {
          if (row.date && row.collection) {
            dailyCollections[row.date] = Number(row.collection) || 0;
          }
        });

        // Calculate totals based on current Excel-driven setup
        const totalCollection = Number(data.totalCollection || 0);
        const totalExpenses = Number(data.expensesTotal || 0);
        const grandTotal = Number(data.grandTotalRs || data.netAmount || 0);

        // Create row object for current report: include client, totals and expenses
        const rowData: any = {
          'SR. NO': index + 1,
          'CLIENT (MR. RA. RA.)': data.mrRaRa || '',
          'PLACE': data.place || '',
          'CITY': data.centre || '',
          'TOTAL SALES': totalCollection.toFixed(2),
          'TOTAL EXPENSES': totalExpenses.toFixed(2),
          'GRAND TOTAL': grandTotal.toFixed(2),
        };

        // Add dynamic date columns (daily collections) with 2 decimal places
        sortedDates.forEach(date => {
          rowData[date] = Number(dailyCollections[date] || 0).toFixed(2);
        });

        return rowData;
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths dynamically
      const colWidths = [
        { wch: 8 },  // SR. NO
        { wch: 25 }, // CLIENT (MR. RA. RA.)
        { wch: 15 }, // PLACE
        { wch: 15 }, // CITY
        { wch: 14 }, // TOTAL SALES
        { wch: 16 }, // TOTAL EXPENSES
        { wch: 14 }, // GRAND TOTAL
        ...sortedDates.map(() => ({ wch: 12 })), // Dynamic date columns
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Invoice Report');

             // Generate filename with date range and/or movie name
       let filename = 'Invoice_Report';
       
       if (startDate && endDate) {
         const startDateStr = new Date(startDate).toLocaleDateString('en-GB').replace(/\//g, '-');
         const endDateStr = new Date(endDate).toLocaleDateString('en-GB').replace(/\//g, '-');
         filename += `_${startDateStr}_to_${endDateStr}`;
       }
       
       if (selectedMovie) {
         const movieStr = selectedMovie.replace(/[^a-zA-Z0-9]/g, '_');
         filename += `_${movieStr}`;
       }
       
       if (!startDate && !endDate && selectedMovie) {
         filename = `Invoice_Report_${selectedMovie.replace(/[^a-zA-Z0-9]/g, '_')}_AllDates`;
       }
       
       filename += '.xlsx';

      // Download the file
      XLSX.writeFile(wb, filename);
      
      setGeneratingReport(false);
      setShowDateSelector(false);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please try again.');
      setGeneratingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50">
      {/* Top Bar */}
      <div className="flex items-center justify-end px-8 py-0 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 shadow-md border-b" style={{ height: 72 }}>
        <div className="flex items-center gap-4">
          <Link href="/">
            <button className="bg-white hover:bg-orange-100 text-orange-600 font-bold px-7 py-2 rounded-lg transition shadow-lg border border-orange-200 text-lg">
              Dashboard
            </button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-[1600px] mx-auto px-8 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-1">
            <Link href="/">
              <button className="p-2 bg-white hover:bg-orange-100 text-orange-600 rounded-lg transition shadow-lg border border-orange-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            </Link>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Reports & Analytics</h1>
          </div>
          <p className="text-gray-500 text-lg">View comprehensive reports and insights about your invoices.</p>
          
          {/* Date Range and Movie Selector */}
          <div className="mt-6 bg-white rounded-xl shadow-lg p-6 border border-orange-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Generate Excel Report</h2>
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-900 font-medium"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-900 font-medium"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client (Mr. Ra. Ra.) (Optional)</label>
                <select
                  value={selectedMovie}
                  onChange={(e) => setSelectedMovie(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-900 font-medium min-w-[200px]"
                >
                  <option value="">All Clients</option>
                  {uniqueClients.map((client) => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </select>
              </div>
                             <div className="flex items-end">
                 <button
                   onClick={generateExcelReport}
                   disabled={(!startDate && !endDate && !selectedMovie) || generatingReport}
                   className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-bold px-6 py-2 rounded-md transition shadow-lg border border-orange-200 text-lg disabled:cursor-not-allowed"
                 >
                   {generatingReport ? 'Generating...' : 'Generate Report'}
                 </button>
               </div>
            </div>
            {(startDate || endDate || selectedMovie) && (
               <div className="text-sm text-gray-600">
                 Found {filteredInvoices.length} invoices
                 {startDate && endDate && ` between ${new Date(startDate).toLocaleDateString()} and ${new Date(endDate).toLocaleDateString()}`}
                {selectedMovie && ` for client "${selectedMovie}"`}
                {!startDate && !endDate && selectedMovie && ` (all dates)`}
               </div>
             )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-xl text-gray-600">Loading reports...</div>
          </div>
                 ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
             {/* Total Invoices Card */}
             <div className="bg-white rounded-xl shadow-lg p-6 border border-orange-100">
               <div className="flex items-center">
                 <div className="p-3 rounded-full bg-orange-100">
                   <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                   </svg>
                 </div>
                 <div className="ml-4">
                   <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                   <p className="text-2xl font-bold text-gray-900">{totalInvoices}</p>
                 </div>
               </div>
             </div>

                           {/* Total Revenue Card */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-green-100">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">₹{totalRevenue.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

             {/* This Month Invoices Card */}
             <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
               <div className="flex items-center">
                 <div className="p-3 rounded-full bg-blue-100">
                   <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                   </svg>
                 </div>
                 <div className="ml-4">
                   <p className="text-sm font-medium text-gray-600">This Month</p>
                   <p className="text-2xl font-bold text-gray-900">{thisMonthInvoices} invoices</p>
                 </div>
               </div>
             </div>

             {/* Last Month Invoices Card */}
             <div className="bg-white rounded-xl shadow-lg p-6 border border-indigo-100">
               <div className="flex items-center">
                 <div className="p-3 rounded-full bg-indigo-100">
                   <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                   </svg>
                 </div>
                 <div className="ml-4">
                   <p className="text-sm font-medium text-gray-600">Last Month</p>
                   <p className="text-2xl font-bold text-gray-900">{lastMonthInvoices} invoices</p>
                 </div>
               </div>
             </div>

             {/* This Month Revenue Card */}
             <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
               <div className="flex items-center">
                 <div className="p-3 rounded-full bg-purple-100">
                   <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                   </svg>
                 </div>
                 <div className="ml-4">
                   <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                   <p className="text-2xl font-bold text-gray-900">₹{thisMonthRevenue.toLocaleString('en-IN')}</p>
                 </div>
               </div>
             </div>
           </div>
        )}

        {/* Recent Invoices Table */}
        <div className="bg-white rounded-xl shadow-lg border border-orange-100">
          <div className="px-6 py-4 border-b border-orange-100">
            <h2 className="text-xl font-bold text-gray-900">Recent Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-orange-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-orange-100">
                {invoicesArray.slice(0, 10).map((inv, idx) => (
                  <tr key={inv._id} className="hover:bg-orange-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                          {inv.data?.["In_no"] || 'No "In_no" Found'}
                        </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {inv.data?.mrRaRa || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inv.data?.invoiceDate || inv.invoiceDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{(inv.data?.totalCollection || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage; 