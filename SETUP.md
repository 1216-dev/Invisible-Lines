# Dashboard Setup Guide

## Environment Setup

The dashboard can work in two modes:
1. **JavaScript mode** (slower but works everywhere)
2. **Python backend mode** (faster, requires Python backend)

### Setting Up the Python Backend (Recommended for Performance)

#### Local Development

1. **Create a `.env.local` file** in your project root with:
   \`\`\`
   BACKEND_URL=http://localhost:5000
   \`\`\`

2. **Start the Python backend**:
   - Navigate to the `python-backend` directory
   - Install dependencies: `pip install -r requirements.txt`
   - Start the server: `python app.py`

3. **Start the Next.js app**:
   - In a separate terminal: `npm run dev`

#### Production Deployment

For production, you need to:

1. **Deploy the Python backend** to a service like:
   - Vercel Serverless Functions
   - AWS Lambda
   - Google Cloud Functions
   - A dedicated server

2. **Set the environment variable** in your Vercel project settings:
   - Go to your Vercel project
   - Navigate to Settings > Environment Variables
   - Add `BACKEND_URL` with the URL of your deployed Python backend

## Troubleshooting

### "Failed to fetch" Error

This error occurs when:
1. The Python backend is not running
2. The BACKEND_URL is incorrect
3. There are CORS issues
4. You're in a preview environment without a Python backend

**Solution**:
- For local development: Make sure the Python backend is running
- For production: Make sure the BACKEND_URL points to a valid, accessible URL
- For preview environments: The dashboard will automatically fall back to JavaScript processing

### Slow Performance

If the dashboard is slow, it's likely using JavaScript processing instead of the Python backend.

**Check**:
- Look for the "Using JavaScript processing (Python backend unavailable)" message
- Check the console for backend connection errors

**Solution**:
- Set up the Python backend as described above
- Make sure the BACKEND_URL is correct
