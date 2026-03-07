<script lang="ts">
  import type { Plan } from "@sparkclaw/shared/types";

  const plans: { key: Plan; name: string; price: number; features: string[] }[] = [
    { key: "starter", name: "Starter", price: 19, features: ["1 OpenClaw instance", "All 25+ channels", "Community support"] },
    { key: "pro", name: "Pro", price: 39, features: ["1 OpenClaw instance", "All 25+ channels", "Priority support", "Custom domain (soon)"] },
    { key: "scale", name: "Scale", price: 79, features: ["1 OpenClaw instance", "All 25+ channels", "Priority support", "Higher resources", "Custom domain (soon)"] },
  ];
</script>

<svelte:head>
  <title>SparkClaw - Managed OpenClaw Hosting</title>
  <meta name="description" content="Launch your own OpenClaw AI assistant in minutes. Zero DevOps required." />
</svelte:head>

<!-- Hero -->
<section class="pt-32 pb-20 px-6">
  <div class="max-w-4xl mx-auto text-center stagger">
    <div class="inline-block mb-6 px-4 py-1.5 bg-terra-50 text-terra-600 rounded-full text-sm font-medium border border-terra-100">
      Powered by OpenClaw (270k+ stars)
    </div>
    <h1 class="font-display text-5xl md:text-7xl leading-tight tracking-tight mb-6">
      Launch your own<br><span class="hand-underline text-terra-500">AI assistant</span> in minutes
    </h1>
    <p class="text-lg md:text-xl text-warm-500 max-w-2xl mx-auto mb-10 leading-relaxed">
      We host OpenClaw on modern cloud infrastructure for you. Connect Telegram, Discord, LINE, and 25+ channels. Zero DevOps required.
    </p>
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a href="/pricing" class="btn-lift bg-terra-500 text-white px-8 py-3.5 rounded-xl font-semibold text-lg hover:bg-terra-600 transition-colors text-center">
        Start for $19/mo
      </a>
      <a href="/docs" class="bg-warm-100 text-warm-700 px-8 py-3.5 rounded-xl font-semibold text-lg hover:bg-warm-200 transition-colors border border-warm-200 text-center">
        Read the docs
      </a>
    </div>
  </div>
</section>

<!-- Trust -->
<section class="pb-16 px-6">
  <div class="max-w-4xl mx-auto text-center">
    <p class="text-sm text-warm-400 uppercase tracking-widest mb-6 font-medium">Built on technology trusted by</p>
    <div class="flex items-center justify-center gap-10 flex-wrap text-warm-300 text-2xl font-display italic">
      <span>Stripe</span>
      <span class="text-warm-200">|</span>
      <span>Railway</span>
      <span class="text-warm-200">|</span>
      <span>Neon</span>
      <span class="text-warm-200">|</span>
      <span>OpenClaw</span>
    </div>
  </div>
</section>

<div class="squiggle-divider max-w-2xl mx-auto"></div>

<!-- Features -->
<section class="py-20 px-6">
  <div class="max-w-6xl mx-auto">
    <div class="text-center mb-16 stagger">
      <h2 class="font-display text-3xl md:text-4xl mb-4">Everything you need,<br>nothing you don't</h2>
      <p class="text-warm-500 text-lg">From signup to a running AI assistant in under 5 minutes.</p>
    </div>
    <div class="grid md:grid-cols-2 gap-6 stagger">
      <div class="card-hover bg-white rounded-2xl p-8 border border-warm-200">
        <div class="w-12 h-12 bg-terra-50 rounded-xl flex items-center justify-center mb-5">
          <svg class="w-6 h-6 text-terra-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        <h3 class="font-display text-xl mb-2">Instant Provisioning</h3>
        <p class="text-warm-500 leading-relaxed">Subscribe and your OpenClaw instance is automatically deployed. No VPS, no Docker, no Railway config.</p>
      </div>
      <div class="card-hover bg-white rounded-2xl p-8 border border-warm-200">
        <div class="w-12 h-12 bg-terra-50 rounded-xl flex items-center justify-center mb-5">
          <svg class="w-6 h-6 text-terra-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        </div>
        <h3 class="font-display text-xl mb-2">25+ Channels</h3>
        <p class="text-warm-500 leading-relaxed">Telegram, Discord, LINE, WhatsApp, Slack, Facebook Messenger, and more. One instance, every platform.</p>
      </div>
      <div class="card-hover bg-white rounded-2xl p-8 border border-warm-200">
        <div class="w-12 h-12 bg-terra-50 rounded-xl flex items-center justify-center mb-5">
          <svg class="w-6 h-6 text-terra-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        </div>
        <h3 class="font-display text-xl mb-2">Managed & Secure</h3>
        <p class="text-warm-500 leading-relaxed">SSL, backups, monitoring, and auto-updates handled for you. Each user gets a fully isolated container.</p>
      </div>
      <div class="card-hover bg-white rounded-2xl p-8 border border-warm-200">
        <div class="w-12 h-12 bg-terra-50 rounded-xl flex items-center justify-center mb-5">
          <svg class="w-6 h-6 text-terra-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h3 class="font-display text-xl mb-2">Predictable Pricing</h3>
        <p class="text-warm-500 leading-relaxed">Simple monthly plans starting at $19. No surprise compute bills, no hidden fees. Cancel anytime.</p>
      </div>
    </div>
  </div>
