import "./globals.css";

export const metadata = {
  title: "Brand MD Solutions — Console",
  description: "Content Operations Console",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
