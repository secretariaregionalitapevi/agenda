import PWAManager from "./PWAManager";

export const metadata = {
  title: "CCB Agenda",
  description: "Agenda de eventos da CCB",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CCB Agenda",
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#1a3a5c",
    "msapplication-TileImage": "/icons/icon-144.png",
  },
};

export const viewport = {
  themeColor: "#1a3a5c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Apple touch icon */}
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144.png" />
        <link rel="apple-touch-icon" sizes="128x128" href="/icons/icon-128.png" />
        {/* Favicon padrão */}
        <link rel="shortcut icon" href="/icons/icon-96.png" />
      </head>
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#f6f6f6" }}>
        {children}
        <PWAManager />
      </body>
    </html>
  );
}
