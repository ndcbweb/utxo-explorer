import "./globals.css";
import Shell from "@/components/Shell";

export const metadata = {
  title: "Explorer",
  description: "Blocks, transactions and addresses",
};

const themeBoot = `try{var t=localStorage.getItem("explorer-theme");var d=t?t==="dark":true;document.documentElement.classList.toggle("dark",d)}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
