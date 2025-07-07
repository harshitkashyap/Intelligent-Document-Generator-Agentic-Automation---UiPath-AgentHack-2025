import React, { useState, useCallback, useRef, useEffect } from 'react';



// --- Helper Functions for Table Manipulation ---

/**
 * Parses the inner HTML string of a table into a structured object.
 * This simplified parser assumes a basic <thead> and <tbody> structure
 * and extracts innerHTML of <th> and <td> for content.
 * It does NOT parse name/description from existing HTML, as those are state-managed properties.
 * @param {string} htmlString - The inner HTML content of the <table> tag.
 * @returns {{headers: Array<{content: string, name: string, description: string}>, bodyRows: string[][]}} Structured table data.
 */
const parseTableHtml = (htmlString) => {
    // Create a temporary DOM element to parse the HTML string
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<table>${htmlString}</table>`, 'text/html');
    const table = doc.querySelector('table');

    if (!table) {
        return { headers: [], bodyRows: [] };
    }

    const headers = [];
    const headerRow = table.querySelector('thead tr');
    if (headerRow) {
        // Extract inner HTML of each th element, default name/description
        Array.from(headerRow.children).forEach((th, index) => {
            headers.push({
                content: th.innerHTML,
                name: `Column ${index + 1}`, // Default name on parse, will be overwritten by stored tableDataState
                description: `Description for column ${index + 1}`, // Default description on parse, will be overwritten
            });
        });
    }

    const bodyRows = [];
    const tbody = table.querySelector('tbody');
    if (tbody) {
        // Extract inner HTML of each td element in each tr
        Array.from(tbody.children).forEach(tr => {
            const row = [];
            Array.from(tr.children).forEach(td => {
                row.push(td.innerHTML);
            });
            bodyRows.push(row);
        });
    }

    return { headers, bodyRows };
};

/**
 * Generates the inner HTML string for a <table> tag from structured table data.
 * It applies basic border and padding styles to cells for visibility.
 * It now also includes HTML comments for column name and description.
 * It now dynamically sets column widths to fill the table.
 * @param {{headers: Array<{content: string, name: string, description: string}>, bodyRows: string[][]}} tableData - Structured table data.
 * @returns {string} The inner HTML content for the <table> tag.
 */
const generateTableHtml = ({ headers, bodyRows }) => {
    let html = '\n'; // Start with a newline for better formatting in exported HTML

    // Calculate column width percentage
    const columnCount = headers.length;
    const columnWidth = columnCount > 0 ? `${100 / columnCount}%` : 'auto'; // Divide 100% evenly

    // Generate table header (<thead>)
    if (headers.length > 0) {
        html += '                <thead>\n                    <tr>\n';
        headers.forEach(column => {
            if (column.name) {
                html += `                        <!-- {{SPLIT}}##Column Name##:${column.name.trim().replace(" ","_")}:##Column Name## -->\n`;
            }
            if (column.description) {
                html += `                        <!-- ##Column Description##:${column.description}:##Column Description## -->\n`;
            }
            // Apply calculated width to each header
            html += `                        <!-- ##Column Value##:${column.content}:##Column Value## -->\n <th style="border: 1px solid #ccc; padding: 8px; width: ${columnWidth};">${column.content}</th>\n`;
        });
        html += '                    </tr>\n                </thead>\n';
    }

    // Generate table body (<tbody>)
    if (bodyRows.length > 0) {
        html += '                <tbody>\n';
        bodyRows.forEach(row => {
            html += '                    <tr>\n';
            row.forEach(cell => {
                // Apply calculated width to each data cell as well for consistency
                html += `                        <td style="border: 1px solid #ccc; padding: 8px; width: ${columnWidth};">${cell}</td>\n`;
            });
            html += '                    </tr>\n';
        });
        html += '                </tbody>\n';
    }
    return html;
};




