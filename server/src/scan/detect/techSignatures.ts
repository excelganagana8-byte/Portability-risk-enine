export interface Signature {
  id: string;
  label: string;
  category: 'app' | 'analytics' | 'marketing' | 'support' | 'checkout' | 'theme' | 'cdn' | 'other';
  host?: RegExp;
  inline?: RegExp;
  meta?: RegExp;
  header?: { name: string; pattern: RegExp };
}

export const signatures: Signature[] = [
  // Analytics & Tracking
  { id: 'google-analytics', label: 'Google Analytics / GTM', category: 'analytics', host: /google-analytics\.com|googletagmanager\.com/i, inline: /\b(?:gtag|dataLayer\.push)\s*\(/i },
  { id: 'meta-pixel', label: 'Meta Pixel', category: 'marketing', host: /connect\.facebook\.net/i, inline: /\bfbq\s*\(/i },
  { id: 'datadog-rum', label: 'Datadog RUM', category: 'analytics', host: /datadoghq\.com|datadog-rum/i, inline: /datadogRum\.init\s*\(/i },
  { id: 'hotjar', label: 'Hotjar', category: 'analytics', host: /static\.hotjar\.com|hotjar\.com/i, inline: /\bhj\s*\(/i },
  { id: 'new-relic', label: 'New Relic', category: 'analytics', host: /newrelic\.com|nr-data\.net/i, inline: /NREUM\b/i },
  { id: 'tiktok-pixel', label: 'TikTok Pixel', category: 'marketing', host: /analytics\.tiktok\.com/i, inline: /ttq\.load\s*\(/i },
  { id: 'pinterest-tag', label: 'Pinterest Tag', category: 'marketing', host: /ct\.pinterest\.com/i, inline: /\bpintrk\s*\(/i },
  { id: 'criteo', label: 'Criteo', category: 'marketing', host: /criteo\.(?:net|com)/i },
  { id: 'triple-whale', label: 'Triple Whale', category: 'analytics', host: /triplewhale\.com|triplewhale-pixel/i },
  { id: 'elevar', label: 'Elevar', category: 'analytics', host: /getelevar\.com/i },

  // Customer Support
  { id: 'gorgias', label: 'Gorgias', category: 'support', host: /gorgias\.(?:io|chat)/i },
  { id: 'zendesk', label: 'Zendesk', category: 'support', host: /static\.zdassets\.com|zendesk\.com/i },
  { id: 'intercom', label: 'Intercom', category: 'support', host: /widget\.intercom\.io/i },

  // Marketing & SMS
  { id: 'klaviyo', label: 'Klaviyo', category: 'marketing', host: /klaviyo\.com|klaviyo\.js/i, inline: /\bklaviyo\s*=\s*klaviyo\s*\|\|/i },
  { id: 'attentive', label: 'Attentive SMS', category: 'marketing', host: /attentivemobile\.com/i },
  { id: 'omnisend', label: 'Omnisend', category: 'marketing', host: /omnisend\.com/i },

  // Reviews & Social Proof
  { id: 'yotpo', label: 'Yotpo', category: 'app', host: /yotpo\.com/i },
  { id: 'judge-me', label: 'Judge.me', category: 'app', host: /judge\.me/i },
  { id: 'loox', label: 'Loox Reviews', category: 'app', host: /loox\.io/i },
  { id: 'okendo', label: 'Okendo', category: 'app', host: /okendo\.io/i },
  { id: 'bazaarvoice', label: 'Bazaarvoice', category: 'app', host: /bazaarvoice\.com/i },
  { id: 'stamped', label: 'Stamped.io', category: 'app', host: /stamped\.io/i },

  // Search & Personalization
  { id: 'algolia', label: 'Algolia Search', category: 'app', host: /algolia\.net|algoliasearch/i, inline: /algoliasearch\s*\(/i },
  { id: 'searchanise', label: 'Searchanise', category: 'app', host: /searchanise\.com/i },
  { id: 'boost-commerce', label: 'Boost AI Search & Filter', category: 'app', host: /boostcommerce\.net/i },
  { id: 'dynamic-yield', label: 'Dynamic Yield', category: 'app', host: /dynamicyield\.com/i },
  { id: 'nosto', label: 'Nosto', category: 'app', host: /nosto\.com/i },

  // Subscriptions
  { id: 'recharge', label: 'Recharge Subscriptions', category: 'app', host: /rechargepayments\.com|rechargeapps\.com/i },
  { id: 'bold-subscriptions', label: 'Bold Subscriptions', category: 'app', host: /boldcommerce\.com/i },
  { id: 'skio', label: 'Skio Subscriptions', category: 'app', host: /skio\.com/i },

  // Consent & Privacy
  { id: 'onetrust', label: 'OneTrust Cookie Consent', category: 'app', host: /onetrust\.com|cdn\.cookielaw\.org/i },
  { id: 'cookiebot', label: 'Cookiebot', category: 'app', host: /cookiebot\.com/i },

  // Payments & Checkout
  { id: 'klarna', label: 'Klarna', category: 'checkout', host: /klarna\.com|cdn\.klarna\.com/i },
  { id: 'afterpay', label: 'Afterpay / Clearpay', category: 'checkout', host: /afterpay\.com|clearpay\.com/i },
  { id: 'paypal', label: 'PayPal', category: 'checkout', host: /paypal\.com|paypalobjects\.com/i },

  // Page Builders
  { id: 'shogun', label: 'Shogun Page Builder', category: 'app', host: /getshogun\.com/i },
  { id: 'pagefly', label: 'PageFly', category: 'app', host: /pagefly\.io/i },

  // CDN & Infrastructure
  { id: 'shopify-cdn', label: 'Shopify CDN', category: 'cdn', host: /cdn\.shopify\.com/i },
  { id: 'cloudflare', label: 'Cloudflare', category: 'cdn', host: /cdnjs\.cloudflare\.com|cloudflare\.com/i, header: { name: 'server', pattern: /cloudflare/i } }
];
