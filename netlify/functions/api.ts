import serverless from "serverless-http";
import { app } from "../../server";

// Export the serverless-wrapped Express app as the Netlify function handler
export const handler = serverless(app);
