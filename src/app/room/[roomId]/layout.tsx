import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private Study Room",
  robots: { index: false, follow: false },
};

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return children;
}
