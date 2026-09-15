# Data Entry Interface Survey

This is a research-focused clinical intake platform built for the **CAP5100** HCI coursework. It compares three different patient intake interfaces:
1. **Traditional Form**: A standard digital form with input fields and dropdowns.
2. **AI Chatbot (ChanseyBOT)**: A conversational AI assistant for clinical intake.
3. **AI-Enhanced Form**: A traditional form supplemented with real-time AI assistance/clarification.
The Final Evaluation Report is available as PDF.

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **AI Engine**: Anthropic Claude Haiku 4.5 (via Direct API)
- **Database**: Firebase Firestore
- **Hosting and Deployment**: Vercel (Automated with Github Actions)
- **Styling**: Vanilla CSS (Modern Dark Mode)

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env.local` file with your Gemini and Firebase credentials:
   ```env
   GEMINI_API_KEY=your_key_here
   NEXT_PUBLIC_FIREBASE_API_KEY=your_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Access Interfaces**:
   - Landing: `http://localhost:3000`
   - Admin Dashboard: `http://localhost:3000/admin/dashboard-results`

## Research Metrics
The application automatically tracks:
- **Completion Time**: Milliseconds taken per interface.
- **Qualitative Feedback**: Ranking, Usability, and Trust scores.

## Deployment
This project is configured for **Firebase Hosting** or **Vercel**. 
- Run `npm run build` before deploying.
- Ensure your environment variables are configured in your hosting provider's dashboard.
