export class EventHandler {
    constructor(uiController, fileUploader, apiService) {
        this.ui = uiController;
        this.fileUploader = fileUploader;
        this.apiService = apiService;
        this.currentFile = null;
        this.currentBase64 = null;
        this.selectedFields = null;
        this.totalPages = 0;
        this.extractionMode = 'field'; // Default mode
        this.tableDataComponent = null;
        this.initialize();
    }

    initialize() {

        // Show mode selection initially
        this.ui.showModeSelection();

        // Get UI elements
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        // File input change event
        fileInput.addEventListener('change', (e) => {
            console.log('File input change event triggered');
            this.handleFileSelect(e);
        });

        // Drag and drop events
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            console.log('File drop event triggered');
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFiles(Array.from(files));
            }
        });

        // Field selection event
        document.addEventListener('fieldsSelected', async (e) => {
            console.log('Fields selected event received:', e.detail);
            this.selectedFields = e.detail;
            if (this.currentBase64) {
                console.log('Starting group processing...');
                await this.startGroupProcessing(this.currentBase64, this.selectedFields);
            } else {
                console.error('No file data available');
                this.ui.showError('No file data available. Please upload a file first.');
            }
        });

        // Mode selection event
        document.addEventListener('modeSelected', (e) => {
            console.log('Mode selected event received:', e.detail);
            this.extractionMode = e.detail;

            if (dropZone) {
                dropZone.style.display = 'block';
            }
            
        });
    }

    async handleFileSelect(e) {
        const files = e.target.files;
        if (files && files.length > 0) {
            await this.handleFiles(Array.from(files));
        }
    }

    async handleFiles(files) {
        try {
            if (!files || files.length === 0) {
                throw new Error('No files selected');
            }
    
            console.log('Starting files processing:', files.length);
            this.ui.resetState();
            this.ui.setProcessingState(true);
            this.ui.updateFileList(files);
    
            // Convert files to base64
            console.log('Converting files to base64...');
            const base64Array = await this.fileUploader.handleFiles(files);
            
            if (!base64Array) {
                throw new Error('File conversion failed');
            }
    
            // Handle multiple PDFs
            let processedPDF;
            if (base64Array.length > 1) {
                console.log('Multiple PDFs detected, initiating merge...');
                try {
                    processedPDF = await this.apiService.mergePDFs(base64Array);
                    console.log('PDFs merged successfully');
                } catch (mergeError) {
                    console.error('Merge failed:', mergeError);
                    throw new Error(`Failed to merge PDFs: ${mergeError.message}`);
                }
            } else {
                processedPDF = base64Array[0];
            }
    
            // Store the processed PDF
            this.currentBase64 = processedPDF;

            // Get total page count
            this.totalPages = await this.apiService.getPDFPageCount(this.currentBase64);
            console.log('Total pages:', this.totalPages);

            // Show mode selection instead of immediately getting field suggestions
            
            // Process according to selected mode
            if (this.extractionMode === 'field') {
                await this.startFieldExtraction(this.currentBase64);
            } else {
                await this.startTableExtraction(this.currentBase64);
            }

            // Get field suggestions from first page
            console.log('Requesting field suggestions...');
            try {
                const fields = await this.apiService.suggestFields(this.currentBase64);
                console.log('Received fields:', fields);
                
                if (!Array.isArray(fields)) {
                    throw new Error('Invalid response format: expected array of fields');
                }
                
                if (fields.length === 0) {
                    throw new Error('No extractable fields were found in the document.');
                }
                
                this.ui.showFieldSelection(fields);
            } catch (error) {
                console.error('Field suggestion error:', error);
                throw new Error(`Could not analyze document fields: ${error.message}`);
            }



        } catch (error) {
            console.error('Error processing files:', error);
            const userMessage = error.message.includes('Could not analyze') 
                ? error.message 
                : 'An error occurred while processing files. Please try again.';
            this.ui.showError(userMessage);
        } finally {
            this.ui.setProcessingState(false);
        }
    }

    // Split field extraction logic from handleFiles into its own method
    async startFieldExtraction(base64Content) {
        try {
            this.ui.setProcessingState(true);
            
            // Get field suggestions from first page
            console.log('Requesting field suggestions...');
            try {
                const fields = await this.apiService.suggestFields(base64Content);
                console.log('Received fields:', fields);
                
                if (!Array.isArray(fields)) {
                    throw new Error('Invalid response format: expected array of fields');
                }
                
                if (fields.length === 0) {
                    throw new Error('No extractable fields were found in the document.');
                }
                
                this.ui.showFieldSelection(fields);
            } catch (error) {
                console.error('Field suggestion error:', error);
                throw new Error(`Could not analyze document fields: ${error.message}`);
            }
        } catch (error) {
            console.error('Error in field extraction:', error);
            this.ui.showError(error.message);
        } finally {
            this.ui.setProcessingState(false);
        }
    }

    // Add a new method for table extraction
    async startTableExtraction(base64Content) {
        try {
            this.ui.setProcessingState(true);
            
            // Show extraction progress with initial status
            this.ui.showExtractionProgress(true, 'Preparing to extract bank statement data...', 0);
            
            console.log('Starting table extraction...');
            
            // Get the total page count
            const totalPages = await this.apiService.getPDFPageCount(base64Content);
            
            // Simulate progress during extraction
            let currentProgress = 0;
            let statusMessages = [
                'Analyzing document structure...',
                'Identifying table headers...',
                'Extracting transaction data...',
                'Processing transaction rows...',
                'Finalizing bank statement data...'
            ];
            
            // Start progress animation
            const progressInterval = setInterval(() => {
                // Increment progress up to 90% (save the last 10% for completion)
                if (currentProgress < 90) {
                    currentProgress += 1;
                    
                    // Update status message at certain points
                    if (currentProgress === 20) {
                        this.ui.showExtractionProgress(true, statusMessages[1], currentProgress);
                    } else if (currentProgress === 40) {
                        this.ui.showExtractionProgress(true, statusMessages[2], currentProgress);
                    } else if (currentProgress === 60) {
                        this.ui.showExtractionProgress(true, statusMessages[3], currentProgress);
                    } else if (currentProgress === 80) {
                        this.ui.showExtractionProgress(true, statusMessages[4], currentProgress);
                    }
                    
                    this.ui.showExtractionProgress(true, null, currentProgress);
                }
            }, 500); // Update every 500ms
            
            try {
                // Extract table data (this might take a while)
                const tableData = await this.apiService.extractTableData(base64Content);
                
                // Stop the progress animation
                clearInterval(progressInterval);
                
                // Show 100% complete
                this.ui.showExtractionProgress(true, 'Bank statement data extracted successfully!', 100);
                
                // Initialize table data component if needed
                if (!this.tableDataComponent) {
                    const TableDataComponent = (await import('/modules/TableDataComponent.js')).TableDataComponent;
                    this.tableDataComponent = new TableDataComponent('dataTableContainer');
                }
                
                // Render the table data
                this.tableDataComponent.render(tableData);
                
                console.log('Table extraction complete');
                
                // Hide progress after a short delay
                setTimeout(() => {
                    this.ui.showExtractionProgress(false);
                }, 2000);
                
            } catch (error) {
                // Stop the progress animation on error
                clearInterval(progressInterval);
                throw error;
            }
        } catch (error) {
            console.error('Error in table extraction:', error);
            this.ui.showError(`Failed to extract tables: ${error.message}`);
            // Hide progress on error
            this.ui.showExtractionProgress(false);
        } finally {
            this.ui.setProcessingState(false);
        }
    }

    async startGroupProcessing(base64Content, selectedFields) {
        if (!selectedFields || selectedFields.length === 0) {
            this.ui.showError('Please select at least one field to analyze.');
            return;
        }

        try {
            this.ui.setProcessingState(true);
            
            const PAGES_PER_GROUP = 10;
            const totalGroups = Math.ceil(this.totalPages / PAGES_PER_GROUP);
            
            // Initialize group progress tracking
            this.ui.initializeGroupProgress(totalGroups);

            // Process groups sequentially
            const groupProcessor = this.apiService.processGroups(
                base64Content,
                selectedFields,
                this.totalPages
            );

            for await (const result of groupProcessor) {
                if (!result.success) {
                    throw new Error(`Failed to process group ${result.groupInfo.groupIndex + 1}: ${result.error}`);
                }

                // Update UI with group results
                this.ui.updateTableWithGroupData(result.data, result.groupInfo);
                
                // Update status
                this.ui.setGroupStatus(
                    `Completed group ${result.groupInfo.groupIndex + 1} of ${totalGroups}`
                );

                if (result.groupInfo.isLastGroup) {
                    this.ui.setGroupStatus('All groups processed successfully!');
                }
            }

        } catch (error) {
            console.error('Error in group processing:', error);
            this.ui.showError(error.message);
        } finally {
            this.ui.setProcessingState(false);
        }
    }

    createProgressTracker(totalSteps) {
        let currentStep = 0;
        return {
            updateProgress: (message) => {
                currentStep++;
                this.ui.updateProgress({
                    stage: 'processing',
                    current: currentStep,
                    total: totalSteps,
                    message: message
                });
            },
            complete: () => {
                this.ui.updateProgress({
                    stage: 'complete',
                    current: totalSteps,
                    total: totalSteps,
                    message: 'Processing complete'
                });
            }
        };
    }
}