/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CMSControlCenter } from "../components/cms/CMSControlCenter";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

export function CMSPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/admin/dashboard?module=content"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>মেইন অ্যাডমিন কনটেন্ট স্যুটে ফিরে যান</span>
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 text-xs font-bold">
            <Shield size={14} />
            <span>Super Admin Authorized CMS</span>
          </div>
        </div>

        <CMSControlCenter />
      </div>
    </div>
  );
}
