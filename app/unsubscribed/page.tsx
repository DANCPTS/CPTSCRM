"use client";

import { useSearchParams } from "next/navigation";
import { CircleCheck as CheckCircle2 } from "lucide-react";

export default function UnsubscribedPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-5">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-12 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>

        <h1 className="text-2xl font-semibold text-slate-900 mb-3">
          You&apos;ve been unsubscribed
        </h1>

        <p className="text-slate-500 text-base leading-relaxed mb-6">
          You will no longer receive marketing emails from CPTS Training. We&apos;re sorry to see you go!
        </p>

        {email && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600 mb-6">
            {email}
          </div>
        )}

        <a
          href="https://cpcs-training-courses.co.uk"
          className="inline-block bg-[#0f3d5e] text-white px-8 py-3 rounded-lg font-medium hover:bg-[#0c3049] transition-colors"
        >
          Visit Our Website
        </a>

        <div className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-400 space-y-1">
          <p>CPTS Training - Construction and Plant Training Services</p>
          <p>If you unsubscribed by mistake, please contact us at daniel@cpts.uk</p>
        </div>
      </div>
    </div>
  );
}
