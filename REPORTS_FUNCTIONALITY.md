# Reports & Analytics - Complete Functionality Documentation

## Overview
The Reports page provides comprehensive invoice analytics, filtering capabilities, and Excel report generation functionality for invoice management systems.

## File Location
- **Component**: `frontend/src/app/reports/page.tsx`
- **Route**: `/reports`

## Dependencies
```javascript
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';  // For Excel export functionality
```

## State Management

### State Variables
1. **invoices** (Array): Stores all invoice data fetched from the API
2. **loading** (Boolean): Indicates if data is being fetched
3. **startDate** (String): Start date for date range filter (YYYY-MM-DD format)
4. **endDate** (String): End date for date range filter (YYYY-MM-DD format)
5. **selectedMovie** (String): Selected client name (Mr. Ra. Ra.) for filtering
6. **showDateSelector** (Boolean): Controls visibility of date selector UI (currently unused)
7. **generatingReport** (Boolean): Indicates if Excel report is being generated

## Data Fetching

### API Endpoint
- **Endpoint**: `/api/proxy`
- **Method**: GET
- **Response**: Array of invoice objects
- **Error Handling**: 
  - Validates response is an array
  - Falls back to empty array on error
  - Logs errors to console

### Data Structure Expected
```javascript
{
  _id: string,
  data: {
    mrRaRa: string,           // Client name (Mr. Ra. Ra.)
    place: string,            // Place
    centre: string,           // City
    invoiceDate: string,      // Invoice date
    totalCollection: number,  // Total sales amount
    expensesTotal: number,     // Total expenses
    grandTotalRs: number,      // Grand total (preferred)
    grandTotal: number,        // Grand total (fallback)
    netAmount: number,         // Net amount (fallback)
    table: Array<{             // Daily collection data
      date: string,
      collection: number
    }>
  },
  createdAt: string           // Creation timestamp
}
```

## Core Functions

### 1. getGrandTotalFromInvoice(inv)
**Purpose**: Safely extracts grand total from invoice data with multiple fallback options

**Logic**:
- Checks in order: `grandTotalRs` → `grandTotal` → `netAmount` → `totalCollection` → `0`
- Handles both number and string types
- Cleans string values (removes non-numeric characters except decimal point and minus)
- Returns 0 if parsing fails

**Returns**: Number (grand total amount)

### 2. parseDateForMonth(dateString)
**Purpose**: Parses date string for month-based calculations

**Supported Formats**:
- DD/MM/YYYY
- DD-MM-YYYY
- ISO date strings
- Standard Date.parse() formats

**Returns**: Date object or null

**Usage**: Used for filtering invoices by current month and last month

### 3. parseDate(dateString)
**Purpose**: Comprehensive date parsing for date range filtering

**Supported Formats**:
- ISO strings (with 'T' or 'Z')
- DD/MM/YYYY
- DD-MM-YYYY
- YYYY-MM-DD

**Returns**: Date object or null

**Usage**: Used for date range filtering

## Statistics Calculations

### 1. Total Invoices
- **Calculation**: `invoicesArray.length`
- **Display**: Total count of all invoices

### 2. Total Revenue
- **Calculation**: Sum of all `getGrandTotalFromInvoice(inv)` values
- **Display**: Formatted as ₹X,XXX,XXX (Indian number format)

### 3. This Month Invoices
- **Filter**: Invoices where invoice date month/year matches current month/year
- **Calculation**: Count of filtered invoices
- **Date Source**: `inv.data?.invoiceDate || inv.createdAt`

### 4. This Month Revenue
- **Filter**: Same as This Month Invoices
- **Calculation**: Sum of grand totals for filtered invoices
- **Display**: Formatted as ₹X,XXX,XXX

### 5. Last Month Invoices
- **Filter**: Invoices where invoice date month/year matches previous month/year
- **Calculation**: Count of filtered invoices

### 6. Last Month Revenue
- **Filter**: Same as Last Month Invoices
- **Calculation**: Sum of grand totals for filtered invoices
- **Display**: Formatted as ₹X,XXX,XXX

## Filtering Functionality

### Filter Options
1. **Date Range Filter**:
   - Start Date (optional)
   - End Date (optional)
   - Both dates must be provided for date filtering

