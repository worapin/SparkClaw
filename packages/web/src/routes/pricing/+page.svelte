<script lang="ts">
  import { createCheckout } from "$lib/api";
  import type { Plan } from "@sparkclaw/shared/types";

  let loading = $state<Plan | null>(null);

  const plans: { key: Plan; name: string; price: number; features: string[] }[] = [
    {
      key: "starter",
      name: "Starter",
      price: 19,
      features: ["1 OpenClaw instance", "All 25+ channels", "Community support", "Prism LLM gateway"],
    },
    {
      key: "pro",
      name: "Pro",
      price: 39,
      features: ["1 OpenClaw instance", "All 25+ channels", "Priority support", "Prism LLM gateway", "Custom domain (soon)"],
    },
    {
      key: "scale",
      name: "Scale",
      price: 79,
      features: ["1 OpenClaw instance", "All 25+ channels", "Priority support", "Prism LLM gateway", "Higher resources", "Custom domain (soon)"],
    },
  ];

  async function handleSelect(plan: Plan) {
    loading = plan;
    try {
      const { url } = await createCheckout(plan);
      window.location.href = url;
    } catch {
      // If not logged in, redirect to auth with plan
      window.location.href = `/auth?plan=${plan}`;
    } finally {
      loading = null;
    }
  }
</script>

<svelte:head>
  <title>Pricing - SparkClaw</title>
</svelte:head>

<main>
  <section class="pricing-page">
    <h1>Simple, Predictable Pricing</h1>
    <p>Launch your own OpenClaw instance. Cancel anytime.</p>

    <div class="plans">
      {#each plans as plan}
        <div class="plan-card" class:popular={plan.key === "pro"}>
          {#if plan.key === "pro"}
            <span class="badge">Popular</span>
          {/if}
          <h2>{plan.name}</h2>
          <p class="price">${plan.price}<span>/mo</span></p>
          <ul>
            {#each plan.features as feature}
              <li>{feature}</li>
            {/each}
          </ul>
          <button
            onclick={() => handleSelect(plan.key)}
            disabled={loading !== null}
          >
            {loading === plan.key ? "Redirecting..." : "Get Started"}
          </button>
        </div>
      {/each}
    </div>
  </section>
</main>
