import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { VertexAI } from '@google-cloud/vertexai';
import { PDFHandler } from './PDFHandler.js';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Token usage logging function
function logTokenUsage(endpoint, input, output) {
    const inputTokens = Math.ceil(JSON.stringify(input).length / 4);
    const outputTokens = Math.ceil(output.length / 4);
    const totalTokens = inputTokens + outputTokens;
    const cost = (totalTokens / 1000) * 0.0005;

    console.log('\n' + '='.repeat(40));
    console.log(`Token Usage for ${endpoint}`);
    console.log('-'.repeat(40));
    console.log(`Input Tokens: ${inputTokens}`);
    console.log(`Output Tokens: ${outputTokens}`);
    console.log(`Total Tokens: ${totalTokens}`);
    console.log(`Estimated Cost: $${cost.toFixed(6)}`);
    console.log('='.repeat(40) + '\n');
}

// Load and verify credentials
const credentials = JSON.parse(
    await readFile(new URL('./config/google-credentials.json', import.meta.url))
);
console.log('Loaded Google Cloud credentials for project:', credentials.project_id);

const app = express();
const pdfHandler = new PDFHandler();

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '100mb' })); // Increased limit to 100MB
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Vertex AI
let vertex_ai = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || credentials.project_id,
    location: 'us-central1',
    credentials: credentials
});

// Initialize generative model
let generativeModel = vertex_ai.preview.getGenerativeModel({
    model: 'gemini-1.5-flash-002',
    generationConfig: {
        'maxOutputTokens': 8192,
        'temperature': 0.7,
        'topP': 0.8,
    },
    safetySettings: [
        {
            'category': 'HARM_CATEGORY_HATE_SPEECH',
            'threshold': 'OFF',
        },
        {
            'category': 'HARM_CATEGORY_DANGEROUS_CONTENT',
            'threshold': 'OFF',
        },
        {
            'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            'threshold': 'OFF',
        },
        {
            'category': 'HARM_CATEGORY_HARASSMENT',
            'threshold': 'OFF',
        }
    ],
});

// Merge PDFs endpoint
app.post('/merge-pdfs', async (req, res) => {
    try {
        const { pdfs } = req.body;
        
        if (!pdfs || !Array.isArray(pdfs)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid input: pdfs array is required' 
            });
        }

        console.log('Server: Received merge request for', pdfs.length, 'PDFs');

        if (pdfs.length === 1) {
            return res.json({
                success: true,
                mergedPDF: pdfs[0]
            });
        }

        const mergedPDF = await pdfHandler.mergeBase64PDFs(pdfs);
        console.log('Server: PDFs merged successfully');

        return res.json({
            success: true,
            mergedPDF: mergedPDF
        });
    } catch (error) {
        console.error('Server: Merge error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to merge PDFs'
        });
    }
});

