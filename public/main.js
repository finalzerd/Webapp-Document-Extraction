import { FileUploader } from '/modules/FileUploader.js';
import { UIController } from '/modules/UIController.js';
import { EventHandler } from '/modules/EventHandler.js';
import { ApiService } from '/modules/ApiService.js';

// Configuration
const CONFIG = {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxTotalFiles: 10,
    allowedFileType: 'application/pdf'
};

// Initialize application
function initializeApp() {
    try {
        console.log('Initializing application...');
        
        // Create instances
        const uiController = new UIController();
        console.log('UI Controller initialized');

        const fileUploader = new FileUploader({
            maxFileSize: CONFIG.maxFileSize,
            maxTotalFiles: CONFIG.maxTotalFiles,
            allowedFileType: CONFIG.allowedFileType,
            onError: (error) => uiController.showError(error.message),
            onProgress: (progress) => uiController.updateProgress(progress)
        });
        console.log('File Uploader initialized');

        const apiService = new ApiService();
        console.log('API Service initialized');

        const eventHandler = new EventHandler(uiController, fileUploader, apiService);
        console.log('Event Handler initialized');

    } catch (error) {
        console.error('Error initializing application:', error);
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);