2. **Client Filter**:
   - Dropdown populated with unique client names (Mr. Ra. Ra.)
   - "All Clients" option to clear filter
   - Optional filter

### Filter Logic
```javascript
filteredInvoices = invoicesArray.filter(inv => {
  // Date filter (if both dates provided)
  let dateMatch = true;
  if (startDate && endDate) {
    const invoiceDate = parseDate(inv.data?.invoiceDate || inv.createdAt);
    dateMatch = invoiceDate >= start && invoiceDate <= end;
  }
  
  // Client filter (if selected)
  const movieMatch = !selectedMovie || inv.data?.mrRaRa === selectedMovie;
  
  return dateMatch && movieMatch;
});
```

### Unique Clients Extraction
- Extracts all unique `mrRaRa` values from invoices
- Filters out empty strings
- Sorts alphabetically
- Populates dropdown select

## Excel Report Generation

### Function: generateExcelReport()

#### Prerequisites
- At least one filter must be applied (date range OR client)
- Must have filtered invoices (shows alert if none found)

#### Excel Structure

**Fixed Columns**:
1. **SR. NO**: Sequential number (1, 2, 3...)
2. **CLIENT (MR. RA. RA.)**: Client name from `data.mrRaRa`
3. **PLACE**: Place from `data.place`
4. **CITY**: City from `data.centre`
5. **TOTAL SALES**: From `data.totalCollection` (2 decimal places)
6. **TOTAL EXPENSES**: From `data.expensesTotal` (2 decimal places)
7. **GRAND TOTAL**: From `data.grandTotalRs` or `data.netAmount` (2 decimal places)

**Dynamic Columns**:
- One column per unique date found in `data.table[].date`
- Column header: Date string (e.g., "28-05-2025")
- Column value: Daily collection amount from `data.table[].collection` (2 decimal places)
- Dates are sorted chronologically

#### Column Widths
```javascript
[
  { wch: 8 },   // SR. NO
  { wch: 25 },  // CLIENT (MR. RA. RA.)
  { wch: 15 },  // PLACE
  { wch: 15 },  // CITY
  { wch: 14 },  // TOTAL SALES
  { wch: 16 },  // TOTAL EXPENSES
  { wch: 14 },  // GRAND TOTAL
  ...sortedDates.map(() => ({ wch: 12 }))  // Dynamic date columns
]
```

#### Filename Generation
Format: `Invoice_Report_[filters].xlsx`

**Rules**:
- Base: `Invoice_Report`
- If date range: `_DD-MM-YYYY_to_DD-MM-YYYY`
- If client selected: `_[ClientName]` (special chars replaced with `_`)
- If only client (no dates): `_AllDates` suffix added
- Extension: `.xlsx`

**Examples**:
- `Invoice_Report_25-11-2025_to_30-11-2025.xlsx`
- `Invoice_Report_25-11-2025_to_30-11-2025_ClientName.xlsx`
- `Invoice_Report_ClientName_AllDates.xlsx`

#### Excel Generation Process
1. Validate filters applied
2. Check filtered invoices exist
3. Extract all unique dates from invoice tables
4. Sort dates chronologically
5. Build row data for each invoice
6. Create workbook using XLSX library
7. Convert JSON data to worksheet
8. Set column widths
9. Append worksheet to workbook
10. Generate filename
11. Download file using `XLSX.writeFile()`

## UI Components

### 1. Top Navigation Bar
- **Background**: Orange gradient (from-orange-500 via-orange-400 to-orange-600)
- **Height**: 72px
- **Content**: Dashboard button (links to home)

### 2. Statistics Cards (5 Cards)
Displayed in responsive grid (1 column mobile, 2 tablet, 5 desktop)

**Card 1 - Total Invoices**:
- Icon: Document SVG (orange)
- Value: Total invoice count
- Background: White with orange border

**Card 2 - Total Revenue**:
- Icon: Document SVG (green)
- Value: ₹X,XXX,XXX formatted
- Background: White with green border

**Card 3 - This Month Invoices**:
- Icon: Calendar SVG (blue)
- Value: Count of current month invoices
- Background: White with blue border

**Card 4 - Last Month Invoices**:
- Icon: Calendar SVG (indigo)
- Value: Count of previous month invoices
- Background: White with indigo border

