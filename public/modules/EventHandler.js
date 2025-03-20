export class EventHandler {
    constructor(uiController, fileUploader, apiService) {
        this.ui = uiController;
        this.fileUploader = fileUploader;
        this.apiService = apiService;
        this.state = {
            currentFile: null,
            currentBase64: null,
            selectedFields: null,
            totalPages: 0,
            extractionMode: 'field', // Default mode
            tableDataComponent: null
        };
        
        this.initialize();
    }

    initialize() {
        // Show mode selection initially
        this.ui.showModeSelection();

        // Get UI elements
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        this.attachEventListeners(dropZone, fileInput);
        this.attachCustomEvents();
    }
    
    attachEventListeners(dropZone, fileInput) {
        // File input change event
        fileInput?.addEventListener('change', e => this.handleFileSelect(e));

        // Drag and drop events
        if (dropZone) {
            dropZone.addEventListener('dragover', e => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', e => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', e => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFiles(Array.from(files));
                }
            });
        }
    }
    
    attachCustomEvents() {
        // Field selection event
        document.addEventListener('fieldsSelected', async e => {
            console.log('Fields selected:', e.detail);
            this.state.selectedFields = e.detail;
            
            if (this.state.currentBase64) {
                await this.startGroupProcessing(this.state.currentBase64, this.state.selectedFields);
            } else {
                this.ui.showError('No file data available. Please upload a file first.');
            }
        });

        // Mode selection event
        document.addEventListener('modeSelected', e => {
            console.log('Mode selected:', e.detail);
            this.state.extractionMode = e.detail;
            
            const dropZone = document.getElementById('dropZone');
            if (dropZone) {
                dropZone.style.display = 'block';
            }
        });
    }

    async handleFileSelect(e) {
        const files = e.target.files;
        if (files?.length > 0) {
            await this.handleFiles(Array.from(files));
        }
    }

    async handleFiles(files) {
        try {
            if (!files?.length) {
                throw new Error('No files selected');
            }
    
            console.log('Processing files:', files.length);
            this.ui.resetState();
            this.ui.setProcessingState(true);
            this.ui.updateFileList(files);
    
            // Convert files to base64
            const base64Array = await this.fileUploader.handleFiles(files);
            if (!base64Array) {
                throw new Error('File conversion failed');
            }
    
            // Process files according to count
            const processedPDF = base64Array.length > 1
                ? await this.processMergePDFs(base64Array)
                : base64Array[0];
    
            // Store the processed PDF
            this.state.currentBase64 = processedPDF;
    
            // Get total page count
            this.state.totalPages = await this.apiService.getPDFPageCount(processedPDF);
            console.log('Total pages:', this.state.totalPages);
    
            // Process according to selected mode
            if (this.state.extractionMode === 'field') {
                await this.startFieldExtraction(processedPDF);
            } else {
                await this.startTableExtraction(processedPDF);
            }
        } catch (error) {
            this.handleError(error);
        } finally {
            this.ui.setProcessingState(false);
        }
    }

    async processMergePDFs(base64Array) {
        console.log('Multiple PDFs detected, initiating merge...');
        try {
            const mergedPDF = await this.apiService.mergePDFs(base64Array);
            console.log('PDFs merged successfully');
            return mergedPDF;
        } catch (error) {
            console.error('Merge failed:', error);
            throw new Error(`Failed to merge PDFs: ${error.message}`);
        }
    }

    handleError(error) {
        console.error('Error processing files:', error);
        const userMessage = error.message.includes('Could not analyze') 
            ? error.message 
            : 'An error occurred while processing files. Please try again.';
        this.ui.showError(userMessage);
    }

    // Extraction methods
    async startFieldExtraction(base64Content) {
        try {
            this.ui.setProcessingState(true);
            
            console.log('Requesting field suggestions...');
            const fields = await this.apiService.suggestFields(base64Content);
            
            if (!Array.isArray(fields)) {
                throw new Error('Invalid response format: expected array of fields');
            }
            
            if (fields.length === 0) {
                throw new Error('No extractable fields were found in the document.');
            }
            
            this.ui.showFieldSelection(fields);
        } catch (error) {
            console.error('Field extraction error:', error);
            this.ui.showError(error.message);
        } finally {
            this.ui.setProcessingState(false);
        }
    }

    async startTableExtraction(base64Content) {
        try {
            this.ui.setProcessingState(true);
            
            // Show initial message
            this.ui.initializeSimpleProgress(1); // We don't know page count yet
            this.ui.updateSimpleProgress(0);
            
            // Get total page count
            const totalPages = await this.apiService.getPDFPageCount(base64Content);
            
            // Update with actual page count
            this.ui.initializeSimpleProgress(totalPages);
            
            // Initialize table component
            await this.initializeTableComponent();
            
            // Show empty table while loading
            const initialData = { pages: [] };
            this.state.tableDataComponent?.render(initialData);
            
            try {
                // Extract table data with progress updates
                if (this.apiService.extractTableDataWithProgress) {
                    // Use the streaming version if available
                    await this.apiService.extractTableDataWithProgress(
                        base64Content,
                        {
                            onStatus: (status) => {
                                this.ui.updateSimpleProgress(status.currentPage || 1);
                            },
                            onPage: (pageData) => {
                                // If we have a current page number, update progress
                                if (pageData.pageNumber) {
                                    this.ui.updateSimpleProgress(pageData.pageNumber);
                                }
                            },
                            onComplete: (tableData) => {
                                if (tableData?.pages) {
                                    this.state.tableDataComponent.render(tableData);
                                    this.ui.completeSimpleProgress(true, 'All pages processed successfully!');
                                }
                            },
                            onError: (error) => {
                                this.ui.completeSimpleProgress(false, 'Error processing pages');
                                throw error;
                            }
                        }
                    );
                } else {
                    // Regular extraction - simulate progress
                    const tableData = await this.apiService.extractTableData(base64Content);
                    
                    // Update progress to show completion
                    this.ui.completeSimpleProgress(true, 'All pages processed successfully!');
                    
                    if (tableData?.pages) {
                        this.state.tableDataComponent.render(tableData);
                    } else {
                        throw new Error('Invalid data structure received from server');
                    }
                }
            } catch (error) {
                this.ui.completeSimpleProgress(false, `Processing error: ${error.message}`);
                throw error;
            }
        } catch (error) {
            console.error('Table extraction error:', error);
            this.ui.showError(`Failed to extract tables: ${error.message}`);
        } finally {
            this.ui.setProcessingState(false);
        }
    }
    
    startProgressSimulation() {
        let currentProgress = 0;
        return setInterval(() => {
            if (currentProgress < 90) {
                currentProgress += 1;
                
                let message = 'Extracting bank statement data...';
                if (currentProgress === 20) message = 'Analyzing document structure...';
                if (currentProgress === 40) message = 'Identifying transaction data...';
                if (currentProgress === 60) message = 'Processing transactions...';
                if (currentProgress === 80) message = 'Finalizing transaction data...';
                
                this.ui.showExtractionProgress(true, message, currentProgress);
            }
        }, 500);
    }
    
    async initializeTableComponent() {
        if (!this.state.tableDataComponent) {
            try {
                const TableDataComponent = (await import('/modules/TableDataComponent.js')).TableDataComponent;
                this.state.tableDataComponent = new TableDataComponent('dataTableContainer');
            } catch (error) {
                console.error('Error initializing TableDataComponent:', error);
                throw new Error(`Failed to initialize table component: ${error.message}`);
            }
        }
    }

    /**
     * Handles processing of document groups
     * @param {string} base64Content - PDF content in base64
     * @param {Array} selectedFields - Fields selected by user
     */
    async startGroupProcessing(base64Content, selectedFields) {
        // Validate inputs
        if (!selectedFields || selectedFields.length === 0) {
            this.ui.showError('Please select at least one field to analyze.');
            return;
        }
    
        if (!base64Content) {
            this.ui.showError('No document content to process. Please upload a file first.');
            return;
        }
    
        try {
            this.ui.setProcessingState(true);
            
            // Initialize simple progress with total page count
            this.ui.initializeSimpleProgress(this.state.totalPages);
            
            try {
                // Process groups sequentially
                const groupProcessor = this.apiService.processGroups(
                    base64Content,
                    selectedFields,
                    this.state.totalPages
                );
    
                for await (const result of groupProcessor) {
                    if (!result.success) {
                        throw new Error(`Failed to process group ${result.groupInfo.groupIndex + 1}: ${result.error}`);
                    }
    
                    // Update table with results
                    this.ui.updateTableWithGroupData(result.data, result.groupInfo);
                    
                    // Update the simple progress display with the current page(s)
                    // We're using the end page of the current group as our progress indicator
                    this.ui.updateSimpleProgress(result.groupInfo.endPage);
                    
                    // If this is the last group, mark as complete
                    if (result.groupInfo.isLastGroup) {
                        this.ui.completeSimpleProgress(true);
                    }
                }
            } catch (error) {
                console.error('Error during group processing:', error);
                this.ui.showError(error.message);
                this.ui.completeSimpleProgress(false, 'Processing stopped due to an error');
            }
        } catch (error) {
            console.error('Group processing error:', error);
            this.ui.showError(error.message);
        } finally {
            this.ui.setProcessingState(false);
        }
    }
}