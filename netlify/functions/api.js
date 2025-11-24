import serverless from 'serverless-http';
import app from '../../backend/app.js';

// DEBUGGING LOG: See what "app" actually looks like in the logs
console.log('Type of app:', typeof app);
console.log('Is app.default defined?', !!app.default);

// CRITICAL FIX: Unwrap the ES Module if it's wrapped
// Netlify/Node often wraps "export default" in a .default property
const expressApp = app.default || app;

export const handler = serverless(expressApp);