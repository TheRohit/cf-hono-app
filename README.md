# YouTube Transcription & Search API

A Cloudflare Workers application that transcribes YouTube videos, stores transcriptions, and provides semantic search capabilities using AI embeddings.

## Features

- YouTube video transcription using Groq's Whisper model
- Vector embeddings generation using Cloudflare AI
- Semantic search across video transcriptions
- Caching with Cloudflare KV
- Workflow-based processing architecture

## Prerequisites

- Node.js (Latest LTS version recommended)
- Cloudflare Workers account
- Required API keys:

  - Groq API key

## Installation

1. Clone the repository
2. Install dependencies:

```bash
bun install
```

## Configuration

1. Create a `wrangler.toml` file based on the provided template
2. Set up the required secrets using Wrangler:

```bash
wrangler secret put GROQ_API_KEY
```

## Development

Run the development server:

```bash
bun run dev
```

## Deployment

Deploy to Cloudflare Workers:

```bash
bun run deploy
```

## API Endpoints

### Process Video

- **POST** `/process-video/:id`
  - Starts transcription process for a YouTube video
  - Returns cached result if available

### Check Status

- **GET** `/status/:instanceId`
  - Check the status of a running transcription workflow

### Search

- **GET** `/search?q=query`
  - Perform semantic search across transcribed videos

## Architecture

The application uses several Cloudflare services:

- **Workers**: Main application runtime
- **KV**: Caching transcriptions
- **Vectorize**: Vector database for embeddings
- **AI**: Embedding generation
- **Workflows**: Orchestrating the transcription process

## Technical Details

- Built with Hono.js framework
- TypeScript for type safety
- Uses Cloudflare's AI models for embeddings
- Implements workflow-based processing for long-running tasks
- Includes automatic retries and error handling
- Implements caching strategies for performance

## Error Handling

The application includes comprehensive error handling:

- Workflow retries for transient failures
- Graceful degradation
- Detailed error logging
- Client-friendly error responses

## Limitations

- Maximum video length may be limited by processing time constraints
- API rate limits apply based on Cloudflare Workers limits
- Cached transcriptions expire after 30 days

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT License
