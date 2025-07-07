// server.js

// Import the Express.js framework to create the server.
// If you don't have Express installed, run: npm install express
const express = require('express');

// Import 'node-fetch' for making HTTP requests.
// In Node.js v18 and later, the global `fetch` API is available,
// so `require('node-fetch')` might not be strictly necessary if you're on a newer version.
// For broader compatibility, or if you're on an older Node.js version,
// you can install it: npm install node-fetch
//const fetch = require('node-fetch');

// Import the 'cors' middleware to handle Cross-Origin Resource Sharing.
// If you don't have cors installed, run: npm install cors
const cors = require('cors');

// Create an instance of the Express application.
const app = express();

// Define the port on which the server will listen.
const PORT = process.env.PORT || 8080;


const YOUR_TENANT_NAME = "agenthack_d4f5e52c/DefaultTenant";              // e.g., 'DefaultTenant'
const YOUR_CLIENT_ID = "3766c912-8da6-4ce5-93e5-cbca69d972a4";             // From External Application setup
const YOUR_CLIENT_SECRET = "LJaa~ftYe$^Z93Vi";         // From External Application setup (copy immediately!)
const YOUR_FOLDER_ID = "2193861";             // The numerical ID of your Orchestrator folder (e.g., 12345)
const YOUR_QUEUE_NAME = "Document Template Queue"; // The name of the queue in Orchestrator
const IDENTITY_SERVER_URL = `https://staging.uipath.com/identity_/connect/token`;
const ORCHESTRATOR_API_BASE_URL = `https://staging.uipath.com/${YOUR_TENANT_NAME}/odata/`;
const SCOPES = "OR.Queues OR.Queues.Read OR.Queues.Write OR.TestDataQueues OR.TestDataQueues.Read OR.TestDataQueues.Write"; // Or "OR.Queues.Write OR.Folders.Read" if more specific

// --- CORS Configuration ---
// Use the cors middleware to allow requests from all origins.
// For production, you might want to restrict this to specific origins for security.
// Example: { origin: 'http://localhost:8080' } if your client is on port 8080.
app.use(cors());

// Middleware to parse JSON bodies from incoming requests.
// This allows you to access request body data as JavaScript objects.
app.use(express.json());

// --- Our API Endpoint ---
// This is the endpoint that clients will call (e.g., your frontend application).
// It's a POST request, meaning it expects data in the request body.
app.post('/proxy-post-api', async (req, res) => {
    console.log('Received request on /proxy-post-api');
    console.log('Request Body:', req.body);

    
            
                    const fetchToken = async () => {
                    try {
                        const params = new URLSearchParams();
                        params.append('grant_type', 'client_credentials');
                        params.append('client_id', YOUR_CLIENT_ID);
                        params.append('client_secret', YOUR_CLIENT_SECRET);
                        params.append('scope', SCOPES);

                        const response = await fetch(IDENTITY_SERVER_URL, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: params.toString(),
                        });


                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`);
                       }

                        const data = await response.json();
                        console.log("Access Token received successfully!");
                       // return JSON.stringify(response);
                      // setMessageType('success');
                        return data.access_token;

                        
                    
                    } catch (error) {
                        console.error("Error getting access token:", error);
                       // setMessageType('error');
                        return "Error getting access token:" +error.message;
                    } 
                    };

        const accessToken = await fetchToken();

                    const addToQueue = async () =>{

                        console.log(`Attempting to add queue item to queue '${YOUR_QUEUE_NAME}' in folder '${YOUR_FOLDER_ID}'...`);
                        
                            const url = `${ORCHESTRATOR_API_BASE_URL}Queues/UiPathODataSvc.AddQueueItem`;

                            const payload = req.body; // Use the request body as the payload for the queue item 

                            const response = await fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${accessToken}`,
                                    'Content-Type': 'application/json',
                                    'X-UIPATH-OrganizationUnitId': YOUR_FOLDER_ID
                                },
                                body: JSON.stringify(payload),
                            });

                            return response;
                            

                    };

        const response = await addToQueue();

    //res.status({"status":"OKAY"}).json({"Data":"Data received successfully"});
/*
    // --- Configuration for the External API Call ---
    // Replace this with the actual URL of the external POST API you want to call.
    const externalApiUrl = 'https://jsonplaceholder.typicode.com/posts'; // Example: A public API for testing
    // You would typically get the data to send to the external API from the client's request body.
    const dataToSend = req.body;
*/
    try {
        
        // Check if the response from the external API was successful (status code 2xx).
        if (!response.ok) {
            // If the response was not OK, throw an error with the status.
            const errorText = await response.text(); // Get the error message from the external API
            throw new Error(`External API responded with status ${response.status}: ${errorText}`);
        }

        // Parse the JSON response from the external API.
        const responseData = await response.json();

        console.log('Response from external API:', responseData);

        // Send the response from the external API back to the client that called our API.
        res.status(response.status).json(responseData);

    } catch (error) {
        // Handle any errors that occur during the fetch operation or if the external API responds with an error.
        console.error('Error calling external API:', error.message);
        // Send an appropriate error response back to the client.
        res.status(500).json({
            message: 'Failed to call external API',
            error: error.message
        });
    }


});

// Start the server and listen for incoming requests.
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Test this API using a tool like Postman, Insomnia, or curl:`);
    console.log(`POST http://localhost:${PORT}/proxy-post-api`);
    console.log(`With JSON Body: {"title": "foo", "body": "bar", "userId": 1}`);
});

/*
To run this code:
1. Make sure you have Node.js installed.
2. Create a new directory for your project.
3. Inside the directory, create a file named `server.js` and paste the code above.
4. Open your terminal or command prompt, navigate to your project directory.
5. Initialize a Node.js project: `npm init -y`
6. Install necessary packages: `npm install express node-fetch`
7. Run the server: `node server.js`

You should see "Server is running on http://localhost:3000" in your console.
Now you can test it using a tool like Postman, Insomnia, or `curl`:

Example `curl` command:
curl -X POST -H "Content-Type: application/json" -d '{"title": "My New Post", "body": "This is the content of my post.", "userId": 10}' http://localhost:3000/proxy-post-api

You should see a response similar to:
{"title": "My New Post", "body": "This is the content of my post.", "userId": 10, "id": 101}
(The 'id' will be generated by the external API, in this case, JSONPlaceholder)
*/
