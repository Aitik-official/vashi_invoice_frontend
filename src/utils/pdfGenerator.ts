import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createRoot } from 'react-dom/client';

// Standardized PDF generation settings for consistent output across all systems
export const PDF_GENERATION_CONFIG = {
  // Canvas settings - optimized for consistent quality and file size
  canvas: {
    scale: 2.5, // Higher scale for better quality and consistent file size (350KB+)
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: true,
    logging: false,
    removeContainer: true,
    imageTimeout: 10000, // Increased timeout for better reliability
    width: 900, // Fixed width for consistency (matches invoice preview width)
    height: 1130, // Fixed height for consistency (matches invoice preview minHeight)
  },
  
  // Image settings - PNG for better quality, consistent file size
  image: {
    format: 'image/png' as const,
    quality: 1.0, // Maximum quality for PNG
  },
  
  // PDF settings - standardized dimensions
  pdf: {
    orientation: 'p' as const,
    unit: 'pt' as const,
    format: 'a4' as const,
    compress: true,
    margin: 40, // Consistent margins
  }
};

// Standardized PDF generation function
export const generateStandardizedPDF = async (
  component: React.ReactElement,
  filename: string,
  options: {
    isZipGeneration?: boolean;
    customScale?: number;
  } = {}
): Promise<{ filename: string; data: Uint8Array }> => {
  try {
    // Create hidden div with standardized dimensions
    const hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'fixed';
    hiddenDiv.style.left = '-9999px';
    hiddenDiv.style.top = '0';
    hiddenDiv.style.width = `${PDF_GENERATION_CONFIG.canvas.width}px`;
    hiddenDiv.style.height = `${PDF_GENERATION_CONFIG.canvas.height}px`;
    hiddenDiv.style.background = '#fff';
    hiddenDiv.style.color = '#000';
    hiddenDiv.style.fontFamily = 'Arial, Helvetica, sans-serif';
    hiddenDiv.style.boxSizing = 'border-box';
    
    // Add standardized styles for consistent rendering
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      * {
        color: #000 !important;
        background-color: #fff !important;
        border-color: #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        box-sizing: border-box !important;
      }
      
      /* Ensure consistent font rendering */
      body, div, span, p, td, th {
        font-family: Arial, Helvetica, sans-serif !important;
        font-size: inherit !important;
        line-height: inherit !important;
      }
      
      /* Fix table cell alignment */
      .pdf-cell-fix {
        position: relative !important;
        top: -2.5px !important;
        vertical-align: middle !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      
      /* Ensure images maintain aspect ratio */
      img {
        max-width: 100% !important;
        height: auto !important;
        object-fit: contain !important;
      }
      
      /* Stamp specific styling for consistency */
      img[src*="Stamp_mum.png"] {
        width: 144px !important;
        height: 120px !important;
        object-fit: contain !important;
        min-width: 144px !important;
        max-width: 144px !important;
        min-height: 120px !important;
        max-height: 120px !important;
        aspect-ratio: 1.2/1 !important;
        transform: none !important;
        scale: 1 !important;
        flex-shrink: 0 !important;
        flex-grow: 0 !important;
        box-sizing: border-box !important;
        display: block !important;
        position: static !important;
      }
      
      /* Prevent any flex container from compressing the stamp */
      div:has(img[src*="Stamp_mum.png"]) {
        width: 144px !important;
        height: 120px !important;
        flex-shrink: 0 !important;
        flex-grow: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 144px !important;
        max-width: 144px !important;
        min-height: 120px !important;
        max-height: 120px !important;
      }
    `;
    hiddenDiv.appendChild(styleTag);
    document.body.appendChild(hiddenDiv);

    // Render component into hidden div
    const reactRoot = createRoot(hiddenDiv);
    reactRoot.render(component);

    // Wait for render and images to load
    await new Promise(r => setTimeout(r, 800));

    // Do not modify layout - render exactly as shown in preview
    // Only apply minimal text shifting if absolutely necessary for spacing

    // Wait for all images to load
    await waitForImagesToLoad(hiddenDiv);
    
    // Use standardized canvas settings
    const scale = options.customScale || PDF_GENERATION_CONFIG.canvas.scale;
    const canvas = await html2canvas(hiddenDiv, {
      ...PDF_GENERATION_CONFIG.canvas,
      scale,
      onclone: (clonedDoc) => {
        // Ensure stamp maintains exact dimensions in cloned document
        const clonedStamp = clonedDoc.querySelector('img[src*="Stamp_mum.png"]');
        if (clonedStamp instanceof HTMLElement) {
          clonedStamp.style.width = '144px';
          clonedStamp.style.height = '120px';
          clonedStamp.style.objectFit = 'contain';
          clonedStamp.style.aspectRatio = '1.2/1';
          clonedStamp.style.transform = 'none';
          clonedStamp.style.scale = '1';
          clonedStamp.style.flexShrink = '0';
          clonedStamp.style.flexGrow = '0';
        }
        
        // Only shift text content upward, preserve all layout exactly
        // The real issue: When text is shifted with translateY, it can cause wrapping in:
        // 1. Top box blanks (elements with borderBottom)
        // 2. Grid cells (especially header cells like "Details of Expenses")
        // Solution: Ensure all containers maintain their width/height constraints
        // and prevent text wrapping in grid cells and flex containers
        
        // First, fix all grid containers to maintain their column widths
        const gridContainers = clonedDoc.body.querySelectorAll('.grid, [style*="gridTemplateColumns"], [style*="display: grid"]');
        gridContainers.forEach((grid) => {
          if (grid instanceof HTMLElement) {
            const gridStyle = window.getComputedStyle(grid);
            const gridTemplateColumns = gridStyle.gridTemplateColumns;
            if (gridTemplateColumns && gridTemplateColumns !== 'none') {
              // Force grid to maintain its column template
              grid.style.setProperty('grid-template-columns', gridTemplateColumns, 'important');
              grid.style.setProperty('width', gridStyle.width || '100%', 'important');
              // Prevent grid from shrinking
              grid.style.setProperty('min-width', gridStyle.width || '100%', 'important');
            }
          }
        });
        
        // Fix all grid cells to maintain their width and prevent wrapping
        const gridCells = clonedDoc.body.querySelectorAll('.grid > div, [style*="gridTemplateColumns"] > div');
        gridCells.forEach((cell) => {
          if (cell instanceof HTMLElement) {
            const cellStyle = window.getComputedStyle(cell);
            // Ensure grid cells maintain their width
            if (cellStyle.width && cellStyle.width !== 'auto') {
              cell.style.setProperty('width', cellStyle.width, 'important');
              cell.style.setProperty('min-width', cellStyle.width, 'important');
              cell.style.setProperty('max-width', cellStyle.width, 'important');
            }
            // If cell has whiteSpace: nowrap, preserve it
            const cellAttrStyle = cell.getAttribute('style') || '';
            if (cellAttrStyle.includes('whiteSpace: nowrap') || 
                cellAttrStyle.includes('white-space: nowrap') ||
                cellStyle.whiteSpace === 'nowrap') {
              cell.style.setProperty('white-space', 'nowrap', 'important');
              cell.style.setProperty('overflow', 'hidden', 'important');
            }
            // Preserve height to prevent row expansion
            if (cellStyle.height && cellStyle.height !== 'auto') {
              cell.style.setProperty('height', cellStyle.height, 'important');
              cell.style.setProperty('min-height', cellStyle.minHeight || cellStyle.height, 'important');
            }
          }
        });
        
        // Fix flex containers to maintain width
        const flexContainers = clonedDoc.body.querySelectorAll('[style*="display: flex"], [style*="display:flex"]');
        flexContainers.forEach((flex) => {
          if (flex instanceof HTMLElement) {
            const flexStyle = window.getComputedStyle(flex);
            if (flexStyle.width && flexStyle.width !== 'auto') {
              flex.style.setProperty('width', flexStyle.width, 'important');
              flex.style.setProperty('min-width', flexStyle.width, 'important');
              flex.style.setProperty('flex-shrink', '0', 'important');
            }
            // Preserve whiteSpace: nowrap if present
            const flexAttrStyle = flex.getAttribute('style') || '';
            if (flexAttrStyle.includes('whiteSpace: nowrap') || 
                flexAttrStyle.includes('white-space: nowrap') ||
                flexStyle.whiteSpace === 'nowrap') {
              flex.style.setProperty('white-space', 'nowrap', 'important');
            }
          }
        });
        
        // Now shift text elements, but ensure they don't cause wrapping
        const allTextElements = clonedDoc.body.querySelectorAll('span, p, div');
        allTextElements.forEach((element) => {
          if (element instanceof HTMLElement) {
            // Skip if it's a container, grid, table, or structural element
            const isContainer = element.classList.contains('grid') || 
                               element.style.display === 'grid' ||
                               element.style.display === 'flex' ||
                               element.getAttribute('style')?.includes('gridTemplateColumns') ||
                               element.tagName === 'TABLE' ||
                               element.closest('table') ||
                               element.closest('.grid') ||
                               element.querySelector('.grid');
            
            const style = element.getAttribute('style') || '';
            const computedStyle = window.getComputedStyle(element);
            
            // Check if element has borderBottom (input field/blanks in top box)
            const hasBorderBottom = style.includes('borderBottom') || 
                                   style.includes('border-bottom');
            
            // Only shift simple text elements (leaf nodes with text, not containers)
            const hasOnlyText = !element.querySelector('*') || 
                              (element.children.length === 0 && element.textContent && element.textContent.trim());
            
            // Shift text but ensure it doesn't cause layout issues
            if (!isContainer && hasOnlyText && element.textContent && element.textContent.trim()) {
              const currentTransform = element.style.transform || '';
              if (!currentTransform.includes('translateY')) {
                // Use transform with position:relative
                element.style.setProperty('transform', 'translateY(-60px)', 'important');
                element.style.setProperty('position', 'relative', 'important');
                
                // For elements with borderBottom (blanks in top box), ensure they maintain width
                if (hasBorderBottom) {
                  const currentWidth = computedStyle.width || element.style.width || 'auto';
                  if (currentWidth && currentWidth !== 'auto') {
                    element.style.setProperty('width', currentWidth, 'important');
                    element.style.setProperty('min-width', currentWidth, 'important');
                    element.style.setProperty('flex-shrink', '0', 'important');
                  }
                  // Ensure no wrapping
                  element.style.setProperty('white-space', 'nowrap', 'important');
                  element.style.setProperty('overflow', 'hidden', 'important');
                } else {
                  // For other text elements, preserve width if set
                  const currentWidth = computedStyle.width;
                  if (currentWidth && currentWidth !== 'auto') {
                    element.style.setProperty('width', currentWidth, 'important');
                    element.style.setProperty('min-width', currentWidth, 'important');
                    element.style.setProperty('flex-shrink', '0', 'important');
                  }
                  // Preserve white-space if it's nowrap
                  if (style.includes('whiteSpace: nowrap') || 
                      style.includes('white-space: nowrap') ||
                      computedStyle.whiteSpace === 'nowrap') {
                    element.style.setProperty('white-space', 'nowrap', 'important');
                    element.style.setProperty('overflow', 'hidden', 'important');
                  }
                }
              }
            }
          }
        });
      },
      ignoreElements: (element) => {
        // Ignore elements with problematic CSS
        const style = window.getComputedStyle(element);
        return style.color.includes('oklch') || 
               style.backgroundColor.includes('oklch') ||
               style.borderColor.includes('oklch');
      }
    });
    
    // Generate image data with standardized settings
    const imgData = canvas.toDataURL(PDF_GENERATION_CONFIG.image.format, PDF_GENERATION_CONFIG.image.quality);
    
    // Create PDF with standardized settings
    const pdf = new jsPDF({
      orientation: PDF_GENERATION_CONFIG.pdf.orientation,
      unit: PDF_GENERATION_CONFIG.pdf.unit,
      format: PDF_GENERATION_CONFIG.pdf.format,
      compress: PDF_GENERATION_CONFIG.pdf.compress
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Calculate dimensions with consistent margins
    const margin = PDF_GENERATION_CONFIG.pdf.margin;
    const availableWidth = pdfWidth - (margin * 2);
    const availableHeight = pdfHeight - (margin * 2);
    
    // Calculate scaling to fit content properly
    const widthRatio = availableWidth / canvasWidth;
    const heightRatio = availableHeight / canvasHeight;
    const scaleRatio = Math.min(widthRatio, heightRatio);
    
    const finalWidth = canvasWidth * scaleRatio;
    const finalHeight = canvasHeight * scaleRatio;
    
    // Center the content
    const x = (pdfWidth - finalWidth) / 2;
    const y = (pdfHeight - finalHeight) / 2;
    
    // Add image to PDF
    pdf.addImage(imgData, "PNG", x, y, finalWidth, finalHeight, undefined, 'FAST');
    
    // Generate PDF data
    const pdfData = pdf.output('arraybuffer');
    
    // Clean up
    reactRoot.unmount();
    document.body.removeChild(hiddenDiv);
    
    return { 
      filename: filename || `Invoice_${Date.now()}.pdf`, 
      data: new Uint8Array(pdfData) 
    };
  } catch (error) {
    console.error('Standardized PDF generation error:', error);
    throw error;
  }
};

// Helper function to wait for images to load
function waitForImagesToLoad(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  return Promise.all(images.map(img => {
    if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
    return new Promise<void>(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  })).then(() => {});
}

// Export for backward compatibility
export default generateStandardizedPDF;

