export const metadata = {
  title: "CCB Agenda",
  description: "Agenda de eventos",
  manifest: "/manifest.webmanifest",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'Arial, sans-serif', background: '#f6f6f6' }}>
        {children}
      </body>
    </html>
  );
}
