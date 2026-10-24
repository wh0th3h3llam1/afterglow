import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Afterglow — the correspondence desk",
  description: "Thoughtful conference follow-ups, one reviewed letter at a time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