// Get page count endpoint
app.post('/get-page-count', async (req, res) => {
    try {
        const { base64Content } = req.body;
        
        if (!base64Content) {
            return res.status(400).json({ 
                success: false,
                error: 'No PDF content provided' 
            });
        }

        const pageCount = await pdfHandler.getPageCount(base64Content);
        console.log('Page count:', pageCount);

        return res.json({
            success: true,
            pageCount: pageCount
        });

    } catch (error) {
        console.error('Page count error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Suggest fields endpoint (uses first page only)
app.post('/suggest-fields', async (req, res) => {
    try {
        const { base64Content } = req.body;
        
        if (!base64Content) {
            return res.status(400).json({ 
                success: false,
                error: 'No PDF content provided' 
            });
        }

        const firstPageBase64 = await pdfHandler.getFirstPageBase64(base64Content);
        
        const request = {
            contents: [{
                role: "user",
                parts: [
                    { text: `Analyze this PDF document and identify extractable fields. Return your response in this exact JSON format, with no additional text before or after:

[
    {
        "fieldName": "field1",
        "description": "description1"
    },
    {
        "fieldName": "field2",
        "description": "description2"
    }
]

Important rules:
1. Return ONLY the JSON array, no other text
2. Use camelCase for fieldNames (no spaces)
3. Both fieldName and description must be in the same language as the document
4. Each field must have exactly these two properties: fieldName and description
5. Ensure the response is valid JSON with proper quotes and commas` },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: firstPageBase64
                        }
                    }
                ]
            }]
        };

        const response = await generativeModel.generateContent(request);
        const result = response.response.candidates[0].content.parts[0].text;
        
        logTokenUsage('suggest-fields', request.contents[0].parts[0].text, result);

        let fields;
        try {
            // Try to find a JSON array in the response
            const jsonMatch = result.match(/\[(.*?)\]/s);
            if (jsonMatch) {
                fields = JSON.parse(jsonMatch[0]);
            } else {
                // If no JSON array found, try to parse the entire response
                fields = JSON.parse(result);
            }

            // Validate the fields structure
            if (!Array.isArray(fields)) {
                throw new Error('Invalid response format: expected array of fields');
            }

            fields = fields.filter(field => 
                field && 
                typeof field === 'object' &&
                typeof field.fieldName === 'string' &&
                typeof field.description === 'string'
            );

            if (fields.length === 0) {
                throw new Error('No valid fields found in response');
            }

            console.log('Parsed fields:', fields);
        } catch (error) {
            console.error('Error parsing AI response:', error);
            console.error('Raw response:', result);
            throw new Error('Failed to parse field suggestions from AI response');
        }

        return res.json({
            success: true,
            fields: fields
        });

    } catch (error) {
        console.error('Field suggestion error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Extract data from group endpoint
app.post('/extract-data-group', async (req, res) => {
    try {
        const { base64Content, selectedFields, groupInfo } = req.body;
        
        if (!base64Content || !selectedFields || !groupInfo) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid input provided' 
            });
        }

        // Get the specific group of pages
        const groupPages = await pdfHandler.getPageGroup(base64Content, groupInfo.groupIndex);

        const requestText = `Extract the following fields from pages ${groupInfo.startPage} to ${groupInfo.endPage}: ${selectedFields.join(', ')}

Return your response in this exact JSON format, with no additional text before or after:

{
    "pages": [
        {
            "pageNumber": number,
            "fields": {
                "fieldName1": {
                    "value": "extracted value",
                    "type": "text"
                }
            }
        }
    ]
}

Rules:
1. Return ONLY the JSON object, no other text
2. Use proper JSON format with double quotes
3. For empty or not found values, use null
4. Page numbers must be actual numbers, not strings
5. Keep original field names exactly as provided
6. Use "type": "date" for date values, "text" for others`;

        const request = {
            contents: [{
                role: "user",
                parts: [
                    { text: requestText },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: groupPages.base64
                        }
                    }
                ]
            }]
        };

        const response = await generativeModel.generateContent(request);
        const result = response.response.candidates[0].content.parts[0].text;
        
        logTokenUsage('extract-data-group', requestText, result);

        let extractedData;
        try {
            // Try to find a JSON object in the response
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                extractedData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON object found in response');
            }

            // Validate the structure
            if (!extractedData.pages || !Array.isArray(extractedData.pages)) {
                throw new Error('Invalid response format: missing pages array');
            }

            // Validate each page
            extractedData.pages.forEach(page => {
                if (!page.pageNumber || !page.fields) {
                    throw new Error('Invalid page format in response');
                }
            });

            console.log('Parsed extracted data:', extractedData);
        } catch (error) {
            console.error('Error parsing AI response:', error);
            console.error('Raw response:', result);
            throw new Error('Failed to parse extracted data from AI response');
        }

        return res.json({
            success: true,
            data: extractedData,
            groupInfo: groupInfo
        });

    } catch (error) {
        console.error('Group data extraction error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            groupInfo: req.body.groupInfo
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n=== Server Started ===`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
    console.log(`Vertex AI Status: Ready`);
});

// Global error handlers
process.on('unhandledRejection', (error) => {
    console.error('=== Unhandled Rejection ===');
    console.error(error);
});

process.on('uncaughtException', (error) => {
    console.error('=== Uncaught Exception ===');
    console.error(error);
});