import Link from "next/link";
import { Camera } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 text-lg font-semibold">
        <Camera className="h-5 w-5 text-brand-600" />
        FrameLink
      </Link>
      <div className="card w-full max-w-md p-8">{children}</div>
    </div>
  );
}
