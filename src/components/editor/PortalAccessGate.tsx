"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type GateStatus = "checking" | "allowed" | "blocked";

/**
 * This app is the internal editor engine the portal launches per-publisher
 * with a signed session (publisherId + authToken) -- it was never meant to
 * be opened directly by a stranger with the bare URL. Blocks rendering
 * entirely unless both are present AND the token actually validates against
 * the portal's own auth (the same /publisher/profile/:id call
 * PortalLaunchBootstrap already makes to fetch masthead data, which the
 * backend gates with authorizedPublisherID -- a valid signature alone isn't
 * enough, it has to be *this* publisher's own token).
 */
export function PortalAccessGate({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GateStatus>("checking");

  useEffect(() => {
    const publisherId = searchParams.get("publisherId")?.trim() || "";
    const authToken = searchParams.get("authToken")?.trim() || "";
    const apiBase = searchParams.get("apiBase")?.trim() || "";

    if (!publisherId || !authToken || !apiBase) {
      setStatus("blocked");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${apiBase}/publisher/profile/${publisherId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (cancelled) return;
        setStatus(response.ok ? "allowed" : "blocked");
      } catch {
        if (!cancelled) setStatus("blocked");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (status === "checking") {
    return null;
  }

  if (status === "blocked") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            यह पेज सीधे नहीं खोला जा सकता
          </h1>
          <p style={{ color: "#94a3b8", lineHeight: 1.6 }}>
            यह एक निजी संपादन उपकरण है, जो केवल आपके प्रकाशक डैशबोर्ड के ज़रिए ही खोला जा सकता है।
            कृपया अपने डैशबोर्ड में जाकर वहाँ से पेज बनाना शुरू करें।
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
