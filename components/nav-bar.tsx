import Link from "next/link";
import Image from "next/image";
import { AuthButton } from "@/components/auth-button";

export default function NavBar() {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/70 dark:bg-slate-900/80 backdrop-blur-2xl fade-in shadow-lg shadow-indigo-500/5 border-b border-white/20 dark:border-slate-700/50">
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80"></div>
      <div className="mx-auto max-w-7xl px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center hover:scale-105 transition-transform duration-200">
            <Image
              src="/assets/logo-placeholder.svg"
              alt="ProctorLess logo"
              width={180}
              height={60}
              priority
              className="hidden md:block w-[180px] h-[60px] object-contain"
            />
            <Image
              src="/assets/logo-placeholder.svg"
              alt="ProctorLess logo"
              width={120}
              height={40}
              priority
              className="md:hidden w-[120px] h-[40px] object-contain"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-6 ml-6"></nav>
        </div>
        {/* Client component for auth state with real-time updates */}
        <AuthButton />
      </div>
    </header>
  );
}

