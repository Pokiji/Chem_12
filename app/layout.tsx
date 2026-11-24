import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Little Chemistry | Reaction sandbox',
  description: 'Experiment with elements, construct atoms, and discover compounds in a free-form chemistry sandbox.',
}
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>
}