</section>

<!-- Stats -->
<section class="py-16 px-6 bg-warm-900 text-warm-50">
  <div class="max-w-4xl mx-auto">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center stagger">
      <div>
        <div class="font-display text-4xl md:text-5xl text-terra-400 mb-2">270k+</div>
        <div class="text-warm-400 text-sm">GitHub Stars</div>
      </div>
      <div>
        <div class="font-display text-4xl md:text-5xl text-terra-400 mb-2">25+</div>
        <div class="text-warm-400 text-sm">Channels</div>
      </div>
      <div>
        <div class="font-display text-4xl md:text-5xl text-terra-400 mb-2">&lt;5m</div>
        <div class="text-warm-400 text-sm">Setup Time</div>
      </div>
      <div>
        <div class="font-display text-4xl md:text-5xl text-terra-400 mb-2">99.9%</div>
        <div class="text-warm-400 text-sm">Uptime SLA</div>
      </div>
    </div>
  </div>
</section>

<!-- FAQ -->
<section class="py-20 px-6">
  <div class="max-w-2xl mx-auto">
    <h2 class="font-display text-3xl md:text-4xl text-center mb-12">Frequently asked</h2>
    <div class="space-y-4 stagger">
      <details class="bg-white rounded-xl border border-warm-200 px-6 py-5">
        <summary class="font-medium text-warm-800 flex items-center">What is OpenClaw?</summary>
        <p class="mt-3 text-warm-500 leading-relaxed pl-7">OpenClaw is an open-source AI assistant framework with 270k+ GitHub stars, supporting 25+ messaging channels. SparkClaw hosts it for you.</p>
      </details>
      <details class="bg-white rounded-xl border border-warm-200 px-6 py-5">
        <summary class="font-medium text-warm-800 flex items-center">Can I bring my own LLM API keys?</summary>
        <p class="mt-3 text-warm-500 leading-relaxed pl-7">In V0, instances use our managed LLM gateway (Prism). BYOK support is on the roadmap.</p>
      </details>
      <details class="bg-white rounded-xl border border-warm-200 px-6 py-5">
        <summary class="font-medium text-warm-800 flex items-center">What happens if I cancel?</summary>
        <p class="mt-3 text-warm-500 leading-relaxed pl-7">Your instance is suspended but your data is kept for 30 days. Re-subscribe to restore it.</p>
      </details>
      <details class="bg-white rounded-xl border border-warm-200 px-6 py-5">
        <summary class="font-medium text-warm-800 flex items-center">Which LLM models are supported?</summary>
        <p class="mt-3 text-warm-500 leading-relaxed pl-7">GPT-4o, Claude, Qwen 2.5, and more via our Prism gateway. Model selection available in setup.</p>
      </details>
      <details class="bg-white rounded-xl border border-warm-200 px-6 py-5">
        <summary class="font-medium text-warm-800 flex items-center">Is my data private?</summary>
        <p class="mt-3 text-warm-500 leading-relaxed pl-7">Each user gets a fully isolated container. Your data is never shared with other users.</p>
      </details>
    </div>
  </div>
</section>
