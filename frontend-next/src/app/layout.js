import './globals.css';
import '../legacy/styles.css';

export const metadata = {
  title: 'BloodLine | Blood Donation & Request Matching',
  description: 'Blood donation and request matching platform.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
