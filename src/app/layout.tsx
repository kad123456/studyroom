import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://studyroom-topaz.vercel.app";
const siteDescription =
  "Study online with friends in a free virtual study room. Focus together on webcam, use a shared Pomodoro timer, track goals, chat, and play ambient sounds. No sign-up required.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "StudyRoom",
  title: {
    default: "StudyRoom | Free Virtual Study Room & Focus Timer",
    template: "%s | StudyRoom",
  },
  description: siteDescription,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "StudyRoom",
    title: "StudyRoom | Free Virtual Study Room & Focus Timer",
    description: siteDescription,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "StudyRoom — focus together online" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StudyRoom | Free Virtual Study Room & Focus Timer",
    description: siteDescription,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen selection:bg-purple-500/30 selection:text-purple-200">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "StudyRoom",
              url: siteUrl,
              description: siteDescription,
              applicationCategory: "EducationalApplication",
              operatingSystem: "Any device with a modern web browser",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            }).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
