"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { api, ApiClientError } from "@/lib/api-client";

const PIN_LENGTH = 6;

export function PinGate({ slug }: { slug: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const pin = digits.join("");

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (!clean && v !== "") return;
    setDigits((prev) => {
      const next = [...prev];
      if (clean.length > 1) {
        // paste
        clean.split("").slice(0, PIN_LENGTH - i).forEach((c, k) => (next[i + k] = c));
      } else {
        next[i] = clean;
      }
      return next;
    });
    if (clean && i < PIN_LENGTH - 1) inputs.current[i + Math.min(clean.length, 1)]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (pin.length < 4) {
      setError("Enter the PIN from your photographer");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post(`/api/gallery/${slug}/verify`, { pin });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Incorrect PIN");
      setDigits(Array(PIN_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-100">
        <Lock className="h-5 w-5 text-brand-600" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Enter gallery PIN</h2>
      <p className="mt-1 text-sm text-slate-500">
        This gallery is private. Enter the PIN your photographer shared with you.
      </p>

      <form onSubmit={submit} className="mt-6">
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              maxLength={i === 0 ? PIN_LENGTH : 1}
              autoFocus={i === 0}
              className="h-12 w-10 rounded-lg border border-slate-300 text-center text-lg font-semibold focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={loading} className="mt-5 w-full">
          View gallery
        </Button>
      </form>
    </div>
  );
}
