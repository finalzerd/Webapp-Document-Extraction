export class ApiService {
    constructor() {
        this.endpoints = {
            mergePDFs: '/merge-pdfs',
            suggestFields: '/suggest-fields',
            extractData: '/extract-data',
            getPageCount: '/get-page-count',
            extractDataGroup: '/extract-data-group'
        };
        
        this.MAX_RETRIES = 5;
        this.RETRY_DELAY = 15000; // 15 seconds in milliseconds
        this.currentProcessingGroup = 0;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async retryOperation(operation, groupInfo) {
        let lastError;
        let lastResponse;
        
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                const response = await operation();
                
                // Check if we got a response but it's not ok
                if (response instanceof Response && !response.ok) {
                    lastResponse = response;
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Server returned ${response.status}`);
                }
                
                return response;
            } catch (error) {
                lastError = error;
                
                // Special handling for connection refused
                if (error.message.includes('Failed to fetch') || 
                    error.message.includes('ERR_CONNECTION_REFUSED')) {
                    console.error(`Connection failed on attempt ${attempt}. Server might be down.`);
                    if (attempt === this.MAX_RETRIES) {
                        throw new Error('Unable to connect to server. Please check if the server is running.');
                    }
                } else {
                    console.log(`Attempt ${attempt} failed for group ${groupInfo}. Error: ${error.message}`);
                }
                
                if (attempt < this.MAX_RETRIES) {
                    console.log(`Waiting ${this.RETRY_DELAY/1000} seconds before retry...`);
                    await this.delay(this.RETRY_DELAY);
                }
            }
        }
        
        // Construct detailed error message
        let errorMessage = `All ${this.MAX_RETRIES} retry attempts failed for group ${groupInfo}.`;
        if (lastResponse) {
            errorMessage += ` Last status: ${lastResponse.status}.`;
        }
        if (lastError) {
            errorMessage += ` Last error: ${lastError.message}`;
        }
        
        throw new Error(errorMessage);
    }

    async mergePDFs(base64Array) {
        try {
            console.log('ApiService: Starting merge request for', base64Array.length, 'PDFs');
            const response = await fetch(this.endpoints.mergePDFs, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pdfs: base64Array
                })
            });

            if (!response.ok) {
                throw new Error(`Merge request failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success || !data.mergedPDF) {
                throw new Error(data.error || 'Merge response invalid');
            }

            console.log('ApiService: PDFs merged successfully');
            return data.mergedPDF;
        } catch (error) {
            console.error('ApiService: Merge error:', error);
            throw error;
        }
    }
    
    async getPDFPageCount(base64Content) {
        return await this.retryOperation(async () => {
            console.log('Getting page count...');
            const response = await fetch(this.endpoints.getPageCount, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    base64Content: base64Content
                })
            });
    
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
    
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to get page count');
            }
    
            console.log('Page count retrieved:', data.pageCount);
            return data.pageCount;
        }, 'page count');
    }

    async suggestFields(base64Content) {
        return await this.retryOperation(async () => {
            const response = await fetch(this.endpoints.suggestFields, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    base64Content: base64Content
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Unknown error occurred');
            }

            return data.fields;
        }, 'field suggestion');
    }

    async extractDataFromGroup(base64Content, selectedFields, groupInfo) {
        return await this.retryOperation(async () => {
            console.log(`Extracting data for group ${groupInfo.groupIndex + 1}`);
            
            const response = await fetch(this.endpoints.extractDataGroup, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    base64Content,
                    selectedFields,
                    groupInfo
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }
            
            if (!data.success) {
                throw new Error(data.error || 'Unknown error occurred');
            }

            return data.data;
        }, `group ${groupInfo.groupIndex + 1}`);
    }

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
                // Stop processing if a group fails
                break;
            }
        }
    }

    calculateGroupInfo(pageNumber, totalPages) {
        const PAGES_PER_GROUP = 10;
        const groupIndex = Math.floor((pageNumber - 1) / PAGES_PER_GROUP);
        const startPage = groupIndex * PAGES_PER_GROUP + 1;
        const endPage = Math.min(startPage + PAGES_PER_GROUP - 1, totalPages);
        
        return {
            groupIndex,
            startPage,
            endPage,
            totalPages,
            isLastGroup: endPage === totalPages
        };
    }
}