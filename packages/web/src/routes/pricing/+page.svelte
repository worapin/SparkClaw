<script lang="ts">
  import { createCheckout } from "$lib/api";
  import type { Plan } from "@sparkclaw/shared/types";

  let loading = $state<Plan | null>(null);

  const plans: { key: Plan; name: string; price: number; tagline: string; features: string[] }[] = [
    {
      key: "starter", name: "Starter", price: 19, tagline: "For trying things out",
      features: ["1 OpenClaw instance", "All 25+ channels", "Prism LLM gateway", "Community support"],
    },
    {
      key: "pro", name: "Pro", price: 39, tagline: "For creators and indie devs",
      features: ["Up to 3 instances", "Everything in Starter", "Priority support", "Custom domain (soon)"],
    },
    {
      key: "scale", name: "Scale", price: 79, tagline: "For agencies and growing teams",
      features: ["Up to 10 instances", "Everything in Pro", "Higher resources", "Dedicated support"],
    },
  ];

  async function handleSelect(plan: Plan) {
    loading = plan;
    try {
      const { url } = await createCheckout(plan);
      window.location.href = url;
    } catch {
      window.location.href = `/auth?plan=${plan}`;
    } finally {
      loading = null;
    }
  }
</script>

<svelte:head>
  <title>Pricing - SparkClaw</title>
</svelte:head>

<section class="pt-28 pb-20 px-6">
  <div class="max-w-5xl mx-auto">
    <div class="text-center mb-14 stagger">
      <div class="section-kicker mb-3">Pricing</div>
      <h1 class="font-display text-4xl md:text-6xl mb-4">Pick a plan that matches your launch stage</h1>
      <p class="text-warm-600 text-lg max-w-2xl mx-auto">All tiers include managed deployments, SSL, monitoring, and guided setup.</p>
      <div class="mt-3 text-sm text-warm-500">Cancel anytime. Your data is retained for 30 days after cancellation.</div>
    </div>

    <div class="grid md:grid-cols-3 gap-6 stagger">
      {#each plans as plan}
        <div class="pricing-card p-8 flex flex-col relative {plan.key === 'pro' ? 'featured' : ''}">
          {#if plan.key === "pro"}
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-terra-500 text-white text-xs font-bold px-4 py-1 rounded-full">Most Popular</div>
          {/if}
          <h3 class="font-display text-2xl mb-1">{plan.name}</h3>
          <p class="text-warm-500 text-sm mb-6">{plan.tagline}</p>
          <div class="mb-6">
            <span class="font-display text-5xl">${plan.price}</span><span class="text-warm-500">/mo</span>
          </div>
          <ul class="space-y-3 mb-8 flex-1">
            {#each plan.features as feature}
              <li class="flex items-start gap-3 text-sm text-warm-700">
                <svg class="w-5 h-5 text-terra-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                {feature}
              </li>
            {/each}
          </ul>
          <button
            onclick={() => handleSelect(plan.key)}
            disabled={loading !== null}
            class="w-full py-3 font-semibold transition-all {plan.key === 'pro' ? 'btn-primary' : 'btn-ghost'}"
          >
            {loading === plan.key ? "Redirecting..." : (plan.key === "pro" ? "Start Pro Setup" : `Choose ${plan.name}`)}
          </button>
        </div>
      {/each}
    </div>

    <div class="mt-10 grid md:grid-cols-3 gap-3">
      <div class="soft-card p-4 text-sm text-warm-600">Provisioning starts right after successful checkout.</div>
      <div class="soft-card p-4 text-sm text-warm-600">No platform lock-in. Keep your OpenClaw configs portable.</div>
      <div class="soft-card p-4 text-sm text-warm-600">Need custom limits or migration support? Contact us.</div>
    </div>
  </div>
</section>
