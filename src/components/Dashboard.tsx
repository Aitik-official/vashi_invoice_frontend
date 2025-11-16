"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import InvoicePreview from './InvoicePreview';
import EditPreview from './Edit_preview';
import { generateStandardizedPDF } from '../utils/pdfGenerator';

const Dashboard = ({ onLogout }: { onLogout?: () => void }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Show All');
  const [showFilter, setShowFilter] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [backendError, setBackendError] = useState<string>('');

  // Get invoice data for InvoicePreview - transform saved data to match InvoicePreview format
  const getInvoiceData = (inv: any) => {
    if (!inv) return {};
    const data = inv.data || {};
    
    // Transform goods table data from individual row fields to goodsTable array
    const goodsTable: any[] = [];
    for (let i = 0; i < 13; i++) {
      const details = data[`row${i}_details`] || '';
      const piece = data[`row${i}_item`] || '';
      const crates = data[`row${i}_piece`] || '';
      const price = data[`row${i}_price`] || '';
      
      // Calculate amount from piece, crates, and price if available
      let amount = 0;
      if (piece && price) {
        const pieceNum = parseMarathiNumber(String(piece));
        const priceNum = parseMarathiNumber(String(price));
        amount = pieceNum * priceNum;
      }
      
      if (details || piece || crates || price || amount) {
        goodsTable.push({
          details: details,
          detailsOfGoods: details,
          piece: piece,
          crates: crates,
          price: price,
          amount: amount || data[`row${i}_amount`] || ''
        });
      }
    }
    
    // Transform expenses data
    const expensesData: any[] = [];
    const expenseNames = ['commission', 'porterage', 'carRental', 'bundleExpenses', 'hundekariExpenses', 'spaceRent', 'warai', 'otherExpenses'];
    for (let i = 0; i < 8; i++) {
      const rs = data[`expense${i}_rs`] || '';
      const paise = data[`expense${i}_paise`] || '';
      if (rs || paise) {
        expensesData.push({
          name: expenseNames[i],
          rs: rs,
          paise: paise
        });
      }
    }
    
    // Calculate totals
    const calculateTotalSales = () => {
      let totalPaise = 0;
      goodsTable.forEach((row: any) => {
        if (row.amount) {
          const amountNum = parseMarathiNumber(String(row.amount));
          totalPaise += Math.round(amountNum * 100);
        }
      });
      const totalRs = Math.floor(totalPaise / 100);
      const remainingPaise = totalPaise % 100;
      return { rs: totalRs, paise: remainingPaise };
    };
    
    const calculateTotalExpenses = () => {
      let totalPaise = 0;
      expensesData.forEach((exp: any) => {
        const rs = parseMarathiNumber(String(exp.rs || '0'));
        const paise = parseMarathiNumber(String(exp.paise || '0'));
        totalPaise += (rs * 100) + paise;
      });
      const totalRs = Math.floor(totalPaise / 100);
      const remainingPaise = totalPaise % 100;
      return { rs: totalRs, paise: remainingPaise };
    };
    
    const totalSales = calculateTotalSales();
    const totalExpenses = calculateTotalExpenses();
    const netBalance = {
      rs: totalSales.rs - totalExpenses.rs,
      paise: totalSales.paise - totalExpenses.paise,
      isNegative: (totalSales.rs - totalExpenses.rs) < 0 || ((totalSales.rs - totalExpenses.rs) === 0 && totalSales.paise < totalExpenses.paise)
    };
    
    // Only use Excel data, remove backend-generated fields
    return {
      ...data,
      goodsTable: goodsTable,
      expenses: expensesData,
      // Remove invoiceId and invoiceNo - only use Excel data
    };
  };

  // Memoize invoice data for preview - use getInvoiceData to transform the data
  const memoizedInvoiceData = useMemo(() => {
    if (!selectedInvoice) return {};
    try {
      return getInvoiceData(selectedInvoice);
    } catch (error) {
      return {};
    }
  }, [selectedInvoice]);

  // Fetch invoices from backend
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    fetch('/api/proxy', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setInvoices(data);
          setBackendError('');
        } else {
          setInvoices([]);
          setBackendError('Invalid data format received from server');
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        
        let errorMessage = 'Unable to load invoices from server';
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out - server may be slow';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'CORS error - server configuration issue';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error - backend temporarily unavailable';
        }
        
        setBackendError(errorMessage);
        setInvoices([]);
      });
  }, []);

  // Helper function to parse date safely
  const parseDate = (dateString: string) => {
    if (!dateString) return null;
    
    let date: Date | null = null;
    
    if (dateString.includes('T') || dateString.includes('Z')) {
      date = new Date(dateString);
    } else if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
    
    if (date && !isNaN(date.getTime())) {
      return date;
    }
    return null;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isThisWeek = (date: Date) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return date >= startOfWeek && date <= endOfWeek;
  };

  const isThisMonth = (date: Date) => {
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  // Filtered data based on search and filter
  const filteredInvoices = invoices.filter(inv => {
    const clientName = inv.data?.mrRaRa || inv.mrRaRa || inv.data?.clientName || inv.clientName || '';
    const displayInvoiceNo = (inv.data as any)?.["In_no"] || '';
    const centre = inv.data?.centre || '';
    const placeOfService = inv.data?.placeOfService || '';
    const businessTerritory = inv.data?.businessTerritory || '';
    const invoiceDate = inv.data?.invoiceDate || inv.invoiceDate || '';
    const createdAt = inv.createdAt || '';
    
    const matchesSearch = (
      clientName.toLowerCase().includes(search.toLowerCase()) ||
      displayInvoiceNo.toLowerCase().includes(search.toLowerCase()) ||
      centre.toLowerCase().includes(search.toLowerCase()) ||
      placeOfService.toLowerCase().includes(search.toLowerCase()) ||
      businessTerritory.toLowerCase().includes(search.toLowerCase())
    );
    
    if (!matchesSearch) return false;
    
    if (filter === 'Show All') {
      return true;
    }
    
    const invoiceDateObj = parseDate(invoiceDate) || parseDate(createdAt);
    
    if (!invoiceDateObj) {
      return filter === 'Show All';
    }
    
    let matchesFilter = false;
    switch (filter) {
      case 'Daily':
        matchesFilter = isToday(invoiceDateObj);
        break;
      case 'Weekly':
        matchesFilter = isThisWeek(invoiceDateObj);
        break;
      case 'Monthly':
        matchesFilter = isThisMonth(invoiceDateObj);
        break;
      default:
        matchesFilter = true;
    }
    
    return matchesFilter;
  });

  // Function to find Excel invoice number - ONLY use "In_no" field
  const findExcelInvoiceNumber = (inv: any) => {
    const data = inv.data || {};
    
    // ONLY use the Excel "In_no" field, nothing else
    if (data["In_no"] && typeof data["In_no"] === 'string' && data["In_no"].trim()) {
      const excelInvoiceNo = data["In_no"].trim();
      console.log('Found Excel "In_no":', excelInvoiceNo);
      return excelInvoiceNo;
    }
    
    // If "In_no" is not found, return placeholder
    console.warn('Excel "In_no" field not found for invoice:', inv._id);
    console.log('Available fields:', Object.keys(data));
    return 'No "In_no" Found';
  };

  const displayInvoiceNo = (inv: any) => {
    // Use the findExcelInvoiceNumber function
    const excelInvoiceNo = findExcelInvoiceNumber(inv);
    
    // Debug logging
    console.log('Dashboard - Invoice data:', inv);
    console.log('Dashboard - Available fields:', Object.keys(inv.data || {}));
    console.log('Dashboard - Found Excel invoice number:', excelInvoiceNo);
    
    return excelInvoiceNo;
  };

  // Save handler for EditPreview
  const handleSaveEdit = async (updated: any) => {
    if (!editInvoice?._id) return;
    try {
      // Ensure we're saving the invoice data structure correctly
      const invoiceData = updated?.data || updated;
      const res = await fetch(`/api/proxy?path=invoices/${editInvoice._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: invoiceData }),
      });
      if (res.ok) {
        setInvoices(prev => prev.map(inv => inv._id === editInvoice._id ? { ...inv, data: invoiceData } : inv));
        setShowEdit(false);
        setEditInvoice(null);
        alert('Invoice updated successfully!');
      } else {
        alert('Error updating invoice. Please try again.');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error updating invoice. Please try again.');
    }
  };

  // Delete handler
  const handleDelete = async (inv: any) => {
    if (!inv?._id) return;
    try {
      const res = await fetch(`/api/proxy?path=invoices/${inv._id}`, { method: 'DELETE' });
      if (res.ok) setInvoices(prev => prev.filter(i => i._id !== inv._id));
    } catch {}
  };

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown')) {
        setShowFilter(false);
      }
      if (!target.closest('.preview-modal')) {
        setShowPreview(false);
        setSelectedInvoice(null);
      }
    };

    if (showFilter || showPreview) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
    }, [showFilter, showPreview]);

  // Helper to wait for all images in a container to load
  function waitForImagesToLoad(container: HTMLElement) {
    const images = Array.from(container.querySelectorAll('img'));
    return Promise.all(images.map(img => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise(res => {
        img.onload = img.onerror = res;
      });
    }));
  }

  // PDF Export using html2canvas for pixel-perfect match - Exact copy from InvoicePreview
  const handleDownloadPDF = async (inv: any) => {
    try {
      const invoiceData = getInvoiceData(inv);
      const exactInvoiceNo = (invoiceData as any)?.["In_no"] || '';
      const filename = exactInvoiceNo === '-' ? `Invoice_${Date.now()}.pdf` : `Invoice_${exactInvoiceNo}.pdf`;
      
      const { data } = await generateStandardizedPDF(
        <InvoicePreview data={{ ...invoiceData, invoiceNo: exactInvoiceNo }} showDownloadButton={false} isPdfExport={true} />,
        filename
      );
      
      // Create blob and download
      const blob = new Blob([data.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-orange-50 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-8 py-0 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 shadow-md border-b" style={{ height: 72 }}>
        <div className="flex items-center h-full">
        </div>
        <div className="flex items-center gap-4">
          {onLogout && (
            <button
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-7 py-2 rounded-lg transition shadow-lg border border-orange-200 text-lg"
              onClick={onLogout}
              type="button"
            >
              Log Out
            </button>
          )}
        </div>
      </div>

      {/* Main Content - Flex-1 to push footer down */}
      <div className="flex-1 flex flex-col">
        <div className="w-full max-w-[1600px] mx-auto px-2 py-10 pb-20 flex-1 flex flex-col">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900 mb-1 tracking-tight">Hello User</h1>
              <p className="text-gray-500 text-lg">View and manage your invoices below.</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/create-invoice">
                <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-7 py-3 rounded-lg transition shadow-lg border border-orange-200 text-lg">
                  Create Invoice
                </button>
              </Link>
              <Link href="/reports">
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-7 py-3 rounded-lg transition shadow-lg border border-blue-200 text-lg">
                  Reports
                </button>
              </Link>
            </div>
          </div>

          {/* Search Bar + Filter Button */}
          <div className="mb-6 flex items-center gap-4">
            <input
              type="text"
              placeholder="Search invoices"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-5 py-3 rounded-xl border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-lg bg-white shadow-sm placeholder-gray-400 text-gray-800 font-medium"
            />
            <div className="relative filter-dropdown">
              <button
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-3 rounded-xl shadow transition text-base"
                onClick={() => setShowFilter(v => !v)}
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0013 13.414V19a1 1 0 01-1.447.894l-2-1A1 1 0 019 18v-4.586a1 1 0 00-.293-.707L2.293 6.707A1 1 0 012 6V4z" /></svg>
                {filter}
              </button>
              {showFilter && (
                <div className="absolute right-0 mt-2 w-36 bg-white border border-orange-200 rounded-lg shadow-lg z-50">
                  {['Show All', 'Daily', 'Weekly', 'Monthly'].map(option => (
                    <button
                      key={option}
                      className={`block w-full text-left px-4 py-2 text-gray-700 hover:bg-orange-50 ${filter === option ? 'font-bold text-orange-600' : ''}`}
                      onClick={() => { setFilter(option); setShowFilter(false); }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Backend Error Message */}
          {backendError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-red-700 font-medium">{backendError}</span>
              </div>
              <p className="text-red-600 text-sm mt-1">
                You can still create new invoices using the "Create Invoice" button above.
              </p>
            </div>
          )}

          {/* Filter Status */}
          {(search || filter !== 'Show All') && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
              <span>Showing {filteredInvoices.length}</span>
              {search && <span>• Search: "{search}"</span>}
              {filter !== 'Show All' && <span>• Filter: {filter}</span>}
              <button
                onClick={() => { setSearch(''); setFilter('Show All'); }}
                className="text-orange-600 hover:text-orange-700 underline"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Table with vertical scrollbar, full width, sticky header */}
          <div className="bg-white rounded-2xl shadow-2xl border border-orange-100 w-full overflow-hidden flex-1 flex flex-col">
            <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              <table className="w-full text-left text-lg whitespace-nowrap table-fixed" style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead className="bg-orange-50 sticky top-0 z-10">
                  <tr className="border-b-2 border-orange-200">
                    <th className="px-2 py-4 text-gray-700 font-semibold">SR.</th>
                    <th className="px-2 py-4 text-gray-700 font-semibold">Invoice No.</th>
                    <th className="px-2 py-4 text-gray-700 font-semibold">Client Name</th>
                    <th className="px-2 py-4 text-gray-700 font-semibold">Invoice Date</th>
                    <th className="px-2 py-4 text-gray-700 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-100">
                  {filteredInvoices.map((inv, idx) => {
                    if (!inv) return null;
                    return (
                      <tr key={inv._id || idx} className="border-b border-orange-100 hover:bg-orange-50 transition-colors">
                        <td className="px-2 py-4 text-gray-700 font-semibold">{idx + 1}</td>
                        <td className="px-2 py-4 text-gray-700 font-semibold">{displayInvoiceNo(inv)}</td>
                        <td className="px-2 py-4 text-gray-700 font-semibold truncate" title={inv.data?.mrRaRa || inv.mrRaRa || inv.data?.clientName || inv.clientName || ''}>
                          {inv.data?.mrRaRa || inv.mrRaRa || inv.data?.clientName || inv.clientName || '-'}
                        </td>
                        <td className="px-2 py-4 text-gray-600 font-semibold">{inv.data?.invoiceDate || inv.invoiceDate || '-'}</td>
                        <td className="px-2 py-4">
                          <div className="relative actions-dropdown">
                            <button
                              className="text-gray-700 hover:text-orange-600 transition p-1"
                              onClick={() => setSelectedInvoice(inv)}
                              title="Actions"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                              </svg>
                            </button>
                            {selectedInvoice?._id === inv._id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white border border-orange-200 rounded-lg shadow-lg z-50">
                                <button
                                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-orange-50 flex items-center gap-2"
                                  onClick={() => { 
                                    setSelectedInvoice(inv); 
                                    setShowPreview(true); 
                                  }}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View
                                </button>
                                <button
                                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-orange-50 flex items-center gap-2"
                                  onClick={() => { setEditInvoice(inv); setShowEdit(true); }}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                                                </button>
                                <button
                                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-orange-50 flex items-center gap-2"
                                  onClick={() => handleDownloadPDF(inv)}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Download PDF
                                </button>
 
                                <button
                                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  onClick={() => handleDelete(inv)}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Fixed position over table */}
      {/* Commented out - Powered by Highflyers Infotech footer */}
      {/* <footer className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-600 text-white py-4 text-center shadow-md z-40">
        <div className="text-center text-white text-sm py-2">
          Powered by{' '}
          <a 
            href="https://highflyersinfotech.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white hover:text-orange-100 underline font-medium"
          >
            Highflyers Infotech
          </a>
        </div>
      </footer> */}

      {/* Invoice Preview Modal */}
      {showPreview && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 preview-modal">
          <div className="bg-white rounded-xl shadow-2xl min-w-[1300px] w-[90vw] max-h-[90vh] flex flex-col relative overflow-hidden">
            <button
              className="absolute top-3 right-3 text-gray-600 hover:text-orange-600 text-2xl font-bold z-10"
              onClick={() => {
                setShowPreview(false);
                setSelectedInvoice(null);
              }}
              aria-label="Close"
            >
              &times;
            </button>
            <div className="overflow-y-auto p-6 flex justify-center" style={{ maxHeight: '80vh', overflowX: 'hidden' }}>
              <InvoicePreview data={memoizedInvoiceData} showDownloadButton={false} />
            </div>
          </div>
        </div>
      )}

      {/* Invoice Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl min-w-[1300px] w-[90vw] max-h-[90vh] flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-4 pb-2">
              <button
                className="text-gray-600 hover:text-orange-600 text-2xl font-bold z-10"
                onClick={() => { setShowEdit(false); setEditInvoice(null); }}
                aria-label="Close"
              >
                &times;
              </button>
              <button
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-2 rounded-lg transition shadow-md text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
                onClick={() => handleSaveEdit(editInvoice)}
              >
                Save
              </button>
            </div>
            <div className="overflow-y-auto p-6 flex justify-center" style={{ maxHeight: '70vh', overflowX: 'hidden' }}>
              <EditPreview 
                data={editInvoice?.data || editInvoice || {}} 
                onChange={(updatedData) => {
                  // Update the editInvoice state with the new data
                  setEditInvoice((prev: any) => ({
                    ...prev,
                    data: updatedData
                  }));
                }} 
                showDownloadButton={false} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;