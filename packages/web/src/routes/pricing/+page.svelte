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
      features: ["Everything in Starter", "Priority support", "Custom domain (soon)", "Advanced analytics"],
    },
    {
      key: "scale", name: "Scale", price: 79, tagline: "For agencies and growing teams",
      features: ["Everything in Pro", "Higher resources", "Custom domain (soon)", "Dedicated support"],
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

<section class="pt-32 pb-20 px-6">
  <div class="max-w-5xl mx-auto">
    <div class="text-center mb-16 stagger">
      <h1 class="font-display text-4xl md:text-5xl mb-4">Simple, <span class="hand-underline">honest</span> pricing</h1>
      <p class="text-warm-500 text-lg max-w-lg mx-auto">Launch your own OpenClaw instance. No hidden fees. Cancel anytime.</p>
    </div>

    <div class="grid md:grid-cols-3 gap-6 stagger">
      {#each plans as plan}
        <div class="card-hover rounded-2xl p-8 flex flex-col relative {plan.key === 'pro' ? 'bg-warm-900 text-warm-50 ring-2 ring-terra-500 shadow-xl' : 'bg-white border border-warm-200'}">
          {#if plan.key === "pro"}
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-terra-500 text-white text-xs font-bold px-4 py-1 rounded-full">POPULAR</div>
          {/if}
          <h3 class="font-display text-2xl mb-1">{plan.name}</h3>
          <p class="{plan.key === 'pro' ? 'text-warm-400' : 'text-warm-500'} text-sm mb-6">{plan.tagline}</p>
          <div class="mb-6">
            <span class="font-display text-5xl">${plan.price}</span>
            <span class="{plan.key === 'pro' ? 'text-warm-400' : 'text-warm-500'}">/mo</span>
          </div>
          <ul class="space-y-3 mb-8 flex-1">
            {#each plan.features as feature}
              <li class="flex items-start gap-3 text-sm {plan.key === 'pro' ? 'text-warm-200' : 'text-warm-600'}">
                <svg class="w-5 h-5 {plan.key === 'pro' ? 'text-terra-400' : 'text-green-500'} mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                {feature}
              </li>
            {/each}
          </ul>
          <button
            onclick={() => handleSelect(plan.key)}
            disabled={loading !== null}
            class="w-full py-3 rounded-xl font-semibold transition-all {plan.key === 'pro' ? 'btn-lift bg-terra-500 text-white hover:bg-terra-600' : 'border-2 border-warm-200 text-warm-700 hover:border-warm-300 hover:bg-warm-50'}"
          >
            {loading === plan.key ? "Redirecting..." : "Get Started"}
          </button>
        </div>
      {/each}
    </div>

    <p class="text-center text-warm-400 text-sm mt-8">All plans include SSL, backups, monitoring, and auto-updates.</p>
  </div>
</section>
