import "./globals.css";
import ProgressBar from "../components/ProgressBar";
import TopBar from "../components/TopBar";
import { SurveyProvider } from "../context/SurveyContext";
import { ThemeProvider } from "../context/ThemeContext";

export const metadata = {
  title: "Clinical Intake Study",
  description: "Analyzing user experience across diverse data collection modalities.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <ThemeProvider>
          <SurveyProvider>
            <TopBar />
            <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '0 1rem', paddingBottom: '1rem' }}>
              {children}
            </main>
            <ProgressBar />
          </SurveyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
