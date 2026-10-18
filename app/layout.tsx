import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'PostLens — Understand what made it work',description:'Evidence-led social content analysis for YouTube, Shorts, Instagram posts and Reels.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
