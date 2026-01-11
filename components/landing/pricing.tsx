import Link from "next/link";

export function Pricing() {
  return (
    <section id="pricing" className="max-w-5xl mx-auto mt-24">
      <h2 className="text-3xl font-semibold text-center mb-6 tracking-tight">
        Simple, transparent pricing
      </h2>
      <p className="text-base text-foreground/60 text-center max-w-2xl mx-auto mb-16">
        Start free and scale as you grow. No hidden fees, no surprises.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Free Tier */}
        <div className="bg-card p-8 rounded-2xl border border-border hover:shadow-lg transition-all">
          <div className="text-sm font-medium text-foreground/50 uppercase tracking-wider mb-2">Free</div>
          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-4xl font-semibold tracking-tight">$0</span>
            <span className="text-foreground/50">/month</span>
          </div>
          <p className="text-sm text-foreground/60 mb-6">Perfect for trying out Eikon and personal projects.</p>
          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">50 images per month</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">5 basic art styles</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Standard resolution output</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Community support</span>
            </li>
          </ul>
          <Link
            href="/auth"
            className="block w-full py-3 text-center border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            Get Started Free
          </Link>
        </div>

        {/* Pro Tier - Highlighted */}
        <div className="bg-card p-8 rounded-2xl border-2 border-emerald-500 hover:shadow-xl transition-all relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full uppercase tracking-wider">
            Most Popular
          </div>
          <div className="text-sm font-medium text-emerald-600 uppercase tracking-wider mb-2">Pro</div>
          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-4xl font-semibold tracking-tight">$19</span>
            <span className="text-foreground/50">/month</span>
          </div>
          <p className="text-sm text-foreground/60 mb-6">For professionals and growing teams.</p>
          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">1,000 images per month</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">All 12+ art styles</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">High resolution + 4K output</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Priority processing</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">API access included</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Email support</span>
            </li>
          </ul>
          <Link
            href="/auth"
            className="block w-full py-3 text-center bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            Start Pro Trial
          </Link>
        </div>

        {/* Enterprise Tier */}
        <div className="bg-card p-8 rounded-2xl border border-border hover:shadow-lg transition-all">
          <div className="text-sm font-medium text-foreground/50 uppercase tracking-wider mb-2">Enterprise</div>
          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-4xl font-semibold tracking-tight">Custom</span>
          </div>
          <p className="text-sm text-foreground/60 mb-6">For organizations with advanced needs.</p>
          <ul className="space-y-3 mb-8">
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Unlimited images</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Custom AI model training</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Dedicated infrastructure</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">99.99% SLA guarantee</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Dedicated account manager</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">24/7 priority support</span>
            </li>
          </ul>
          <a
            href="mailto:enterprise@eikon.studio"
            className="block w-full py-3 text-center border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </section>
  );
}

