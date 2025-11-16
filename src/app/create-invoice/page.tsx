"use client";
import React, { useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import Link from 'next/link';
import { DISPLAY_NAMES } from '../../components/InvoicePreview';
import { generateStandardizedPDF } from '../../utils/pdfGenerator';
import InvoicePreview from '../../components/InvoicePreview';
import { parseMarathiNumber, numberToMarathi, formatMarathiCurrency, englishToMarathi } from '../../utils/marathiDigits';

// EditableSpan component - completely uncontrolled, only updates state on blur
const EditableSpan = React.memo(({ 
  field, 
  initialValue, 
  onChange, 
  style = {}, 
  placeholder = "" 
}: { 
  field: string;
  initialValue: string;
  onChange: (field: string, value: string) => void;
  style?: any;
  placeholder?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitializedRef = useRef(false);
  
  // Initialize value only once on mount
  useLayoutEffect(() => {
    if (inputRef.current && !isInitializedRef.current) {
      inputRef.current.value = initialValue || "";
      isInitializedRef.current = true;
    }
  }, []);
  
  // Only sync value when component is not focused and value changed externally
  // This prevents interference while user is typing
  useLayoutEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      const currentValue = inputRef.current.value;
      if (initialValue !== currentValue) {
        inputRef.current.value = initialValue || "";
      }
    }
  }, [initialValue]);
  
  // Don't update state during typing - only on blur
  const handleBlur = () => {
    if (inputRef.current) {
      let finalValue = inputRef.current.value;
      // For numeric fields, convert Marathi to English for storage but keep original for display
      // Check if field is a numeric field (rs, paise, price, piece, item, etc.)
      if (field.includes('_rs') || field.includes('_paise') || field.includes('_price') || 
          field.includes('_piece') || field.includes('_item')) {
        // Store in English digits for calculations, but display in Marathi
        const englishValue = parseMarathiNumber(finalValue).toString();
        // If user entered Marathi, convert to English for storage
        if (finalValue && /[०-९]/.test(finalValue)) {
          finalValue = englishValue;
        }
      }
      onChange(field, finalValue);
    }
  };
  
  return (
    <input
      ref={inputRef}
      key={field}
      type="text"
      onBlur={handleBlur}
      placeholder={placeholder}
      style={{
        ...style,
        border: 'none',
        borderBottom: '1px solid #1f4fb9',
        background: 'transparent',
        outline: 'none',
        textAlign: 'center',
        fontSize: '12px',
        padding: '0',
        width: style.width || '100%',
        minHeight: '16px',
      }}
      className="editable-field"
    />
  );
}, (prevProps, nextProps) => {
  // Never re-render based on value changes - only field/style
  return prevProps.field === nextProps.field &&
         JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style);
});

EditableSpan.displayName = 'EditableSpan';

