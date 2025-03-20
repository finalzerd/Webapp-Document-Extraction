import { PDFDocument } from 'pdf-lib';

export class PDFHandler {
    constructor() {
        this.PAGES_PER_GROUP = 10;
        this.cachedDocuments = new Map(); // Cache for loaded documents
        this.cachedPageGroups = new Map(); // Cache for page groups
    }

    async loadDocumentIfNeeded(base64PDF) {
        // Create a hash of the PDF content to use as cache key
        const cacheKey = this.hashString(base64PDF);
        
        if (!this.cachedDocuments.has(cacheKey)) {
            console.log('Loading new PDF document');
            const pdfDoc = await PDFDocument.load(Buffer.from(base64PDF, 'base64'));
            this.cachedDocuments.set(cacheKey, pdfDoc);
            return pdfDoc;
        }
        
        console.log('Using cached PDF document');
        return this.cachedDocuments.get(cacheKey);
    }
    
    // Helper function to create a simple hash for caching
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    async getPageCount(base64PDF) {
        try {
            console.log('Getting page count...');
            const pdfDoc = await this.loadDocumentIfNeeded(base64PDF);
            const pageCount = pdfDoc.getPageCount();
            console.log(`Page count: ${pageCount}`);
            return pageCount;
        } catch (error) {
            console.error('Error getting page count:', error);
            throw new Error('Failed to get page count: ' + error.message);
        }
    }

    async getFirstPageBase64(base64PDF) {
        try {
            console.log('Starting first page extraction...');
            const pdfDoc = await this.loadDocumentIfNeeded(base64PDF);
            
            const newPdfDoc = await PDFDocument.create();
            const [firstPage] = await newPdfDoc.copyPages(pdfDoc, [0]);
            newPdfDoc.addPage(firstPage);
            
            const pdfBytes = await newPdfDoc.save();
            console.log('First page extracted successfully');
            
            return Buffer.from(pdfBytes).toString('base64');
        } catch (error) {
            console.error('Error extracting first page:', error);
            throw new Error('Failed to extract first page: ' + error.message);
        }
    }

    async getPageGroup(base64PDF, groupIndex) {
        try {
            // Create cache key combining the PDF and group index
            const pdfHash = this.hashString(base64PDF);
            const cacheKey = `${pdfHash}_group_${groupIndex}`;
            
            // Return cached result if available
            if (this.cachedPageGroups.has(cacheKey)) {
                console.log(`Using cached page group ${groupIndex}`);
                return this.cachedPageGroups.get(cacheKey);
            }
            
            console.log(`Getting page group ${groupIndex}...`);
            const pdfDoc = await this.loadDocumentIfNeeded(base64PDF);
            const totalPages = pdfDoc.getPageCount();
            
            const startPage = groupIndex * this.PAGES_PER_GROUP;
            const endPage = Math.min(startPage + this.PAGES_PER_GROUP, totalPages);
            
            if (startPage >= totalPages) {
                throw new Error('Group index exceeds total pages');
            }

            const newPdfDoc = await PDFDocument.create();
            const pageIndices = Array.from(
                { length: endPage - startPage }, 
                (_, i) => startPage + i
            );
            
            const pages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
            pages.forEach(page => newPdfDoc.addPage(page));
            
            const pdfBytes = await newPdfDoc.save();
            console.log(`Extracted pages ${startPage + 1} to ${endPage}`);
            
            const result = {
                base64: Buffer.from(pdfBytes).toString('base64'),
                startPage: startPage + 1,
                endPage,
                totalPages,
                isLastGroup: endPage === totalPages
            };
            
            // Cache the result
            this.cachedPageGroups.set(cacheKey, result);
            
            return result;
        } catch (error) {
            console.error('Error extracting page group:', error);
            throw new Error(`Failed to extract page group ${groupIndex}: ${error.message}`);
        }
    }

    // Optionally add a method to clear caches
    clearCaches() {
        this.cachedDocuments.clear();
        this.cachedPageGroups.clear();
        console.log('Cleared PDF document and page group caches');
    }
}