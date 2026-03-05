# AI PRD Assistant

An AI-powered conversational tool that captures client requirements and transforms them into structured Product Requirement Documents (PRDs). Built with Next.js 14, TypeScript, and Qwen3 AI model.

## Features

- **Conversational Requirements Gathering**: Natural language interface for collecting project requirements
- **Document Analysis**: Upload and analyze existing PRDs, PDFs, DOCX files, and images
- **AI-Powered Clarification**: Intelligent questioning to fill gaps and ambiguities
- **Structured PRD Generation**: Automatic generation of professional PRD documents
- **User Management**: Secure authentication and conversation history
- **Export Options**: Download PRDs in Markdown format

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Node.js API routes
- **AI Model**: Qwen3 via Hugging Face Transformers
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens
- **File Processing**: PDF.js, Mammoth (DOCX), Sharp (images)

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. Supabase account and project
3. Hugging Face API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-prd-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables in `.env.local`:
```env
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
DATABASE_URL=your_supabase_database_url_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
JWT_SECRET=your_jwt_secret_here
```

5. Set up the database:
```bash
# Apply the database schema using the SQL file provided
# You can run this in your Supabase SQL editor
psql $DATABASE_URL < database-schema.sql
```

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Setup

Run the SQL commands in `database-schema.sql` in your Supabase SQL editor to create the necessary tables and set up Row Level Security (RLS).

## Usage

1. **Sign Up/Login**: Create an account or log in to access the tool
2. **Start New Conversation**: Begin gathering requirements from scratch or upload existing documents
3. **Upload Documents**: Upload PDFs, DOCX files, or images for analysis
4. **Conversational Flow**: Answer guided questions about your project requirements
5. **Generate PRD**: Let AI create a structured PRD document
6. **Export**: Download your PRD in Markdown format

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Conversations
- `GET /api/conversations` - List user conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/[id]` - Get conversation details
- `POST /api/conversations/[id]/messages` - Add message to conversation
- `POST /api/conversations/[id]/generate-prd` - Generate PRD from conversation
- `GET /api/conversations/[id]/export` - Export PRD

### File Processing
- `POST /api/upload` - Upload file for processing
- `POST /api/process-document` - Process uploaded document
- `POST /api/chat` - Chat with AI assistant

## File Support

- **PDF**: Text extraction and image analysis (max 25MB, 50 pages)
- **DOCX**: Text extraction (max 25MB)
- **Images**: PNG, JPG, JPEG analysis (max 25MB)
- **Security**: Password-protected PDFs are detected and rejected

## Performance Targets

- AI response time: < 5 seconds
- Document analysis: < 30 seconds
- PRD generation: < 20 seconds
- File upload: < 15 seconds for documents up to 50 pages

## Security Features

- JWT-based authentication with 24-hour expiration
- Encrypted password storage with bcrypt
- Row Level Security (RLS) on database tables
- Secure file upload with validation
- HTTPS-only communication in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue on the GitHub repository.
