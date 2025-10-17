<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# FindIA Next.js Migration Project Instructions

## Project Overview
FindIA is a financial debt tracking application being migrated from React + Vite to Next.js 14 for enhanced backend capabilities, real Google OAuth authentication, and Google Sheets API integration.

## Progress Tracking

- [x] Verify that the copilot-instructions.md file in the .github directory is created
- [x] Clarify Project Requirements - Next.js 14 project with TypeScript, Tailwind CSS, App Router
- [x] Scaffold the Project - Created Next.js project with all required dependencies
- [ ] Customize the Project
- [ ] Install Required Extensions
- [ ] Compile the Project
- [ ] Create and Run Task
- [ ] Launch the Project
- [ ] Ensure Documentation is Complete

## Development Guidelines

### Architecture
- Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for responsive styling
- Framer Motion for smooth animations
- NextAuth.js for OAuth authentication
- Google Sheets API for data storage
- Zustand for state management

### Key Features to Migrate
1. User authentication (Google OAuth)
2. Debt tracking and management
3. Progress visualization
4. Motivational messages
5. AI suggestions
6. Admin panel for Google Sheets setup
7. Real-time data synchronization

### API Routes Required
- `/api/auth/[...nextauth]` - NextAuth.js configuration
- `/api/google/sheets` - Google Sheets operations
- `/api/user/profile` - User profile management
- `/api/debts` - Debt CRUD operations

### Environment Variables
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SHEETS_ID`
- `GOOGLE_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

### Migration Strategy
1. Setup Next.js project structure
2. Migrate components from React to Next.js
3. Implement API routes for backend functionality
4. Configure NextAuth.js for Google OAuth
5. Setup Google Sheets API integration
6. Test and optimize performance