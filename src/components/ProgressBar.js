'use client';

import { usePathname } from 'next/navigation';
import './ProgressBar.css';

// Proportional progress:
// Landing (0%) → Briefing (10%) → Instructions (20%) → Traditional (40%) → Chatbot (60%) → AI-Enhanced (70%) → Post-Survey (80%) → Thank You (100%)
const progressMap = {
  '/': 0,
  '/briefing': 10,
  '/instructions': 20,
  '/survey/traditional': 40,
  '/survey/chatbot': 60,
  '/survey/ai-enhanced': 80,
  '/post-survey': 90,
  '/thank-you': 100
};

export default function ProgressBar() {
  const pathname = usePathname();
  
  if (pathname === '/' || pathname.startsWith('/admin')) {
    return null;
  }

  const progressPercentage = progressMap[pathname] ?? 0;

  return (
    <div className="progress-container">
      <div className="progress-bar-bg">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      <div className="progress-text">
        Survey Progress: {progressPercentage}%
      </div>
    </div>
  );
}
