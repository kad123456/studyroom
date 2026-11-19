import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyRoom — Real-Time Virtual Co-Working Space",
  description: "A distraction-free, collaborative virtual study room with live video, synchronized Pomodoro timer, ambient sounds, and task accountability.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="antialiased min-h-screen selection:bg-purple-500/30 selection:text-purple-200">
        {children}
      </body>
    </html>
  );
}
