import serverless from 'serverless-http';
import app from '../../backend/app.js'; 

// This "handler" export is what Netlify looks for.
// It wraps your Express app so it works in the cloud.
export const handler = serverless(app);