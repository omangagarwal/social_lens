import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Social Lens — Creator Intelligence Studio',icons:{icon:'/favicon.svg'},description:'YouTube and Shorts analysis, comparison evidence and actionable next-upload plans powered by GPT-6 Luna.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