// Main App component
const App = () => {
    // State to store all elements on the canvas
    const [canvasElements, setCanvasElements] = useState([]);
    // State to store the ID of the currently selected element for property editing
    const [selectedElementId, setSelectedElementId] = useState(null);
    // State to store the type of element currently being dragged from the sidebar
    const [draggedElementType, setDraggedElementType] = useState(null);
    // State for dynamic canvas height based on width
    const [canvasHeight, setCanvasHeight] = useState('600px'); // Initial default height

    // States for export file name and location
    const [fileName, setFileName] = useState('');
    const [fileLocation, setFileLocation] = useState('');

    const [message, setMessage] = useState(null);
    const [messageType, setMessageType] = useState(null);


    // Ref for the canvas element to calculate drop position and current width
    const canvasRef = useRef(null);

    // Get the currently selected element object
    const selectedElement = canvasElements.find(el => el.id === selectedElementId);

    // Effect to update canvas height when its width changes
    useEffect(() => {
        const updateCanvasDimensions = () => {
            if (canvasRef.current) {
                const currentWidth = canvasRef.current.offsetWidth;
                setCanvasHeight(`${currentWidth * 2}px`); // Set height to double the current width
            }
        };

        // Set initial dimensions on component mount
        updateCanvasDimensions();

        // Add resize listener to window to update dimensions dynamically
        window.addEventListener('resize', updateCanvasDimensions);

        // Cleanup: remove event listener when component unmounts
        return () => {
            window.removeEventListener('resize', updateCanvasDimensions);
        };
    }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount



    // --- Drag and Drop Handlers ---

    /**
     * Handles the start of a drag operation from the sidebar.
     * Stores the type of the element being dragged.
     * @param {string} type - The type of HTML element (e.g., 'div', 'p', 'h1').
     */
    const handleDragStartSidebar = useCallback((e, type) => {
        setDraggedElementType(type);
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    /**
     * Handles the drag over event on the canvas.
     * Prevents default to allow dropping.
     */
    const handleDragOverCanvas = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    /**
     * Handles the drop event on the canvas.
     * Creates a new element on the canvas at the drop position.
     * @param {Object} e - The drag event object.
     */
    const handleDropCanvas = useCallback((e) => {
        e.preventDefault();
        if (!draggedElementType) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        const dropX = e.clientX - canvasRect.left;
        const dropY = e.clientY - canvasRect.top;

        // Generate a unique ID for the new element
        const newId = `element-${Date.now()}`;

        // Define initial styles and content based on element type
        let initialStyles = {
            position: 'absolute',
            left: `${dropX}px`, // Default left position based on drop
            top: `${dropY}px`,
            minWidth: '50px',
            minHeight: '30px',
            padding: '8px',
            backgroundColor: '#ffffff',
            color: '#333333',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            display: 'flex', // Default to flex for easier alignment
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            flexDirection: 'row',
        };
        let initialContent = `New ${draggedElementType}`;
        let initialName = `My ${draggedElementType}`;
        let initialDescription = `This is a new ${draggedElementType} element.`;
        let initialTableData = null; // Initialize tableDataState for non-table elements

        // Specific initial settings for certain element types
        if (draggedElementType === 'img') {
            initialContent = ''; // Image has no text content
            initialStyles = {
                ...initialStyles,
                width: '100px',
                height: '100px',
                border: '1px solid #ddd',
                backgroundColor: '#f0f0f0',
                display: 'block', // Images are block elements
                objectFit: 'contain',
                src: 'https://placehold.co/100x100/A0A0A0/FFFFFF?text=Image', // Placeholder image
            };
        } else if (draggedElementType === 'div') {
            initialStyles = {
                ...initialStyles,
                minWidth: '200px',
                minHeight: '100px',
                backgroundColor: '#e0e7ff', // Light blue background for containers
                border: '1px dashed #99aaff',
                display: 'flex',
                flexDirection: 'column', // Divs often stack content
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
            };
        } else if (draggedElementType === 'table') {
            // Initial table data structure with NO columns or rows
            initialTableData = {
                headers: [],
                bodyRows: [],
            };
            initialContent = ''; // Content is derived from tableDataState now
            initialStyles = {
                ...initialStyles,
                left: 'auto', // Allow browser to calculate left, or set explicitly later
                right: '0px', // Force table to extreme right
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: '300px', // Ensures it's at least 300px wide
                backgroundColor: '#f9f9f9',
                border: '1px solid #ccc',
                display: 'block', // Tables are block elements
            };
            initialName = 'New Table';
            initialDescription = 'An empty table. Use column controls to add headers and rows.';
        } else if (draggedElementType === 'hr') {
            initialContent = ''; // HR has no content
            initialName = 'Horizontal Line';
            initialDescription = 'A horizontal rule for separating content.';
            initialStyles = {
                position: 'absolute',
                left: `${dropX}px`,
                top: `${dropY}px`,
                width: '150px',
                height: '2px', // Represents thickness
                backgroundColor: '#333333', // Default color
                border: 'none', // Remove default HR border
                margin: '0', // Reset margin
            };
        } else if (draggedElementType === 'vline') {
            initialContent = ''; // VLine (div) has no content
            initialName = 'Vertical Line';
            initialDescription = 'A vertical line for visual separation.';
            initialStyles = {
                position: 'absolute',
                left: `${dropX}px`,
                top: `${dropY}px`,
                width: '2px', // Represents thickness
                height: '100px', // Represents length
                backgroundColor: '#333333', // Default color
                border: 'none',
            };
        }

        // Add the new element to the canvasElements state
        setCanvasElements(prevElements => [
            ...prevElements,
            {
                id: newId,
                type: draggedElementType,
                content: initialContent,
                name: initialName, // Add name
                description: initialDescription, // Add description
                styles: initialStyles,
                tableDataState: initialTableData, // Store structured table data here
            }
        ]);
        setSelectedElementId(newId); // Select the newly added element
        setDraggedElementType(null); // Reset dragged element type
    }, [draggedElementType]);

    /**
     * Handles clicking on an element on the canvas to select it.
     * @param {string} id - The ID of the element to select.
     */
    const handleSelectElement = useCallback((id) => {
        setSelectedElementId(id);
    }, []);

    /**
     * Handles updating the properties (content or styles) of a selected element.
     * @param {string} id - The ID of the element to update.
     * @param {Object} updates - An object containing content or style updates.
     */
    const handleUpdateElementProperties = useCallback((id, updates) => {
        setCanvasElements(prevElements =>
            prevElements.map(el => {
                if (el.id === id) {
                    return {
                        ...el,
                        ...updates, // Apply content, name, description, tableDataState updates directly
                        styles: { ...el.styles, ...updates.styles } // Merge style updates
                    };
                }
                return el;
            })
        );
    }, []);

    /**
     * Handles moving an element already on the canvas.
     * This allows dragging existing elements to new positions.
     * @param {Object} e - The drag event object.
     * @param {string} id - The ID of the element being moved.
     */
    const handleElementDrag = useCallback((id, e) => {
        // Only allow dragging if not currently resizing
        if (e.target.dataset.resizing === "true") {
            e.preventDefault();
            return;
        }

        const element = canvasElements.find(el => el.id === id);
        if (!element) return;

        const elRect = e.target.getBoundingClientRect();
        const offsetX = e.clientX - elRect.left;
        const offsetY = e.clientY - elRect.top;

        // Set data to be transferred, e.g., element ID and offset
        e.dataTransfer.setData('text/plain', JSON.stringify({ id, offsetX, offsetY }));
        e.dataTransfer.effectAllowed = 'move';
    }, [canvasElements]);

    /**
     * Handles dropping an element that was already on the canvas to a new position.
     * @param {Object} e - The drag event object.
     */
    const handleElementDropOnCanvas = useCallback((e) => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const { id, offsetX, offsetY } = data;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        // Calculate new position based on mouse position minus initial offset
        const newX = e.clientX - canvasRect.left - offsetX;
        const newY = e.clientY - canvasRect.top - offsetY;

        handleUpdateElementProperties(id, {
            styles: {
                left: `${newX}px`,
                top: `${newY}px`,
            }
        });
    }, [handleUpdateElementProperties]);

    /**
     * Handles deleting an element from the canvas.
     * @param {string} id - The ID of the element to delete.
     */
    const handleDeleteElement = useCallback((id) => {
        setCanvasElements(prevElements => prevElements.filter(el => el.id !== id));
        setSelectedElementId(null); // Deselect after deletion
    }, []);


    /**
     * Generates and exports the HTML code based on the current canvas elements.
     */
    const handleExportHTML = useCallback(() => {
        let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated HTML Template</title>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f4f7fa;
            color: #333;
        }
        .canvas-container {
            position: relative;
            width: 100%;
            height: auto; /* Adjust height dynamically or set a min-height */
            min-height: 1500px;
            background-color: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden; /* Hide anything outside its bounds */
        }
    </style>
</head>
<body>
    <div class="canvas-container">
`;

        let jsonContentString = {};

        jsonContentString.header = htmlContent;
        jsonContentString.elements = [];

        // Iterate through canvas elements and convert them to HTML tags
        canvasElements.forEach(element => {
            const { type, content, styles, name, description, tableDataState } = element; // Destructure new properties

            let jsonContentElement = {};

            // Add comments for name and description
            if (name) {
                //htmlContent += `        <!-- Element Name: ${name} -->\n`;

                htmlContent += `        <!-- Element Name: ${name.trim().replace(" ","_")} -->\n`;

                jsonContentElement.name = name.trim().replace(" ","_");
            }
            if (description) {
              //  htmlContent += `        <!-- Description: ${description} -->\n`;

               htmlContent += `        <!-- Description: ${description} -->\n`;

                jsonContentElement.description = description;

            }

            // Convert inline styles to a CSS string
            const styleString = Object.entries(styles)
                .filter(([key]) => !['minWidth', 'minHeight'].includes(key)) // Filter out minWidth/minHeight from inline styles
                .map(([key, value]) => {
                    // Convert camelCase to kebab-case for CSS properties
                    const cssKey = key.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
                    return `${cssKey}: ${value};`;
                })
                .join(' ');

            if (type === 'img') {
                htmlContent += `        <img src="${styles.src}" alt="Generated Image" style="${styleString}">\n`;

                jsonContentElement.type = 'img';
                jsonContentElement.content = `        <img src="${styles.src}" alt="Generated Image" style="${styleString}">\n`;

            } else if (type === 'hr') {

                htmlContent += `        <hr style="${styleString}">\n`;

                jsonContentElement.type =  'hr';
                jsonContentElement.content = `        <hr style="${styleString}">\n`;

            } else if (type === 'vline') {
                // VLine is a div with specific styles to make it a line
                htmlContent += `        <div style="${styleString}"></div>\n`;

                jsonContentElement.type = 'vline';
                jsonContentElement.content = `        <div style="${styleString}"></div>\n`;

            } else if (type === 'table') {
                // For tables, use tableDataState to generate the HTML
                htmlContent += `        <table style="${styleString}">${generateTableHtml(tableDataState)}</table>\n`;

                jsonContentElement.type = 'table';
                jsonContentElement.content = `        <table style="${styleString}">{{##Value##}}</table>\n`;

                jsonContentElement.columns = []; // Initialize rows array

                generateTableHtml(tableDataState).split('{{SPLIT}}').forEach(line => {


                    if (line.trim().includes('##Column Name##:')) {

                        let jsonContentColumn = {};
                        jsonContentColumn.type = 'column';

                        jsonContentColumn.columnName = line.substring(
                                  line.indexOf("##Column Name##:")+ 16, 
                                  line.lastIndexOf(":##Column Name##")
                              );

                        jsonContentColumn.columnDescription = line.substring(
                                  line.indexOf("##Column Description##:") + 23, 
                                  line.lastIndexOf(":##Column Description##")
                              );

                        jsonContentColumn.columnValue = line.substring(
                                  line.indexOf("##Column Value##:") + 17, 
                                  line.lastIndexOf(":##Column Value##")
                              );

                        jsonContentColumn.columnContent = `<th style="border: 1px solid #ccc; padding: 8px;">{{##Value##}}</th>\n`;
                              
                        jsonContentElement.columns.push(jsonContentColumn);

                    }
                  });
                
            }
            else {
                // For div, p, h1, etc.
                htmlContent += `        <${type} style="${styleString}">${content}</${type}>\n`;

                jsonContentElement.type = type;
                jsonContentElement.content = `        <${type} style="${styleString}">{{##Value##}}</${type}>\n`;
                jsonContentElement.value = content; // Store the value separately
            }

            jsonContentString.elements.push(jsonContentElement);
            htmlContent += `\n`; // Add a newline for better readability between elements


        });

        jsonContentString.footer = `</div>
</body>
</html>`;

        htmlContent += `    </div>
</body>
</html>`;

        jsonContentString.name = fileName;
        jsonContentString.description = fileLocation;
       


        let jsonContent = JSON.stringify(jsonContentString, null, 2);

        const apiUrl = 'http://localhost:8080/proxy-post-api';
        const payload = {
                "itemData": {
                    
                    "Priority": "Normal",
                    "Name": "Document Template Queue",
                    "SpecificContent": {
                        
                        "tempName": fileName,
                        "tempDescription": fileLocation,
                        "tempHTML": htmlContent,
                        "tempJSON": jsonContent
                        
                    }
                    
                }
            };

        const addTemplate = async () => {
                    try {
                        
                         const response = await fetch(apiUrl, {
                            method: 'POST', // Specify the HTTP method as POST
                            headers: {
                                'Content-Type': 'application/json' // Indicate that we are sending JSON data
                            },
                            body: JSON.stringify(payload) // Convert the JavaScript object to a JSON string
                        });


                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`);
                       }

                        //const data = await response.json();
                        console.log("Access Token received successfully!");
                       // return JSON.stringify(response);
                       setMessageType('success');
                       setMessage("Template Created Succesfully!");
                       // return data.access_token;

                        
                    
                    } catch (error) {
                        console.error("Error getting access token:", error);
                        setMessageType('error');
                        setMessage("Error Creating Template: " + error.message);
                       // return "Error getting access token:" +error.message;
                    } 
                    };

        addTemplate();

        
        
       


    }, [canvasElements, fileName, fileLocation]);

    

    return (
        <div className="flex h-screen bg-gray-100 font-inter">
            {/* Sidebar for Draggable Elements */}
            <div className="w-64 bg-white p-6 shadow-lg flex flex-col rounded-r-lg">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Elements</h2>
                <div className="space-y-4">
                    {/* Added 'hr' and 'vline' to the list of draggable types */}
                    {['div', 'p', 'h1', 'img', 'table', 'hr', 'vline'].map(type => (
                        <div
                            key={type}
                            draggable
                            onDragStart={(e) => handleDragStartSidebar(e, type)}
                            className="p-3 bg-blue-500 text-white text-lg font-medium rounded-md shadow-md cursor-grab
                                        hover:bg-blue-600 transition duration-200 ease-in-out
                                        flex items-center justify-center transform hover:scale-105"
                        >
                            {type === 'hr' ? 'HR (Line)' : type === 'vline' ? 'VLine (Line)' : type.charAt(0).toUpperCase() + type.slice(1)}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 flex flex-col items-center p-8 overflow-auto">
                <h1 className="text-3xl font-extrabold mb-8 text-gray-900">Document Template Builder</h1>

                {/* Canvas Container */}
                <div
                    ref={canvasRef}
                    onDragOver={handleDragOverCanvas}
                    onDrop={handleDropCanvas}
                    style={{ height: canvasHeight }} /* Apply dynamic height */
                    className="relative w-full max-w-4xl bg-white border-2 border-dashed border-gray-300
                                rounded-xl shadow-inner overflow-hidden p-4 mb-8"
                >
                    {/* Render Canvas Elements */}
                    {canvasElements.map(element => (
                        <CanvasElement
                            key={element.id}
                            element={element}
                            isSelected={selectedElementId === element.id}
                            onSelect={handleSelectElement}
                            onDragStart={handleElementDrag} // Enable dragging of existing elements
                            onUpdateElementStyles={handleUpdateElementProperties} // Pass update function
                        />
                    ))}
                    {/* Message if canvas is empty */}
                    {canvasElements.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xl pointer-events-none">
                            Drag and Drop Elements Here
                        </div>
                    )}
                </div>

                {/* Export Controls */}
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 w-full max-w-4xl mb-8">
                    <div className="flex-1">
                        <label htmlFor="fileName" className="block text-gray-700 text-sm font-semibold mb-1">Template Name:</label>
                        <input
                            type="text"
                            id="fileName"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            placeholder="Enter Template Name"
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="fileLocation" className="block text-gray-700 text-sm font-semibold mb-1">Description:</label>
                        <input
                            type="text"
                            id="fileLocation"
                            value={fileLocation}
                            onChange={(e) => setFileLocation(e.target.value)}
                            placeholder="Enter Document Description in Brief"
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Export Button */}
                <button
                    onClick={handleExportHTML}
                    className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-lg
                                hover:bg-green-700 transition duration-300 ease-in-out transform hover:scale-105"
                >
                    Create Template
                </button>

                    {/* Message Success */}
                    {message && (
                     <div className={`mt-4 p-3 rounded-md text-center text-white
                      ${messageType === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {message}
                    </div>
                    )}


            </div>

            {/* Properties Panel */}
            <div className="w-80 bg-white p-6 shadow-lg flex flex-col rounded-l-lg overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Properties</h2>
                {selectedElement ? (
                    <PropertiesPanel
                        element={selectedElement}
                        onUpdate={handleUpdateElementProperties}
                        onDelete={handleDeleteElement} // Pass the delete function
                    />
                ) : (
                    <p className="text-gray-500 text-lg">Select an element on the canvas to edit its properties.</p>
                )}
            </div>
        </div>
    );
};

// Helper to parse CSS pixel values to numbers
const parsePx = (value) => parseFloat(value) || 0;

// CanvasElement Component: Represents a single element on the canvas
const CanvasElement = ({ element, isSelected, onSelect, onDragStart, onUpdateElementStyles }) => {
    const { id, type, content, styles, tableDataState } = element; // Destructure tableDataState

    const elementRef = useRef(null);
    const [isResizing, setIsResizing] = useState(null); // Stores direction of resize ('bottom-right', 'top-left', etc.)
    const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 });
    const [initialElementRect, setInitialElementRect] = useState({ width: 0, height: 0, left: 0, top: 0 });

    // Dynamic class for selected state
    const selectedClass = isSelected ? 'border-2 border-blue-500 shadow-xl' : 'hover:border-blue-300';

    /**
     * Handles the start of a resize operation.
     * @param {Object} e - The mouse event.
     * @param {string} direction - The direction of resize (e.g., 'bottom-right').
     */
    const handleResizeStart = useCallback((e, direction) => {
        e.stopPropagation(); // Prevent element selection from triggering
        setIsResizing(direction);
        setInitialMousePos({ x: e.clientX, y: e.clientY });

        const currentElement = elementRef.current;
        if (currentElement) {
            setInitialElementRect({
                width: currentElement.offsetWidth, // Use offsetWidth/Height for current rendered size
                height: currentElement.offsetHeight,
                left: parsePx(element.styles.left),
                top: parsePx(element.styles.top),
            });
        }
    }, [element.styles]);

    // Effect to add and remove global mouse event listeners for resizing
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - initialMousePos.x;
            const deltaY = e.clientY - initialMousePos.y;

            let newWidth = initialElementRect.width;
            let newHeight = initialElementRect.height;
            let newLeft = initialElementRect.left;
            let newTop = initialElementRect.top;

            switch (isResizing) {
                case 'bottom-right':
                    newWidth = initialElementRect.width + deltaX;
                    newHeight = initialElementRect.height + deltaY;
                    break;
                case 'bottom-left':
                    newWidth = initialElementRect.width - deltaX;
                    newHeight = initialElementRect.height + deltaY;
                    newLeft = initialElementRect.left + deltaX;
                    break;
                case 'top-right':
                    newWidth = initialElementRect.width + deltaX;
                    newHeight = initialElementRect.height - deltaY;
                    newTop = initialElementRect.top + deltaY;
                    break;
                case 'top-left':
                    newWidth = initialElementRect.width - deltaX;
                    newHeight = initialElementRect.height - deltaY;
                    newLeft = initialElementRect.left + deltaX;
                    newTop = initialElementRect.top + deltaY;
                    break;
                // Add side resize handles if desired (e.g., 'right', 'bottom')
                case 'right':
                    newWidth = initialElementRect.width + deltaX;
                    break;
                case 'bottom':
                    newHeight = initialElementRect.height + deltaY;
                    break;
                case 'left':
                    newWidth = initialElementRect.width - deltaX;
                    newLeft = initialElementRect.left + deltaX;
                    break;
                case 'top':
                    newHeight = initialElementRect.height - deltaY;
                    newTop = initialElementRect.top + deltaY;
                    break;
                default:
                    break;
            }

            // Ensure minimum dimensions (e.g., 20px)
            newWidth = Math.max(newWidth, 20);
            newHeight = Math.max(newHeight, 20);

            // Update element styles
            onUpdateElementStyles(id, {
                styles: {
                    ...element.styles, // Keep existing styles
                    width: `${newWidth}px`,
                    height: `${newHeight}px`,
                    left: `${newLeft}px`,
                    top: `${newTop}px`,
                }
            });
        };

        const handleMouseUp = () => {
            setIsResizing(null);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        // Cleanup: remove event listeners when component unmounts or resizing stops
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, initialMousePos, initialElementRect, id, onUpdateElementStyles, element.styles]); // Depend on element.styles to ensure it's always current

    // Handle element-specific rendering
    const renderElementContent = () => {
        switch (type) {
            case 'img':
                // For images, use the 'src' from styles
                return (
                    <img
                        src={styles.src || 'https://placehold.co/100x100/A0A0A0/FFFFFF?text=Image'}
                        alt="Generated Image"
                        className="w-full h-full object-contain pointer-events-none" // pointer-events-none prevents img itself from being dragged separately
                    />
                );
            case 'hr':
                // HR element is self-closing and its appearance is purely style-based
                return null;
            case 'vline':
                // VLine is a div that is styled as a vertical line, no internal content
                return null;
            case 'table':
                // For tables, use dangerouslySetInnerHTML to render the content string as HTML
                // The content is now derived from tableDataState
                return (
                    <div
                        dangerouslySetInnerHTML={{ __html: generateTableHtml(tableDataState) }}
                        className="w-full h-full overflow-auto pointer-events-none" // Disable pointer events for inner content
                    ></div>
                );
            default:
                return content;
        }
    };

    return (
        <div
            ref={elementRef}
            id={id}
            draggable="true" // Make elements on canvas draggable
            onDragStart={(e) => onDragStart(id, e)} // Pass element ID and event
            onClick={() => onSelect(id)}
            // Add data-resizing attribute to prevent drag when resizing
            data-resizing={isResizing ? "true" : "false"}
            style={styles} // Apply all dynamic styles
            className={`cursor-move transition-all duration-100 ease-in-out
                        ${isSelected ? 'border-2 border-blue-500 shadow-xl' : 'hover:border-blue-300'}
                        group relative`}
        >
            {renderElementContent()}
            {/* Display element type for easy identification */}
            <span className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-1 rounded-br-md opacity-75 group-hover:opacity-100">
                {type === 'hr' ? 'HR' : type === 'vline' ? 'VLine' : type.charAt(0).toUpperCase() + type.slice(1)}
            </span>

            {/* Resize Handles (only visible when element is selected) */}
            {isSelected && (
                <>
                    {/* Corner Handles */}
                    <div
                        className="w-3 h-3 bg-blue-600 rounded-full absolute -top-1.5 -left-1.5 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(e, 'top-left')}
                    ></div>
                    <div
                        className="w-3 h-3 bg-blue-600 rounded-full absolute -top-1.5 -right-1.5 cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(e, 'top-right')}
                    ></div>
                    <div
                        className="w-3 h-3 bg-blue-600 rounded-full absolute -bottom-1.5 -left-1.5 cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
                    ></div>
                    <div
                        className="w-3 h-3 bg-blue-600 rounded-full absolute -bottom-1.5 -right-1.5 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
                    ></div>

                    {/* Side Handles (optional, for finer control) */}
                    {/* <div
                        className="w-3 h-3 bg-blue-600 rounded-full absolute top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(e, 'left')}
                    ></div>
                    <div
                        className="w-3 h-3 bg-blue-600 rounded-full absolute top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(e, 'right')}
                    ></div>
                    <div
                        className="w-3 h-3 bg-blue-600 rounded-full absolute left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(e, 'top')}
                    ></div>
                    <div
                        className="w-3 h-3 bg-blue-600 rounded-full absolute left-1/2 -bottom-1.5 -translate-x-1/2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
                    ></div> */}
                </>
            )}
        </div>
    );
};


