import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'preDrive | Safer school journeys',
  description: 'School transport safety and visibility for Zimbabwean creches and pre-schools.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