**Card 5 - Monthly Revenue**:
- Icon: Trending up SVG (purple)
- Value: ₹X,XXX,XXX formatted (current month)
- Background: White with purple border

### 3. Filter Section
**Container**: White card with shadow and orange border

**Inputs**:
1. **Start Date**: HTML date input
2. **End Date**: HTML date input
3. **Client Dropdown**: Select with unique client names
4. **Generate Report Button**: 
   - Disabled if no filters applied
   - Shows "Generating..." when processing
   - Orange background

**Filter Status Display**:
- Shows count of filtered invoices
- Displays active filters (date range and/or client)
- Updates dynamically

### 4. Recent Invoices Table
**Structure**:
- Header: "Recent Invoices"
- Background: White with orange border
- Shows first 10 invoices (all invoices, not filtered)

**Columns**:
1. **Invoice No**: From `data["In_no"]` or fallback text
2. **Client Name**: From `data.mrRaRa`
3. **Date**: From `data.invoiceDate` or `invoiceDate`
4. **Amount**: From `data.totalCollection` formatted as ₹X,XXX
5. **Status**: Always "Completed" (green badge)

**Styling**:
- Hover effect on rows (orange background)
- Responsive table with horizontal scroll
- Orange-themed header background

## Error Handling

### Data Fetching Errors
- Catches fetch errors
- Logs to console
- Sets invoices to empty array
- Sets loading to false

### Excel Generation Errors
- Try-catch block around generation
- Shows alert on error
- Resets generating state
- Logs error to console

### Validation Errors
- Checks for at least one filter before generating report
- Validates filtered invoices exist
- Shows descriptive error messages

## Date Format Handling

### Supported Input Formats
1. **DD/MM/YYYY**: Split by '/', parse as day/month/year
2. **DD-MM-YYYY**: Split by '-', parse as day/month/year
3. **YYYY-MM-DD**: Split by '-', parse as year/month/day
4. **ISO Strings**: Standard Date parsing

### Month Calculation
- Uses 0-indexed months (JavaScript standard)
- Handles year boundaries correctly
- Validates date before using

## Number Formatting

### Indian Number Format
- Uses `toLocaleString('en-IN')`
- Example: 1234567 → "12,34,567"
- Applied to revenue displays

### Currency Formatting
- Prefix: ₹ (Indian Rupee symbol)
- Format: ₹X,XXX,XXX
- Applied to all monetary values

### Decimal Formatting
- Excel values: 2 decimal places (`.toFixed(2)`)
- Display values: No decimals for whole numbers

## Responsive Design

### Grid Layouts
- Statistics cards: Responsive grid (1/2/5 columns)
- Main content: Max width 1600px, centered
- Table: Horizontal scroll on small screens

### Breakpoints
- Mobile: Single column
- Tablet (md): 2 columns
- Desktop (lg): 5 columns

## Integration Points

### API Integration
- Uses `/api/proxy` endpoint
- Expects array of invoice objects
- Handles malformed data gracefully

### Navigation
- Links to Dashboard (`/`)
- Uses Next.js Link component
- Maintains navigation state

### Excel Library
- Uses `xlsx` (SheetJS) library
- Creates workbook and worksheet
- Sets column widths
- Downloads file client-side

## Usage Example

```javascript
// Component renders automatically at /reports route
// User can:
// 1. View statistics cards
// 2. Select date range (optional)
// 3. Select client (optional)
// 4. Click "Generate Report" to download Excel
// 5. View recent invoices table
```

## Key Features Summary

1. ✅ Real-time statistics calculation
2. ✅ Date range filtering
3. ✅ Client-based filtering
4. ✅ Excel export with dynamic columns
5. ✅ Monthly revenue tracking
6. ✅ Responsive design
7. ✅ Error handling
8. ✅ Multiple date format support
9. ✅ Indian number formatting
10. ✅ Recent invoices display

## Future Enhancement Possibilities

1. Export to PDF
2. Chart/Graph visualizations
3. Advanced filtering (multiple clients, amount ranges)
4. Scheduled report generation
5. Email report delivery
6. Custom date range presets (This Week, This Quarter, etc.)
7. Export multiple formats (CSV, JSON)
8. Report templates
9. Print functionality
10. Data export with more detailed breakdowns