// PropertiesPanel Component: For editing selected element's properties
const PropertiesPanel = ({ element, onUpdate, onDelete }) => {
    // State to manage input values
    const [localContent, setLocalContent] = useState(element.content);
    const [localStyles, setLocalStyles] = useState(element.styles);
    const [localName, setLocalName] = useState(element.name || '');
    const [localDescription, setLocalDescription] = useState(element.description || '');

    // State to hold the parsed table data for column manipulation
    // Initialize from element.tableDataState if available, otherwise default structure
    const [tableData, setTableData] = useState(element.tableDataState || { headers: [], bodyRows: [] });

    // Update local state and parse table data when the 'element' prop changes
    useEffect(() => {
        setLocalContent(element.content);
        setLocalStyles(element.styles);
        setLocalName(element.name || '');
        setLocalDescription(element.description || '');
        // When element prop changes, update tableData state from element.tableDataState
        if (element.type === 'table') {
            setTableData(element.tableDataState || { headers: [], bodyRows: [] });
        }
    }, [element]);

    /**
     * Handles changes to the content of the element.
     * @param {Object} e - The change event.
     */
    const handleContentChange = useCallback((e) => {
        const newContent = e.target.value;
        setLocalContent(newContent);
        onUpdate(element.id, { content: newContent });
    }, [element.id, onUpdate]);

    /**
     * Handles changes to name property.
     * @param {Object} e - The change event.
     */
    const handleNameChange = useCallback((e) => {
        const newName = e.target.value;
        setLocalName(newName);
        onUpdate(element.id, { name: newName });
    }, [element.id, onUpdate]);

    /**
     * Handles changes to description property.
     * @param {Object} e - The change event.
     */
    const handleDescriptionChange = useCallback((e) => {
        const newDescription = e.target.value;
        setLocalDescription(newDescription);
        onUpdate(element.id, { description: newDescription });
    }, [element.id, onUpdate]);

    /**
     * Handles changes to style properties.
     * @param {string} key - The CSS property name (e.g., 'backgroundColor').
     * @param {string} value - The new value for the property.
     */
    const handleStyleChange = useCallback((key, value) => {
        const newStyles = { ...localStyles, [key]: value };
        setLocalStyles(newStyles);
        onUpdate(element.id, { styles: newStyles });
    }, [element.id, localStyles, onUpdate]);

    /**
     * Handles changes to a specific table header's content.
     * @param {number} index - The index of the header to update.
     * @param {string} value - The new content for the header.
     */
    const handleHeaderContentChange = useCallback((index, value) => {
        const newHeaders = [...tableData.headers];
        newHeaders[index] = { ...newHeaders[index], content: value }; // Update content property
        const newTableData = { ...tableData, headers: newHeaders };
        setTableData(newTableData);
        onUpdate(element.id, { tableDataState: newTableData }); // Update tableDataState directly
    }, [tableData, element.id, onUpdate]);

    /**
     * Handles changes to a specific table header's name.
     * @param {number} index - The index of the header to update.
     * @param {string} value - The new name for the header.
     */
    const handleHeaderNameChange = useCallback((index, value) => {
        const newHeaders = [...tableData.headers];
        newHeaders[index] = { ...newHeaders[index], name: value }; // Update name property
        const newTableData = { ...tableData, headers: newHeaders };
        setTableData(newTableData);
        onUpdate(element.id, { tableDataState: newTableData }); // Update tableDataState directly
    }, [tableData, element.id, onUpdate]);

    /**
     * Handles changes to a specific table header's description.
     * @param {number} index - The index of the header to update.
     * @param {string} value - The new description for the header.
     */
    const handleHeaderDescriptionChange = useCallback((index, value) => {
        const newHeaders = [...tableData.headers];
        newHeaders[index] = { ...newHeaders[index], description: value }; // Update description property
        const newTableData = { ...tableData, headers: newHeaders };
        setTableData(newTableData);
        onUpdate(element.id, { tableDataState: newTableData }); // Update tableDataState directly
    }, [tableData, element.id, onUpdate]);

    /**
     * Adds a new column to the table.
     */
    const handleAddColumn = useCallback(() => {
        const newTableData = { ...tableData };
        const newColumnIndex = newTableData.headers.length + 1;
        // Add a new header object with default content, name, and description
        newTableData.headers.push({
            content: `Header ${newColumnIndex}`,
            name: `Column ${newColumnIndex} Name`,
            description: `Description for column ${newColumnIndex}`
        });
        // Add a new cell to each body row
        newTableData.bodyRows = newTableData.bodyRows.map(row => [...row, `New Cell`]);

        setTableData(newTableData);
        // Update the element's tableDataState with the new structured data
        onUpdate(element.id, { tableDataState: newTableData });
    }, [tableData, element.id, onUpdate]);

    /**
     * Removes the last column from the table.
     */
    const handleRemoveLastColumn = useCallback(() => {
        const newTableData = { ...tableData };
        if (newTableData.headers.length === 0) { // Check if there are any columns at all
            console.log("No columns to remove.");
            return;
        }
        if (newTableData.headers.length === 1) { // Allow removing the very last column
            newTableData.headers = [];
            newTableData.bodyRows = [];
        } else {
            // Remove the last header
            newTableData.headers.pop();
            // Remove the last cell from each body row
            newTableData.bodyRows = newTableData.bodyRows.map(row => {
                const newRow = [...row];
                newRow.pop();
                return newRow;
            });
        }

        setTableData(newTableData);
        // Update the element's tableDataState with the new structured data
        onUpdate(element.id, { tableDataState: newTableData });
    }, [tableData, element.id, onUpdate]);


    // Helper to render a style input field
    const renderStyleInput = (label, styleKey, type = 'text') => (
        <div className="mb-3">
            <label htmlFor={`${element.id}-${styleKey}`} className="block text-gray-700 text-sm font-semibold mb-1">{label}</label>
            <input
                type={type}
                id={`${element.id}-${styleKey}`}
                value={localStyles[styleKey] || ''}
                onChange={(e) => handleStyleChange(styleKey, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
        </div>
    );

    // Options for flex-direction
    const flexDirectionOptions = ['row', 'column', 'row-reverse', 'column-reverse'];
    // Options for justify-content
    const justifyContentOptions = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'];
    // Options for align-items
    const alignItemsOptions = ['flex-start', 'flex-end', 'center', 'baseline', 'stretch'];


    return (
        <div className="flex flex-col space-y-4">
            <h3 className="text-xl font-semibold text-gray-700">Element: <span className="font-bold text-blue-600">{element.type === 'hr' ? 'HR (Line)' : element.type === 'vline' ? 'VLine (Line)' : element.type.toUpperCase()}</span></h3>

            {/* Name Property */}
            <div className="mb-4">
                <label htmlFor={`${element.id}-name`} className="block text-gray-700 text-sm font-semibold mb-1">Name</label>
                <input
                    type="text"
                    id={`${element.id}-name`}
                    value={localName}
                    onChange={handleNameChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter element name"
                />
            </div>

            {/* Description Property */}
            <div className="mb-4">
                <label htmlFor={`${element.id}-description`} className="block text-gray-700 text-sm font-semibold mb-1">Description</label>
                <textarea
                    id={`${element.id}-description`}
                    value={localDescription}
                    onChange={handleDescriptionChange}
                    className="w-full p-2 border border-gray-300 rounded-md h-20 focus:ring-blue-500 focus:border-blue-500 resize-y"
                    placeholder="Describe this element"
                />
            </div>

            {/* General Content (for text-based elements, and now for table inner HTML) */}
            {(element.type !== 'img' && element.type !== 'hr' && element.type !== 'vline' && element.type !== 'table') && ( // Conditionally render content input
                <div className="mb-4">
                    <label htmlFor={`${element.id}-content`} className="block text-gray-700 text-sm font-semibold mb-1">
                        Content
                    </label>
                    <textarea
                        id={`${element.id}-content`}
                        value={localContent}
                        onChange={handleContentChange}
                        className="w-full p-2 border border-gray-300 rounded-md h-20 focus:ring-blue-500 focus:border-blue-500 resize-y"
                        placeholder={'Enter element text here...'}
                    />
                </div>
            )}

            {/* Specific input for image source */}
            {element.type === 'img' && (
                <div className="mb-3">
                    <label htmlFor={`${element.id}-src`} className="block text-gray-700 text-sm font-semibold mb-1">Image Source (URL)</label>
                    <input
                        type="text"
                        id={`${element.id}-src`}
                        value={localStyles.src || ''}
                        onChange={(e) => handleStyleChange('src', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            )}

            <h4 className="text-lg font-semibold text-gray-700 mt-4">Styles</h4>

            {/* Basic Styles */}
            {renderStyleInput('Background Color', 'backgroundColor', 'color')}
            {renderStyleInput('Text Color', 'color', 'color')}
            {renderStyleInput('Font Size (px)', 'fontSize')}
            {renderStyleInput('Width (px, %, auto)', 'width')}
            {renderStyleInput('Height (px, %, auto)', 'height')}
            {renderStyleInput('Padding (px)', 'padding')}
            {renderStyleInput('Margin (px)', 'margin')}
            {renderStyleInput('Border (e.g., 1px solid #ccc)', 'border')}
            {renderStyleInput('Border Radius (px, %)', 'borderRadius')}


            {/* Flexbox Controls (primarily for div, but useful for any container) */}
            {['div'].includes(element.type) && (
                <>
                    <h4 className="text-lg font-semibold text-gray-700 mt-4">Flexbox Container Styles</h4>
                    <div className="mb-3">
                        <label htmlFor={`${element.id}-display`} className="block text-gray-700 text-sm font-semibold mb-1">Display</label>
                        <select
                            id={`${element.id}-display`}
                            value={localStyles.display || 'block'}
                            onChange={(e) => handleStyleChange('display', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md"
                        >
                            <option value="block">block</option>
                            <option value="flex">flex</option>
                            <option value="inline-block">inline-block</option>
                        </select>
                    </div>

                    {localStyles.display === 'flex' && (
                        <>
                            <div className="mb-3">
                                <label htmlFor={`${element.id}-flexDirection`} className="block text-gray-700 text-sm font-semibold mb-1">Flex Direction</label>
                                <select
                                    id={`${element.id}-flexDirection`}
                                    value={localStyles.flexDirection || 'row'}
                                    onChange={(e) => handleStyleChange('flexDirection', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                >
                                    {flexDirectionOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-3">
                                <label htmlFor={`${element.id}-justifyContent`} className="block text-gray-700 text-sm font-semibold mb-1">Justify Content</label>
                                <select
                                    id={`${element.id}-justifyContent`}
                                    value={localStyles.justifyContent || 'flex-start'}
                                    onChange={(e) => handleStyleChange('justifyContent', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                >
                                    {justifyContentOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-3">
                                <label htmlFor={`${element.id}-alignItems`} className="block text-gray-700 text-sm font-semibold mb-1">Align Items</label>
                                <select
                                    id={`${element.id}-alignItems`}
                                    value={localStyles.alignItems || 'flex-start'}
                                    onChange={(e) => handleStyleChange('alignItems', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                >
                                    {alignItemsOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </>
            )}
             {/* Table Specific Styles and Column Controls */}
             {element.type === 'table' && (
                <>
                    <h4 className="text-lg font-semibold text-gray-700 mt-4">Table Specific Styles</h4>
                    <div className="mb-3">
                        <label htmlFor={`${element.id}-borderCollapse`} className="block text-gray-700 text-sm font-semibold mb-1">Border Collapse</label>
                        <input
                            type="text"
                            id={`${element.id}-borderCollapse`}
                            value={localStyles.borderCollapse || ''}
                            onChange={(e) => handleStyleChange('borderCollapse', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="mb-3">
                        <label htmlFor={`${element.id}-tableLayout`} className="block text-gray-700 text-sm font-semibold mb-1">Table Layout</label>
                        <input
                            type="text"
                            id={`${element.id}-tableLayout`}
                            value={localStyles.tableLayout || ''}
                            onChange={(e) => handleStyleChange('tableLayout', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <h4 className="text-lg font-semibold text-gray-700 mt-4">Column Controls</h4>
                    <div className="flex space-x-2 mb-4">
                        <button
                            onClick={handleAddColumn}
                            className="flex-1 px-4 py-2 bg-blue-500 text-white font-semibold rounded-md shadow-md
                                       hover:bg-blue-600 transition duration-200 ease-in-out transform hover:scale-105"
                        >
                            Add Column
                        </button>
                        <button
                            onClick={handleRemoveLastColumn}
                            className="flex-1 px-4 py-2 bg-orange-500 text-white font-semibold rounded-md shadow-md
                                       hover:bg-orange-600 transition duration-200 ease-in-out transform hover:scale-105"
                        >
                            Remove Last Column
                        </button>
                    </div>

                    <h4 className="text-lg font-semibold text-gray-700 mt-4">Column Headers</h4>
                    <div className="space-y-4"> {/* Increased spacing for column groups */}
                        {tableData.headers.map((column, index) => (
                            <div key={index} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                <h5 className="text-md font-semibold mb-2 text-gray-800">Column {index + 1} Properties</h5>
                                <div className="mb-2">
                                    <label htmlFor={`${element.id}-header-content-${index}`} className="block text-gray-700 text-sm font-semibold mb-1">Header Content:</label>
                                    <input
                                        type="text"
                                        id={`${element.id}-header-content-${index}`}
                                        value={column.content}
                                        onChange={(e) => handleHeaderContentChange(index, e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div className="mb-2">
                                    <label htmlFor={`${element.id}-column-name-${index}`} className="block text-gray-700 text-sm font-semibold mb-1">Column Name:</label>
                                    <input
                                        type="text"
                                        id={`${element.id}-column-name-${index}`}
                                        value={column.name}
                                        onChange={(e) => handleHeaderNameChange(index, e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        placeholder={`Name for Column ${index + 1}`}
                                    />
                                </div>
                                <div>
                                    <label htmlFor={`${element.id}-column-description-${index}`} className="block text-gray-700 text-sm font-semibold mb-1">Column Description:</label>
                                    <textarea
                                        id={`${element.id}-column-description-${index}`}
                                        value={column.description}
                                        onChange={(e) => handleHeaderDescriptionChange(index, e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-md h-16 focus:ring-blue-500 focus:border-blue-500 resize-y"
                                        placeholder={`Describe Column ${index + 1}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Delete Button */}
            <button
                onClick={() => onDelete(element.id)}
                className="mt-6 px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-md
                           hover:bg-red-700 transition duration-200 ease-in-out transform hover:scale-105"
            >
                Delete Element
            </button>
        </div>
    );
};

// Ensure Tailwind CSS is loaded
const TailwindCSSLoader = () => (
    <script src="https://cdn.tailwindcss.com"></script>
);

// Add the Inter font
const InterFontLoader = () => (
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
);

// Main component that includes Tailwind CSS and Inter font loaders, then renders the App
const Root = () => {
    return (
        <>
            <TailwindCSSLoader />
            <InterFontLoader />
            <App />
        </>
    );
};

export default Root;
