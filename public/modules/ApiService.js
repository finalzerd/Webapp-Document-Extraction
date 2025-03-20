export class ApiService {
    constructor() {
        this.baseUrl = ''; // Can be configured for different environments
        this.endpoints = {
            mergePDFs: '/merge-pdfs',
            suggestFields: '/suggest-fields',
            extractData: '/extract-data',
            getPageCount: '/get-page-count',
            extractDataGroup: '/extract-data-group',
            extractTableData: '/extract-table-data'
        };
        
        this.MAX_RETRIES = 5;
        this.RETRY_DELAY = 15000; // 15 seconds
        this.currentProcessingGroup = 0;
    }

    // Generic API call method to reduce duplication
    async apiCall(endpoint, data, options = {}) {
        const url = this.baseUrl + endpoint;
        const method = options.method || 'POST';
        
        const requestOptions = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: JSON.stringify(data)
        };

        try {
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server returned ${response.status}`);
            }
            
            const responseData = await response.json();
            
            if (!responseData.success) {
                throw new Error(responseData.error || 'Unknown API error');
            }
            
            return responseData;
        } catch (error) {
            console.error(`API error (${endpoint}):`, error);
            throw error;
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Retry wrapper with better error handling
    async withRetry(operation, context = 'operation') {
        let lastError;
        
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                const isConnectionError = error.message.includes('Failed to fetch') || 
                                         error.message.includes('ERR_CONNECTION_REFUSED');
                
                if (isConnectionError && attempt === this.MAX_RETRIES) {
                    throw new Error('Unable to connect to server. Please check if the server is running.');
                }
                
                console.log(`Attempt ${attempt} failed for ${context}. Error: ${error.message}`);
                
                if (attempt < this.MAX_RETRIES) {
                    console.log(`Waiting ${this.RETRY_DELAY/1000} seconds before retry...`);
                    await this.delay(this.RETRY_DELAY);
                }
            }
        }
        
        throw new Error(`All ${this.MAX_RETRIES} retry attempts failed for ${context}. Last error: ${lastError?.message}`);
    }

    // Simplified API methods using the generic apiCall
    async mergePDFs(base64Array) {
        return this.withRetry(async () => {
            console.log('Merging', base64Array.length, 'PDFs');
            const response = await this.apiCall(this.endpoints.mergePDFs, { pdfs: base64Array });
            console.log('PDFs merged successfully');
            return response.mergedPDF;
        }, 'PDF merge');
    }
    
    async getPDFPageCount(base64Content) {
        return this.withRetry(async () => {
            console.log('Getting page count...');
            const response = await this.apiCall(this.endpoints.getPageCount, { base64Content });
            console.log('Page count retrieved:', response.pageCount);
            return response.pageCount;
        }, 'page count');
    }

    async suggestFields(base64Content) {
        return this.withRetry(async () => {
            const response = await this.apiCall(this.endpoints.suggestFields, { base64Content });
            return response.fields;
        }, 'field suggestion');
    }

    async extractDataFromGroup(base64Content, selectedFields, groupInfo) {
        return this.withRetry(async () => {
            console.log(`Extracting data for group ${groupInfo.groupIndex + 1}`);
            const response = await this.apiCall(this.endpoints.extractDataGroup, {
                base64Content,
                selectedFields,
                groupInfo
            });
            return response.data;
        }, `group ${groupInfo.groupIndex + 1}`);
    }

    async extractTableData(base64Content) {
        return this.withRetry(async () => {
            console.log('Extracting table data...');
            const response = await this.apiCall(this.endpoints.extractTableData, { base64Content });
            return response.data;
        }, 'table extraction');
    }

    // Generator function for processing groups
    async* processGroups(base64Content, selectedFields, totalPages) {
        const PAGES_PER_GROUP = 10;
        const totalGroups = Math.ceil(totalPages / PAGES_PER_GROUP);
        
        for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
            const startPage = groupIndex * PAGES_PER_GROUP;
            const endPage = Math.min(startPage + PAGES_PER_GROUP, totalPages);
            
            const groupInfo = {
                groupIndex,
                startPage: startPage + 1,
                endPage,
                totalPages,
                isLastGroup: endPage === totalPages
            };

            try {
                const groupData = await this.extractDataFromGroup(
                    base64Content,
                    selectedFields,
                    groupInfo
                );

                yield {
                    success: true,
                    data: groupData,
                    groupInfo
                };
            } catch (error) {
                yield {
                    success: false,
                    error: error.message,
                    groupInfo
                };
                break; // Stop processing if a group fails
            }
        }
    }

    // Helper to calculate group info
    calculateGroupInfo(pageNumber, totalPages, pagesPerGroup = 10) {
        const groupIndex = Math.floor((pageNumber - 1) / pagesPerGroup);
        const startPage = groupIndex * pagesPerGroup + 1;
        const endPage = Math.min(startPage + pagesPerGroup - 1, totalPages);
        
        return {
            groupIndex,
            startPage,
            endPage,
            totalPages,
            isLastGroup: endPage === totalPages
        };
    }
}