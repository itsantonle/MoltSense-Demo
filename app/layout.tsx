import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { NavbarNew } from '@/components/shared/navbar-new'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'MoltSense',
  description: 'Smart Crab Condo',

  icons: {
    icon: [
      {
        url: '/ms-icon.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/ms-icon.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/ms-icon.png',
        type: 'image/png',
      },
    ],
    apple: '/ms-icon.png',
  },
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-slate-900">
        <NavbarNew />
        <main className="lg:ml-64 lg:pt-0 pt-16 pb-24 lg:pb-0 min-h-screen">
          {children}
        </main>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