function CreateInvoiceDirectPage() {
  const [invoiceData, setInvoiceData] = useState<any>({
    "In_no": "",
    invoiceDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
    mrRaRa: "",
    place: "",
    to: "",
    chequeDraftNo: "",
    received: "",
    deposit: "",
    raRaNo: "",
    table: [],
    totalSalesRs: "",
    totalSalesPaise: "",
    expensesRs: "",
    expensesPaise: "",
    netBalanceRs: "",
    netBalancePaise: "",
    grandTotalRs: "",
    grandTotalPaise: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleInputChange = useCallback((field: string, value: any) => {
    setInvoiceData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Calculate total expenses from right table
  const calculateTotalExpenses = () => {
    let totalPaise = 0;
    
    // Sum all expense rows (0-7)
    for (let i = 0; i < 8; i++) {
      const rs = parseMarathiNumber(invoiceData[`expense${i}_rs`] || '0');
      const paise = parseMarathiNumber(invoiceData[`expense${i}_paise`] || '0');
      totalPaise += (rs * 100) + paise;
    }
    
    // Sum all empty rows (0-4)
    for (let i = 0; i < 5; i++) {
      const rs = parseMarathiNumber(invoiceData[`empty${i}_rs`] || '0');
      const paise = parseMarathiNumber(invoiceData[`empty${i}_paise`] || '0');
      totalPaise += (rs * 100) + paise;
    }
    
    const totalRs = Math.floor(totalPaise / 100);
    const remainingPaise = totalPaise % 100;
    
    return { rs: totalRs, paise: remainingPaise };
  };

  // Calculate row total (Piece or Crates × Per unit price)
  const calculateRowTotal = (rowIndex: number) => {
    const piece = parseMarathiNumber(invoiceData[`row${rowIndex}_item`] || '0'); // Using _item field for Piece
    const crates = parseMarathiNumber(invoiceData[`row${rowIndex}_piece`] || '0'); // Using _piece field for Crates
    const perUnitPrice = parseMarathiNumber(invoiceData[`row${rowIndex}_price`] || '0');
    
    // Use Piece if available, otherwise use Crates
    const quantity = piece > 0 ? piece : crates;
    
    if (quantity === 0 || perUnitPrice === 0) {
      return { rs: null, paise: null };
    }
    
    // Calculate total in paise (per unit price is in rupees and paise format)
    // Assuming per unit price is entered as a decimal number (e.g., 10.50 = 10 rupees 50 paise)
    const totalPaise = Math.round(quantity * perUnitPrice * 100);
    const totalRs = Math.floor(totalPaise / 100);
    const remainingPaise = totalPaise % 100;
    
    return { rs: totalRs, paise: remainingPaise };
  };

  // Calculate total sales from all left table rows
  const calculateTotalSales = () => {
    let totalPaise = 0;
    
    for (let i = 0; i < 13; i++) {
      const rowTotal = calculateRowTotal(i);
      if (rowTotal.rs !== null && rowTotal.paise !== null) {
        totalPaise += (rowTotal.rs * 100) + rowTotal.paise;
      }
    }
    
    if (totalPaise === 0) {
      return { rs: null, paise: null };
    }
    
    const totalRs = Math.floor(totalPaise / 100);
    const remainingPaise = totalPaise % 100;
    
    return { rs: totalRs, paise: remainingPaise };
  };

  // Calculate net balance (Total Sales - Total Expenses)
  const calculateNetBalance = () => {
    const totalSales = calculateTotalSales();
    const totalExpenses = calculateTotalExpenses();
    
    if (totalSales.rs === null || totalSales.paise === null) {
      return { rs: null, paise: null, isNegative: false };
    }
    
    const salesPaise = (totalSales.rs * 100) + totalSales.paise;
    const expensesPaise = (totalExpenses.rs * 100) + totalExpenses.paise;
    
    const netPaise = salesPaise - expensesPaise;
    const netRs = Math.floor(Math.abs(netPaise) / 100);
    const netRemainingPaise = Math.abs(netPaise) % 100;
    
    return { rs: netRs, paise: netRemainingPaise, isNegative: netPaise < 0 };
  };

  const formatAmount = (rs: number | null, paise: number | null, isNegative = false) => {
    if (rs === null || paise === null) return '';
    const totalPaise = (rs * 100) + paise;
    let amount = totalPaise / 100;
    if (isNegative) {
      amount = -Math.abs(amount);
    }
    if (amount === 0) return '';
    // Format with Marathi digits
    const formatted = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return englishToMarathi(formatted);
  };

  // Prepare data for InvoicePreview component (format data properly)
  const prepareInvoiceDataForPreview = () => {
    // Build table data from left table rows
    const tableData: any[] = [];
    for (let i = 0; i < 13; i++) {
      const rowTotal = calculateRowTotal(i);
      if (rowTotal.rs !== null && rowTotal.paise !== null) {
        tableData.push({
          details: invoiceData[`row${i}_details`] || '',
          piece: invoiceData[`row${i}_item`] || '',
          crates: invoiceData[`row${i}_piece`] || '',
          price: invoiceData[`row${i}_price`] || '',
          amount: formatAmount(rowTotal.rs, rowTotal.paise),
        });
      }
    }

    // Build expenses data from right table
    const expensesData: any[] = [];
    for (let i = 0; i < 8; i++) {
      const rs = invoiceData[`expense${i}_rs`] || '';
      const paise = invoiceData[`expense${i}_paise`] || '';
      if (rs || paise) {
        expensesData.push({
          name: ['Commission', 'Porterage', 'Car rental', 'Bundle expenses', 'Hundekari expenses', 'Space rent', 'Warai', 'Other expenses'][i],
          rs: rs,
          paise: paise,
        });
      }
    }

    // Calculate totals
    const totalSales = calculateTotalSales();
    const totalExpenses = calculateTotalExpenses();
    const netBalance = calculateNetBalance();

    return {
      ...invoiceData,
      "In_no": invoiceData["In_no"] || '',
      invoiceDate: invoiceData.invoiceDate || '',
      table: tableData,
      goodsTable: tableData,
      totalSalesFormatted: formatAmount(totalSales.rs, totalSales.paise),
      totalExpensesFormatted: formatAmount(totalExpenses.rs, totalExpenses.paise),
      netBalanceFormatted: formatAmount(netBalance.rs, netBalance.paise, netBalance.isNegative),
    };
  };

  const handleDownloadPDF = async () => {
    if (!previewRef.current) {
      alert('Invoice preview not found. Please try again.');
      return;
    }

    try {
      const invoiceNo = invoiceData["In_no"] || invoiceData.invoiceNo || '';
      const filename = invoiceNo ? `Invoice_${invoiceNo}.pdf` : `Invoice_${Date.now()}.pdf`;
      
      // Import html2canvas and jsPDF dynamically
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      // Wait for images to load
      const images = Array.from(previewRef.current.querySelectorAll('img'));
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve, reject) => {
              if (img.complete) {
                resolve();
                return;
              }
              const timeout = setTimeout(() => reject(new Error('Image load timeout')), 10000);
              img.onload = () => {
                clearTimeout(timeout);
                resolve();
              };
              img.onerror = () => {
                clearTimeout(timeout);
                resolve(); // Continue even if image fails
              };
            })
        )
      );

      // Apply upward shift only to text labels (not tables/containers) and hide green underlines
      const textLabels = previewRef.current.querySelectorAll('span:not(td span, th span), p:not(td p, th p)');
      const inputElements = previewRef.current.querySelectorAll('input.editable-field');
      const tableCells = previewRef.current.querySelectorAll('td, th, .grid > div');
      const originalStyles: Array<{ element: HTMLElement; transform: string; position: string; borderBottom: string; overflow: string; whiteSpace: string; minHeight: string; display: string; visibility: string; zIndex: string; marginTop?: string; top?: string; paddingTop?: string }> = [];
      const inputReplacements: Array<{ input: HTMLInputElement; span: HTMLSpanElement }> = [];
      
      // Convert input fields to visible text spans so their values are captured in PDF
      inputElements.forEach((el) => {
        const htmlEl = el as HTMLInputElement;
        const inputValue = htmlEl.value || '';
        // Check if input is in a container with data-field attribute or nearby cheque/received text
        const parentContainer = htmlEl.closest('[data-field]') || htmlEl.parentElement;
        const fieldName = parentContainer?.getAttribute('data-field') || '';
        const nearbyText = parentContainer?.textContent || '';
        const isChequeField = fieldName.includes('chequeDraftNo') || fieldName.includes('received') || 
                             nearbyText.includes('Cheque/Draft No') || nearbyText.includes('Received');
        
        // Create a span element to replace the input
        const textSpan = document.createElement('span');
        textSpan.textContent = inputValue;
        textSpan.style.cssText = `
          display: inline-block;
          width: ${htmlEl.style.width || '100%'};
          min-height: ${htmlEl.style.minHeight || '16px'};
          font-size: ${htmlEl.style.fontSize || '12px'};
          text-align: ${htmlEl.style.textAlign || 'center'};
          color: #000;
          padding: 0;
          border: none;
          background: transparent;
          overflow: visible;
          white-space: normal;
          word-wrap: break-word;
          z-index: 1;
          position: relative;
          transform: ${isChequeField ? 'none' : 'translateY(0)'};
        `;
        
        // Store original input styles
        originalStyles.push({
          element: htmlEl,
          transform: '',
          position: '',
          borderBottom: htmlEl.style.borderBottom || '',
          overflow: htmlEl.style.overflow || '',
          whiteSpace: htmlEl.style.whiteSpace || '',
          minHeight: htmlEl.style.minHeight || '',
          display: htmlEl.style.display || '',
          visibility: htmlEl.style.visibility || '',
          zIndex: htmlEl.style.zIndex || ''
        });
        
        // Hide the input and show the span
        htmlEl.style.display = 'none';
        htmlEl.style.visibility = 'hidden';
        htmlEl.parentNode?.insertBefore(textSpan, htmlEl);
        
        inputReplacements.push({ input: htmlEl, span: textSpan });
      });
      
      // Fix text truncation in table cells - ensure full text is visible
      tableCells.forEach((el) => {
        const htmlEl = el as HTMLElement;
        originalStyles.push({
          element: htmlEl,
          transform: '',
          position: '',
          borderBottom: '',
          overflow: htmlEl.style.overflow || '',
          whiteSpace: htmlEl.style.whiteSpace || '',
          minHeight: htmlEl.style.minHeight || '',
          display: '',
          visibility: '',
          zIndex: ''
        });
        // Ensure text is fully visible - no clipping
        htmlEl.style.overflow = 'visible';
        htmlEl.style.whiteSpace = 'normal';
        // Increase min height to accommodate full text
        const currentMinHeight = parseInt(htmlEl.style.minHeight || '22px');
        if (currentMinHeight < 30) {
          htmlEl.style.minHeight = 'auto';
        }
      });
      
      // Shift only text labels (outside of tables) upward, but exclude cheque text
      textLabels.forEach((el) => {
        const htmlEl = el as HTMLElement;
        // Only shift if it's not inside a table and contains text
        // Exclude cheque text to prevent shifting
        const textContent = htmlEl.textContent || '';
        const isChequeText = textContent.includes('Cheque/Draft No') || textContent.includes('Received');
        
        if (htmlEl.textContent && htmlEl.textContent.trim() && !htmlEl.closest('table') && !htmlEl.closest('.grid') && !isChequeText) {
          originalStyles.push({
            element: htmlEl,
            transform: htmlEl.style.transform || '',
            position: htmlEl.style.position || '',
            borderBottom: '',
            overflow: '',
            whiteSpace: '',
            minHeight: '',
            display: '',
            visibility: '',
            zIndex: ''
          });
          htmlEl.style.position = 'relative';
          htmlEl.style.transform = 'translateY(-3px)';
        }
      });
      
      // Ensure cheque text line stays properly aligned - no shift
      const chequeLineContainer = previewRef.current.querySelector('[style*="display: flex"][style*="alignItems"]');
      if (chequeLineContainer) {
        const htmlEl = chequeLineContainer as HTMLElement;
        originalStyles.push({
          element: htmlEl,
          transform: htmlEl.style.transform || '',
          position: htmlEl.style.position || '',
          borderBottom: '',
          overflow: '',
          whiteSpace: '',
          minHeight: '',
          display: '',
          visibility: '',
          zIndex: ''
        });
        // Ensure this container stays aligned
        htmlEl.style.position = 'relative';
        htmlEl.style.transform = 'none';
      }

      // Apply upward shift BEFORE html2canvas - use multiple methods for reliability
      const mainContentBox = previewRef.current.querySelector('div[style*="paddingTop"][style*="0.5rem"], div[style*="padding"][style*="1rem"][style*="fontSize"][style*="12px"]');
      if (mainContentBox instanceof HTMLElement) {
        // Store original styles for restoration
        const originalPaddingTop = mainContentBox.style.paddingTop || '';
        const originalMarginTop = mainContentBox.style.marginTop || '';
        const originalPosition = mainContentBox.style.position || '';
        originalStyles.push({
          element: mainContentBox,
          transform: '',
          position: originalPosition,
          borderBottom: '',
          overflow: '',
          whiteSpace: '',
          minHeight: '',
          display: '',
          visibility: '',
          zIndex: '',
          marginTop: originalMarginTop,
          paddingTop: originalPaddingTop
        } as any);
        
        // Method 1: Reduce padding-top
        if (originalPaddingTop.includes('0.5rem')) {
          mainContentBox.style.paddingTop = '0';
        } else if (originalPaddingTop.includes('1rem')) {
          mainContentBox.style.paddingTop = '0.25rem';
        }
        
        // Method 2: Apply negative margin and top
        mainContentBox.style.marginTop = '-60px';
        mainContentBox.style.position = 'relative';
        mainContentBox.style.top = '-60px';
        
        // Method 3: Apply to all child elements
        const allChildren = mainContentBox.querySelectorAll('*');
        allChildren.forEach((child) => {
          if (child instanceof HTMLElement) {
            const childOriginalTop = child.style.top || '';
            const childOriginalPosition = child.style.position || '';
            originalStyles.push({
              element: child,
              transform: '',
              position: childOriginalPosition,
              borderBottom: '',
              overflow: '',
              whiteSpace: '',
              minHeight: '',
              display: '',
              visibility: '',
              zIndex: '',
              marginTop: '',
              top: childOriginalTop
            } as any);
            child.style.position = 'relative';
            child.style.top = '-60px';
          }
        });
        
        // Method 4: Specifically target headers
        const headers = previewRef.current.querySelectorAll('div[style*="#035f87"]');
        headers.forEach((header) => {
          if (header instanceof HTMLElement) {
            const headerOriginalTop = header.style.top || '';
            const headerOriginalPosition = header.style.position || '';
            const headerOriginalMarginTop = header.style.marginTop || '';
            originalStyles.push({
              element: header,
              transform: '',
              position: headerOriginalPosition,
              borderBottom: '',
              overflow: '',
              whiteSpace: '',
              minHeight: '',
              display: '',
              visibility: '',
              zIndex: '',
              marginTop: headerOriginalMarginTop,
              top: headerOriginalTop
            } as any);
            header.style.position = 'relative';
            header.style.top = '-60px';
            header.style.marginTop = '-60px';
          }
        });
        
        // Method 5: Apply to grand total box elements
        const grandTotalElements = previewRef.current.querySelectorAll('[data-pdf-shift="true"]');
        grandTotalElements.forEach((element) => {
          if (element instanceof HTMLElement) {
            const elementOriginalTop = element.style.top || '';
            const elementOriginalPosition = element.style.position || '';
            const elementOriginalMarginTop = element.style.marginTop || '';
            originalStyles.push({
              element: element,
              transform: '',
              position: elementOriginalPosition,
              borderBottom: '',
              overflow: '',
              whiteSpace: '',
              minHeight: '',
              display: '',
              visibility: '',
              zIndex: '',
              marginTop: elementOriginalMarginTop,
              top: elementOriginalTop
            } as any);
            element.style.position = 'relative';
            element.style.top = '-60px';
            element.style.marginTop = '-60px';
          }
        });
      }

      // Generate canvas from the editable invoice preview
      const canvas = await html2canvas(previewRef.current, {
        scale: 2.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: previewRef.current.scrollWidth,
        height: previewRef.current.scrollHeight,
      });

      // Restore original styles and remove text span replacements
      inputReplacements.forEach(({ input, span }) => {
        // Restore input visibility
        input.style.display = '';
        input.style.visibility = '';
        // Remove the text span
        span.remove();
      });
      
      originalStyles.forEach(({ element, transform, position, borderBottom, overflow, whiteSpace, minHeight, display, visibility, zIndex, marginTop, top, paddingTop }) => {
        if (transform || position) {
          element.style.transform = transform;
          element.style.position = position;
        }
        if (marginTop !== undefined) {
          element.style.marginTop = marginTop;
        }
        if (top !== undefined) {
          element.style.top = top;
        }
        if (paddingTop !== undefined) {
          element.style.paddingTop = paddingTop;
        }
        if (borderBottom !== undefined && element instanceof HTMLInputElement) {
          element.style.borderBottom = borderBottom;
        }
        if (overflow !== undefined) {
          element.style.overflow = overflow;
        }
        if (whiteSpace !== undefined) {
          element.style.whiteSpace = whiteSpace;
        }
        if (minHeight !== undefined) {
          element.style.minHeight = minHeight;
        }
        if (display !== undefined && element instanceof HTMLInputElement) {
          element.style.display = display;
        }
        if (visibility !== undefined && element instanceof HTMLInputElement) {
          element.style.visibility = visibility;
        }
        if (zIndex !== undefined) {
          element.style.zIndex = zIndex;
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Create PDF with A4 format
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Calculate dimensions with margins
      const margin = 40;
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);
      
      // Calculate scaling to fit content properly
      const widthRatio = availableWidth / canvasWidth;
      const heightRatio = availableHeight / canvasHeight;
      const scaleRatio = Math.min(widthRatio, heightRatio);
      
      const finalWidth = canvasWidth * scaleRatio;
      const finalHeight = canvasHeight * scaleRatio;
      
      // Center the content with upward adjustment
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2 - 5; // Additional upward shift in PDF
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
      
      // Generate PDF blob and download
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Save to backend after download
      await saveInvoice();
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const saveInvoice = async () => {
    // If no invoice number, skip saving but still allow PDF download
    if (!invoiceData["In_no"] && !invoiceData.invoiceNo) {
      console.log('No invoice number provided, skipping save to database');
      return;
    }

    setIsSaving(true);
    try {
      const invoiceNo = invoiceData["In_no"] || invoiceData.invoiceNo;

      // Calculate and attach all summary fields before saving
      const totalSales = calculateTotalSales();
      const totalExpenses = calculateTotalExpenses();
      const netBalance = calculateNetBalance();

      const totalSalesValue =
        totalSales.rs === null || totalSales.paise === null
          ? ''
          : ((totalSales.rs * 100 + totalSales.paise) / 100).toFixed(2);

      const totalExpensesValue =
        totalExpenses.rs === null || totalExpenses.paise === null
          ? ''
          : ((totalExpenses.rs * 100 + totalExpenses.paise) / 100).toFixed(2);

      const netBalanceValue =
        netBalance.rs === null || netBalance.paise === null
          ? ''
          : ((netBalance.rs * 100 + netBalance.paise) / 100).toFixed(2);

      // Per-row amounts (left table) to store in database so View uses same values
      const rowAmounts: Record<string, string> = {};
      for (let i = 0; i < 13; i++) {
        const rowTotal = calculateRowTotal(i);
        if (rowTotal.rs !== null && rowTotal.paise !== null) {
          const value = ((rowTotal.rs * 100 + rowTotal.paise) / 100).toFixed(2);
          rowAmounts[`row${i}_amount`] = value;
        }
      }

      const enrichedInvoiceData = {
        ...invoiceData,
        ...rowAmounts,
        // Total sales (left table)
        totalSalesRs: totalSales.rs ?? '',
        totalSalesPaise: totalSales.paise ?? '',
        // Total expenses (right table + extra rows)
        expensesRs: totalExpenses.rs ?? '',
        expensesPaise: totalExpenses.paise ?? '',
        // Net balance
        netBalanceRs: netBalance.rs ?? '',
        netBalancePaise: netBalance.paise ?? '',
        // Grand total (for reports use)
        grandTotalRs: netBalance.rs ?? '',
        grandTotalPaise: netBalance.paise ?? '',
        // Helper numeric fields used by reports
        totalCollection: totalSalesValue,
        expensesTotal: totalExpensesValue,
        netAmount: netBalanceValue,
        grandTotal: netBalanceValue,
      };

      const checkResponse = await fetch('/api/proxy?endpoint=/api/invoices');
      const allInvoices = await checkResponse.json();
      
      const duplicate = allInvoices.find((inv: any) => {
        const existingNo = inv.data?.["In_no"] || inv.data?.invoiceNo;
        return existingNo === invoiceNo;
      });

      if (duplicate) {
        const confirmSave = confirm(`Invoice number ${invoiceNo} already exists. Do you want to update it?`);
        if (!confirmSave) {
          setIsSaving(false);
          return;
        }
      }

      const formData = new FormData();
      formData.append('invoiceData', JSON.stringify([enrichedInvoiceData]));

      const response = await fetch('/api/proxy', {
        method: 'POST',
        body: formData,
        headers: {
          'endpoint': '/api/invoice-upload'
        }
      });

      if (response.ok) {
        alert('Invoice saved successfully!');
      } else {
        const error = await response.text();
        alert(`Error saving invoice: ${error}`);
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error saving invoice. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // EditableSpan wrapper - stable component that doesn't re-render on value changes
  const EditableSpanWrapper = React.memo(({ field, style = {}, placeholder = "" }: { field: string, style?: any, placeholder?: string }) => {
    // Get current value from state
    const currentValue = invoiceData[field] || "";
    
    return (
      <EditableSpan
        field={field}
        initialValue={currentValue}
        onChange={handleInputChange}
        style={style}
        placeholder={placeholder}
      />
    );
  }, (prevProps, nextProps) => {
    // Only re-render if field or style changes - ignore all value changes
    return prevProps.field === nextProps.field &&
           JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style);
  });
  
  EditableSpanWrapper.displayName = 'EditableSpanWrapper';

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with back to Dashboard and Create via Excel button */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="p-2 bg-white hover:bg-orange-100 text-orange-600 rounded-lg transition shadow border border-orange-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">Create Invoice - Direct Entry</h1>
          </div>
          <Link href="/create-invoice-excel">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg transition shadow-lg">
              Create via Excel
            </button>
          </Link>
        </div>

        {/* Download Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleDownloadPDF}
            disabled={isSaving}
            className="px-6 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Download PDF & Save'}
          </button>
        </div>

        {/* Editable Invoice Preview - Also used for PDF generation */}
        <div
          ref={previewRef}
          className="w-[800px] mx-auto bg-white shadow-lg text-black"
          style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#fff', width: '800px', minHeight: '1130px', boxSizing: 'border-box', padding: 0 }}
          id="invoice-preview-container"
        >
          {/* Header - Single Image aligned with inner content width */}
          <div style={{ width: '100%', margin: 0, padding: '1rem 1rem 0 1rem', boxSizing: 'border-box' }}>
            <img
              src="/inovice_formatting/baban.jpg" 
              alt="Invoice Header" 
              style={{ width: '100%', height: 'auto', display: 'block', margin: 0, padding: 0 }} 
            />
          </div>

          {/* Main Content Box - Editable */}
          <div style={{ width: '100%', padding: '1rem', paddingTop: '0.5rem', fontSize: '12px' }}>
            {/* Top Header Section */}
            <div style={{ border: '2px solid #1f4fb9', padding: '8px', marginBottom: '0.25rem', backgroundColor: '#f2eed3' }}>
              {/* Top Line - Invoice No (left) and Date (right) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ display: 'inline-block' }}>
                  <span style={{ color: '#1670b5' }}>{DISPLAY_NAMES['In_no']}:</span> <EditableSpanWrapper field="In_no" style={{ width: '120px', display: 'inline-block' }} />
                </span>
                <span style={{ display: 'inline-block' }}>
                  <span style={{ color: '#1670b5' }}>{DISPLAY_NAMES.date}:</span> <EditableSpanWrapper field="invoiceDate" style={{ width: '100px', display: 'inline-block' }} />
                </span>
              </div>
              
              {/* Recipient/Sender Details Section */}
              <div style={{ marginBottom: '8px', lineHeight: '1.6' }}>
                {/* First Line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', width: '100%' }}>
                  <span style={{ whiteSpace: 'nowrap', color: '#1670b5' }}>{DISPLAY_NAMES.mrRaRa}</span>
                  <EditableSpanWrapper field="mrRaRa" style={{ flex: '1', minWidth: '200px' }} />
                  <span style={{ whiteSpace: 'nowrap', color: '#1670b5' }}>{DISPLAY_NAMES.place}</span>
                  <EditableSpanWrapper field="place" style={{ flex: '1', minWidth: '200px' }} />
                  <span style={{ whiteSpace: 'nowrap', color: '#1670b5' }}>{DISPLAY_NAMES.to}</span>
                </div>
                
                {/* Second Line */}
                <div style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', marginBottom: '8px', lineHeight: '1.6', width: '100%' }}>
                  <span style={{ whiteSpace: 'nowrap', color: '#1670b5' }}>{DISPLAY_NAMES.loveGreetings}</span>
                  <EditableSpanWrapper field="raRaNo" style={{ flex: 1, marginLeft: '8px', marginRight: '8px' }} />
                  <span style={{ whiteSpace: 'nowrap', color: '#1670b5' }}>{DISPLAY_NAMES.chequeDraftNo}</span>
                  <span data-field="chequeDraftNo">
                    <EditableSpanWrapper field="chequeDraftNo" style={{ width: '100px', marginLeft: '8px', marginRight: '8px' }} />
                  </span>
                  <span style={{ whiteSpace: 'nowrap', color: '#1670b5' }}>{DISPLAY_NAMES.received}</span>
                </div>
                
                {/* Remaining lines */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', lineHeight: '1.6' }}>
                  <div style={{ width: '60%' }}>
                    <div style={{ marginBottom: '4px', color: '#1670b5' }}>{DISPLAY_NAMES.salesDetails}</div>
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '8px', color: '#1670b5' }}>{DISPLAY_NAMES.deposit}:</span>
                      <EditableSpanWrapper field="deposit" style={{ flex: 1 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Section - Two Side-by-Side Tables */}
            <div className="w-full border-2 border-green-700 mb-1" style={{ borderColor: '#1f4fb9' }}>
              <div className="grid grid-cols-12">
                {/* Left Table - Item Details */}
                <div className="col-span-9 border-r-2" style={{ borderColor: '#1f4fb9' }}>
                  {/* Header Row */}
                  <div
                    className="grid border-b font-semibold text-center text-xs whitespace-nowrap"
                    style={{ borderColor: '#1f4fb9', gridTemplateColumns: '4fr 0.8fr 0.8fr 1.5fr 1.8fr', backgroundColor: '#035f87', color: '#ffffff' }}
                  >
                    <div className="border-r p-1" style={{ borderRightColor: '#d3d3d3', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.detailsOfGoods}</div>
                    <div className="border-r p-1" style={{ borderRightColor: '#d3d3d3', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.piece}</div>
                    <div className="border-r p-1" style={{ borderRightColor: '#d3d3d3', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.crates}</div>
                    <div className="border-r p-1" style={{ borderRightColor: '#d3d3d3', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.perUnitPrice}</div>
                    <div className="p-1" style={{ backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.rs}</div>
                  </div>
                  {/* Content Rows - Editable */}
                  {Array(13).fill(0).map((_, i) => {
                    const rowTotal = calculateRowTotal(i);
                    const formattedRowTotal = formatAmount(rowTotal.rs, rowTotal.paise);
                    const rowBgColor = i % 2 === 0 ? '#ffffff' : '#fafafa';
                    return (
                      <div
                        key={i}
                        className="grid border-b text-center"
                        style={{ borderColor: '#1f4fb9', gridTemplateColumns: '4fr 0.8fr 0.8fr 1.5fr 1.8fr', backgroundColor: rowBgColor }}
                      >
                        <div className="border-r p-1 text-left" style={{ borderColor: '#1f4fb9', minHeight: '22px', backgroundColor: '#f2eed3' }}>
                          <EditableSpanWrapper field={`row${i}_details`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                        <div className="border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '22px', backgroundColor: '#efdff0' }}>
                          <EditableSpanWrapper field={`row${i}_piece`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                        <div className="border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '22px', backgroundColor: '#f2eed3' }}>
                          <EditableSpanWrapper field={`row${i}_item`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                        <div className="border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '22px', backgroundColor: '#efdff0' }}>
                          <EditableSpanWrapper field={`row${i}_price`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                        <div className="p-1" style={{ borderColor: '#1f4fb9', minHeight: '22px', backgroundColor: '#f2eed3' }}>
                          <span style={{ fontSize: '12px', fontWeight: '500' }}>{formattedRowTotal}</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Left Table - Totals Section (Auto-calculated) */}
                  <div style={{ position: 'relative' }}>
                    {/* White Overlay for Column 1 */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '44.804%', // 4fr / (4 + 1.2 + 1.2 + 1.5 + 1)fr = 4/9.9 = 40.404% perfect is 44.804 
                        height: '100%',
                        backgroundColor: '#f2eed3',
                        zIndex: 10,
                        pointerEvents: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '8px'
                      }}
                    >
                      {/* Grand Total Box - Reduced Width */}
                      <div data-pdf-shift="true" style={{ width: '90%', maxWidth: '250px', position: 'relative', zIndex: 11 }}>
                        {/* Net Balance Title - Red, Bold - Increased Size */}
                        <div data-pdf-shift="true" style={{ fontSize: '16px', fontWeight: 'bold', color: '#dc2626', marginBottom: '6px', textAlign: 'center' }}>
                          {DISPLAY_NAMES.netBalance}
                        </div>
                        
                        {/* Grand Total Box with Red Circle and Amount */}
                        <div 
                          data-pdf-shift="true"
                          style={{ 
                            border: '1px solid #dc2626', 
                            borderRadius: '4px',
                            width: '100%',
                            height: '45px',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            padding: '6px 10px',
                            backgroundColor: '#fefefe',
                            position: 'relative',
                            gap: '10px'
                          }}
                        >
                          {/* Red Circle with Rupee Symbol */}
                          <div
                            data-pdf-shift="true"
                            style={{
                              width: '35px',
                              height: '35px',
                              borderRadius: '50%',
                              backgroundColor: '#dc2626',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              position: 'relative',
                              zIndex: 2
                            }}
                          >
                            <img 
                              src="/inovice_formatting/rupee_sym.png" 
                              alt="₹" 
                              style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                            />
                          </div>
                          
                          {/* Amount Display - Black text, centered, slightly overlapping circle */}
                          <div
                            data-pdf-shift="true"
                            style={{
                              fontSize: '16px',
                              fontWeight: 'bold',
                              color: '#000000',
                              marginLeft: '-6px',
                              flex: 1,
                              minHeight: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {formatAmount(calculateNetBalance().rs, calculateNetBalance().paise, calculateNetBalance().isNegative)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Total Sales Row */}
                    <div
                      className="grid border-t-2 border-b text-xs font-semibold"
                      style={{ borderColor: '#1f4fb9', backgroundColor: '#c1e4ff', gridTemplateColumns: '4fr 0.8fr 0.8fr 1.5fr 1.8fr', position: 'relative' }}
                    >
                      <div className="border-r p-2" style={{ borderColor: '#1f4fb9', borderBottomColor: '#c1e4ff', gridColumn: '1' }}></div>
                      <div className="border-r p-2 text-left font-semibold" style={{ borderColor: '#1f4fb9', gridColumn: '2 / 4' }}>{DISPLAY_NAMES.totalSales}</div>
                      <div className="p-2 text-right" style={{ borderColor: '#1f4fb9', gridColumn: '4 / 6' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'semibold' }}>{formatAmount(calculateTotalSales().rs, calculateTotalSales().paise)}</span>
                      </div>
                    </div>
                    {/* Expenses Row */}
                    <div
                      className="grid border-b text-xs font-semibold"
                      style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3', gridTemplateColumns: '4fr 0.8fr 0.8fr 1.5fr 1.8fr', position: 'relative' }}
                    >
                      <div className="border-r p-2" style={{ borderColor: '#1f4fb9', borderBottomColor: '#f2eed3', gridColumn: '1' }}></div>
                      <div className="border-r p-2 text-left font-semibold" style={{ borderColor: '#1f4fb9', gridColumn: '2 / 4' }}>{DISPLAY_NAMES.expenses}</div>
                      <div className="p-2 text-right" style={{ borderColor: '#1f4fb9', gridColumn: '4 / 6' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'semibold' }}>{formatAmount(calculateTotalExpenses().rs, calculateTotalExpenses().paise)}</span>
                      </div>
                    </div>
                    {/* Net Balance Row */}
                    <div
                      className="grid text-xs font-bold"
                      style={{ borderColor: '#1f4fb9', backgroundColor: '#efdff0', gridTemplateColumns: '4fr 0.8fr 0.8fr 1.5fr 1.8fr', position: 'relative' }}
                    >
                      <div className="border-r p-2" style={{ borderColor: '#1f4fb9', borderBottom: 'none', gridColumn: '1' }}></div>
                      <div className="border-r p-2 text-left font-bold" style={{ borderColor: '#1f4fb9', borderBottom: 'none', gridColumn: '2 / 4' }}>{DISPLAY_NAMES.netBalance}</div>
                      <div className="p-2 text-right" style={{ borderColor: '#1f4fb9', borderBottom: 'none', gridColumn: '4 / 6' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                          {formatAmount(calculateNetBalance().rs, calculateNetBalance().paise, calculateNetBalance().isNegative)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Table - Expenses */}
                <div className="col-span-3" style={{ backgroundColor: '#f2eed3' }}>
                  {/* Header Row - Using 5 columns: Details (3), Rs (1), Paise (1) */}
                  <div className="grid grid-cols-5 border-b font-semibold text-center text-xs whitespace-nowrap" style={{ borderColor: '#1f4fb9', backgroundColor: '#035f87', color: '#ffffff' }}>
                    <div className="col-span-3 border-r p-1" style={{ borderRightColor: '#d3d3d3', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.detailsOfExpenses}</div>
                    <div className="col-span-1 border-r p-1" style={{ borderRightColor: '#d3d3d3', backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.rs}</div>
                    <div className="col-span-1 p-1" style={{ backgroundColor: '#035f87', color: '#ffffff' }}>{DISPLAY_NAMES.paise}</div>
                  </div>
                  {/* Expense Rows */}
                  {[DISPLAY_NAMES.commission, DISPLAY_NAMES.porterage, DISPLAY_NAMES.carRental, DISPLAY_NAMES.bundleExpenses, DISPLAY_NAMES.hundekariExpenses, DISPLAY_NAMES.spaceRent, DISPLAY_NAMES.warai, DISPLAY_NAMES.otherExpenses].map((expense, idx) => {
                    return (
                      <div key={idx} className="grid grid-cols-5 border-b text-xs" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3' }}>
                        <div className="col-span-3 border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '22px', backgroundColor: '#c1e4ff', textAlign: 'center' }}>{expense}</div>
                        <div className="col-span-1 border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '22px', backgroundColor: '#f2eed3' }}>
                          <EditableSpanWrapper field={`expense${idx}_rs`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                        <div className="col-span-1 p-1" style={{ minHeight: '22px', backgroundColor: '#f2eed3' }}>
                          <EditableSpanWrapper field={`expense${idx}_paise`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                      </div>
                    );
                  })}
                  {/* Additional empty rows */}
                  {Array(5).fill(0).map((_, i) => {
                    return (
                      <div key={`empty-${i}`} className="grid grid-cols-5 border-b text-xs" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3' }}>
                        <div className="col-span-3 border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '22px', backgroundColor: '#c1e4ff', textAlign: 'center' }}>
                          <EditableSpanWrapper field={`empty${i}_details`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                        <div className="col-span-1 border-r p-1" style={{ borderColor: '#1f4fb9', minHeight: '22px', backgroundColor: '#f2eed3' }}>
                          <EditableSpanWrapper field={`empty${i}_rs`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                        <div className="col-span-1 p-1" style={{ minHeight: '22px', backgroundColor: '#f2eed3' }}>
                          <EditableSpanWrapper field={`empty${i}_paise`} style={{ width: '100%', minHeight: '22px' }} />
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Right Table - Total Expenses Only (Auto-calculated) */}
                  <div className="grid grid-cols-5 border-t-2 text-xs font-semibold" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3' }}>
                    <div className="col-span-3 border-r p-2 text-left" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3' }}>{DISPLAY_NAMES.totalExpenses}</div>
                    <div className="col-span-1 border-r p-2 text-right" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'semibold' }}>{numberToMarathi(calculateTotalExpenses().rs || 0)}</span>
                    </div>
                    <div className="col-span-1 p-2 text-right" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'semibold' }}>{numberToMarathi(calculateTotalExpenses().paise || 0)}</span>
                    </div>
                  </div>
                  {/* Horizontal line after Total Expenses */}
                  <div className="border-b-2" style={{ borderColor: '#1f4fb9', width: '100%', marginTop: '8px' }}></div>
                  {/* Container for Errors and omissions and Thanks text */}
                  <div style={{ backgroundColor: '#f2eed3', width: '100%', padding: '8px 0' }}>
                    {/* Errors and omissions text below Total Expenses */}
                    <div className="text-xs italic" style={{ textAlign: 'center', padding: '4px 8px', color: '#4821c9' }}>
                      {DISPLAY_NAMES.errorsOmissions}
                    </div>
                    {/* Thanks text below Errors and omissions */}
                    <div style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 'bold', fontSize: '16px', color: '#dc2626' }}>
                      {DISPLAY_NAMES.thanks}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Combined Bottom Table */}
            <div className="border-2 mb-1" style={{ borderColor: '#1f4fb9', backgroundColor: '#f2eed3' }}>
              <div className="grid grid-cols-12" style={{ minHeight: '150px' }}>
                {/* Left Side - Terms and Conditions */}
                <div className="col-span-5 p-3" style={{ fontSize: '11px', lineHeight: '1.6', backgroundColor: '#f2eed3' }}>
                  <div style={{ marginBottom: '4px', color: '#4821c9' }}>{DISPLAY_NAMES.salesSlipSent}</div>
                  <div style={{ marginBottom: '4px', color: '#4821c9' }}>
                    {DISPLAY_NAMES.amountOfSlip}
                    <EditableSpanWrapper field="amountOfSlipName" style={{ width: '150px', display: 'inline-block', marginLeft: '8px' }} />
                  </div>
                  <div style={{ marginBottom: '4px', color: '#4821c9' }}>
                    {DISPLAY_NAMES.toBeCollected}
                    <EditableSpanWrapper field="toBeCollectedPlace" style={{ width: '100px', display: 'inline-block', marginLeft: '8px' }} />
                    .
                  </div>
                  <div style={{ marginBottom: '4px', color: '#4821c9' }}>{DISPLAY_NAMES.ifNotReceived}</div>
                  <div style={{ marginBottom: '4px', color: '#4821c9' }}>{DISPLAY_NAMES.noComplaints}</div>
                </div>

                {/* Center - Empty (Grand Total moved to overlay) */}
                <div className="col-span-2 p-3" style={{ backgroundColor: '#f2eed3' }}></div>

                {/* Right Side - Signature */}
                <div className="col-span-5 p-3 flex flex-col justify-center items-end" style={{ backgroundColor: '#f2eed3', minHeight: '100%' }}>
                  <div style={{ marginTop: '20px', display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#dc2626', marginBottom: '8px', textAlign: 'center', width: '100%' }}>{DISPLAY_NAMES.yoursSincerely}</div>
                    <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#dc2626', textAlign: 'right', width: '100%' }}>{DISPLAY_NAMES.signatureName}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateInvoiceDirectPage;

