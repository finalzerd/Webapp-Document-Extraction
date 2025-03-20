export class FileUploader {
    constructor(config = {}) {
        // Default configuration with overrides
        this.config = {
            maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
            maxTotalSize: config.maxTotalSize || 100 * 1024 * 1024,
            maxTotalFiles: config.maxTotalFiles || 10,
            allowedFileType: config.allowedFileType || 'application/pdf',
            onError: config.onError || (error => console.error(error)),
            onProgress: config.onProgress || (() => {})
        };
    }

    async handleFiles(files) {
        try {
            const filesArray = Array.from(files);
            console.log('Processing files:', filesArray.map(f => f.name));

            if (!this.validateFiles(filesArray)) {
                return null;
            }

            // Convert each file to base64 and report progress
            const base64Results = await Promise.all(
                filesArray.map(async (file, index) => {
                    const base64 = await this.convertToBase64(file);
                    
                    this.config.onProgress({
                        stage: 'conversion',
                        current: index + 1,
                        total: filesArray.length,
                        message: `Converting file ${index + 1} of ${filesArray.length}`
                    });
                    
                    return base64;
                })
            );

            // Return just the base64 data without the MIME type prefix
            return base64Results.map(result => result.split(',')[1]);
        } catch (error) {
            this.config.onError(error);
            return null;
        }
    }

    validateFiles(files) {
        if (!files || files.length === 0) {
            this.config.onError(new Error('No files selected'));
            return false;
        }

        if (files.length > this.config.maxTotalFiles) {
            this.config.onError(new Error(`Maximum ${this.config.maxTotalFiles} files allowed`));
            return false;
        }

        // Calculate total size
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > this.config.maxTotalSize) {
            this.config.onError(new Error(`Combined file size exceeds ${this.formatSize(this.config.maxTotalSize)} limit`));
            return false;
        }

        // Validate each file
        for (const file of files) {
            const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            if (!isPDF) {
                this.config.onError(new Error(`${file.name} is not a PDF file`));
                return false;
            }

            if (file.size > this.config.maxFileSize) {
                this.config.onError(new Error(`${file.name} exceeds ${this.formatSize(this.config.maxFileSize)} size limit`));
                return false;
            }
        }

        return true;
    }

    convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
        });
    }
    
    // Helper method to format file sizes
    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}