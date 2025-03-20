import { PDFDocument } from 'pdf-lib';

export class PDFHandler {
    constructor(options = {}) {
        this.PAGES_PER_GROUP = options.pagesPerGroup || 10;
        this.cache = {
            documents: new Map(),
            pageGroups: new Map()
        };
    }

    /**
     * Create a simple hash for caching
     * @param {string} str - String to hash
     * @returns {string} Hash string
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    /**
     * Load document with caching
     * @param {string} base64PDF - PDF content in base64
     * @returns {Promise<PDFDocument>} PDF document
     */
    async getDocument(base64PDF) {
        const cacheKey = this.hashString(base64PDF);
        
        if (!this.cache.documents.has(cacheKey)) {
            console.log('Loading new PDF document');
            const pdfBytes = Buffer.from(base64PDF, 'base64');
            const pdfDoc = await PDFDocument.load(pdfBytes);
            this.cache.documents.set(cacheKey, pdfDoc);
            return pdfDoc;
        }
        
        console.log('Using cached PDF document');
        return this.cache.documents.get(cacheKey);
    }

    /**
     * Get page count for a PDF
     * @param {string} base64PDF - PDF content in base64
     * @returns {Promise<number>} Page count
     */
    async getPageCount(base64PDF) {
        const pdfDoc = await this.getDocument(base64PDF);
        const pageCount = pdfDoc.getPageCount();
        console.log(`Page count: ${pageCount}`);
        return pageCount;
    }

    /**
     * Get first page of a PDF
     * @param {string} base64PDF - PDF content in base64
     * @returns {Promise<string>} First page as base64 string
     */
    async getFirstPageBase64(base64PDF) {
        const pdfDoc = await this.getDocument(base64PDF);
        const newPdfDoc = await PDFDocument.create();
        
        const [firstPage] = await newPdfDoc.copyPages(pdfDoc, [0]);
        newPdfDoc.addPage(firstPage);
        
        const pdfBytes = await newPdfDoc.save();
        return Buffer.from(pdfBytes).toString('base64');
    }

    /**
     * Get a group of pages from a PDF
     * @param {string} base64PDF - PDF content in base64
     * @param {number} groupIndex - Index of the page group
     * @returns {Promise<Object>} Group information and content
     */
    async getPageGroup(base64PDF, groupIndex) {
        // Create cache key
        const pdfHash = this.hashString(base64PDF);
        const cacheKey = `${pdfHash}_group_${groupIndex}`;
        
        // Return cached result if available
        if (this.cache.pageGroups.has(cacheKey)) {
            console.log(`Using cached page group ${groupIndex}`);
            return this.cache.pageGroups.get(cacheKey);
        }
        
        // Process the page group
        try {
            console.log(`Getting page group ${groupIndex}...`);
            const pdfDoc = await this.getDocument(base64PDF);
            const totalPages = pdfDoc.getPageCount();
            
            const startPage = groupIndex * this.PAGES_PER_GROUP;
            const endPage = Math.min(startPage + this.PAGES_PER_GROUP, totalPages);
            
            if (startPage >= totalPages) {
                throw new Error('Group index exceeds total pages');
            }

            // Create a new document with just the pages for this group
            const newPdfDoc = await PDFDocument.create();
            const pageIndices = Array.from(
                { length: endPage - startPage }, 
                (_, i) => startPage + i
            );
            
            const pages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
            pages.forEach(page => newPdfDoc.addPage(page));
            
            const pdfBytes = await newPdfDoc.save();
            
            const result = {
                base64: Buffer.from(pdfBytes).toString('base64'),
                startPage: startPage + 1,
                endPage,
                totalPages,
                isLastGroup: endPage === totalPages
            };
            
            // Cache the result
            this.cache.pageGroups.set(cacheKey, result);
            
            return result;
        } catch (error) {
            console.error('Error extracting page group:', error);
            throw new Error(`Failed to extract page group ${groupIndex}: ${error.message}`);
        }
    }
    
    /**
     * Merge multiple PDFs into one
     * @param {Array<string>} base64PDFs - Array of PDF contents in base64
     * @returns {Promise<string>} Merged PDF as base64 string
     */
    async mergeBase64PDFs(base64PDFs) {
        try {
            console.log(`Merging ${base64PDFs.length} PDFs...`);
            
            // Create a new PDF document
            const mergedPdf = await PDFDocument.create();
            
            // Process each PDF
            for (const base64Pdf of base64PDFs) {
                // Skip empty PDFs
                if (!base64Pdf) {
                    console.warn('Skipping empty PDF in merge');
                    continue;
                }
                
                try {
                    // Convert base64 to buffer
                    const pdfBuffer = Buffer.from(base64Pdf, 'base64');
                    
                    // Load the PDF document
                    const pdfDoc = await PDFDocument.load(pdfBuffer);
                    
                    // Get the number of pages
                    const pageCount = pdfDoc.getPageCount();
                    console.log(`PDF has ${pageCount} pages`);
                    
                    // Copy all pages to the merged PDF
                    const pages = await mergedPdf.copyPages(pdfDoc, Array.from(Array(pageCount).keys()));
                    
                    // Add all pages to the merged PDF
                    pages.forEach(page => mergedPdf.addPage(page));
                } catch (error) {
                    console.error('Error processing PDF during merge:', error);
                    // Continue with next PDF
                }
            }
            
            // Save the merged PDF
            const mergedPdfBytes = await mergedPdf.save();
            
            console.log('PDFs merged successfully');
            return Buffer.from(mergedPdfBytes).toString('base64');
        } catch (error) {
            console.error('Error merging PDFs:', error);
            throw new Error('Failed to merge PDF files: ' + error.message);
        }
    }

    /**
     * Clear the cache
     * @returns {boolean} Success
     */
    clearCache() {
        this.cache.documents.clear();
        this.cache.pageGroups.clear();
        console.log('PDF document and page group caches cleared');
        return true;
    }
    
    /**
     * Get specific page range from a PDF
     * @param {string} base64PDF - PDF content in base64
     * @param {number} startPage - Start page (1-based)
     * @param {number} endPage - End page (1-based)
     * @returns {Promise<string>} PDF with selected pages as base64 string
     */
    async getPages(base64PDF, startPage, endPage) {
        const pdfDoc = await this.getDocument(base64PDF);
        const totalPages = pdfDoc.getPageCount();
        
        // Validate page range
        if (startPage < 1 || startPage > totalPages || endPage < startPage || endPage > totalPages) {
            throw new Error(`Invalid page range: ${startPage}-${endPage} (document has ${totalPages} pages)`);
        }
        
        // Convert to zero-based indices
        const pageIndices = Array.from(
            { length: endPage - startPage + 1 },
            (_, i) => startPage - 1 + i
        );
        
        // Create new document with selected pages
        const newPdfDoc = await PDFDocument.create();
        const pages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
        pages.forEach(page => newPdfDoc.addPage(page));
        
        const pdfBytes = await newPdfDoc.save();
        return Buffer.from(pdfBytes).toString('base64');
    }
}