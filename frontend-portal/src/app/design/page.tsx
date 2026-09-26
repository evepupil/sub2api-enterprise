import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FoundationPreview } from "../../preview/foundation-preview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesignPreviewPage() {
  if (process.env.PORTAL_UI_PREVIEW !== "1") notFound();
  return <FoundationPreview />;
}
