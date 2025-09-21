# OpenAI API Setup Instructions

## Environment Variables

Create a `.env` file in the root directory (`FIRA/Website/web/pfira-app/`) with the following content:

```
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

## Getting an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to the API section
4. Create a new API key
5. Copy the key and add it to your `.env` file

## Security Note

- Never commit your `.env` file to version control
- The `.env` file should be added to `.gitignore`
- Make sure to use environment variables in production

## Testing the Integration

After setting up the API key, the AI analysis will automatically run when new messages are sent in the chat system.

