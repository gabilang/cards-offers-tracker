import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Card Offers Tracker",
  description: "Credit and debit card offers from Sri Lankan banks, matched to your cards.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
            <Link href="/offers" className="mr-auto font-semibold">
              Card Offers Tracker
            </Link>
            <Link href="/offers" className="text-muted hover:text-fg">Offers</Link>
            {session?.user ? (
              <>
                <Link href="/preferences" className="text-muted hover:text-fg">My cards</Link>
                {session.user.isAdmin && <Link href="/admin/scrapes" className="text-muted hover:text-fg">Admin</Link>}
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button className="text-muted hover:text-fg">Sign out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="text-muted hover:text-fg">Sign in</Link>
                <Link href="/register" className="btn-primary">Create account</Link>
              </>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
