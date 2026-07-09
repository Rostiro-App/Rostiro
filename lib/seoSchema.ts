// Structured data (JSON-LD) shared across public marketing pages. Real
// fields only — no fabricated aggregateRating or review counts, matching
// this codebase's existing "no aspirational copy" discipline (see
// app/privacy/page.tsx's own comment on the same standard).

export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Rostiro',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  description: "The operating system for fantasy football: one ranked daily action list across every league you're in, a health score per team, and a product that reshapes itself around the real fantasy calendar.",
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
    },
    {
      '@type': 'Offer',
      name: 'Rostiro Pro',
      price: '9.99',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '9.99',
        priceCurrency: 'USD',
        unitCode: 'MON',
      },
    },
    {
      '@type': 'Offer',
      name: '2026 Founder Season Pass',
      price: '59',
      priceCurrency: 'USD',
    },
    {
      '@type': 'Offer',
      name: 'Founding 500',
      price: '149',
      priceCurrency: 'USD',
    },
  ],
}
