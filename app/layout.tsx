import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { SITE } from "../lib/site.mjs";


export const metadata: Metadata = {
  title: "Proof, we build your site first",
  description:
    "An independent web studio that builds your website before you pay for it. Apply, get a real working draft in about five days for nothing, then decide.",
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    title: "Proof, we build your site first",
    description:
      "We build a real working draft of your website for free. You only pay if you want to keep it.",
    images: [`${SITE}/og.png`],
    url: SITE,
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%234B3BFF'/%3E%3Cpath d='M19.5 8.5H8.5v15h15V12.5' fill='none' stroke='%23F5F5F3' stroke-width='4'/%3E%3Crect x='21' y='6.5' width='7.5' height='7.5' fill='%23F5F5F3'/%3E%3C/svg%3E",
  },
};

// themeColor moved out of metadata: Next warns that it belongs in a viewport
// export, and a build warning nobody acts on is how a real one gets missed.
export const viewport: Viewport = { themeColor: "#14161A" };

/**
 * JSON-LD. Carried verbatim from index.html except for the URL.
 *
 * NOTE for whoever wires Stripe: the `offers` block below advertises a price of
 * 0 for the free draft, which is true. The moment a paid offer is added here it
 * becomes a published price claim and has to agree with the pricing section on
 * the page. Structured data that disagrees with the visible page is the same
 * class of defect as a receipt citing the wrong corpus version.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Proof",
  description:
    "An independent web studio that builds a free working draft of your website before you commit.",
  areaServed: "New York",
  url: SITE,
  offers: {
    "@type": "Offer",
    name: "Free website draft",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/*
          Runs before first paint. One thing only: a refresh lands at the top,
          never inside a pinned scene. Carried verbatim from index.html, and it
          has to stay in the head rather than becoming a next/script, because
          scrollRestoration must be set before the browser restores a position.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ("scrollRestoration" in history) history.scrollRestoration = "manual";`,
          }}
        />
      </head>
      <body>
        {/*
          GSAP before the choreography, both before hydration, because the
          choreography is a plain IIFE that reads `gsap` and `ScrollTrigger` off
          the window the moment it runs. beforeInteractive guarantees the order.
        */}
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"
          strategy="beforeInteractive"
        />
        {children}
        {/*
          afterInteractive, so the DOM the IIFE queries exists. See the comment at
          the bottom of public/choreography.js for the one behavioural difference
          this introduces and how it is handled.
        */}
        <Script src="/choreography.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
