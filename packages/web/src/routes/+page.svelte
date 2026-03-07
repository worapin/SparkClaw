<script lang="ts">
  import { PLANS } from "@sparkclaw/shared/constants";
  import type { Plan } from "@sparkclaw/shared/types";

  const plans: { key: Plan; name: string; price: number; features: string[] }[] = [
    {
      key: "starter",
      name: "Starter",
      price: 19,
      features: ["1 OpenClaw instance", "All 25+ channels", "Community support"],
    },
    {
      key: "pro",
      name: "Pro",
      price: 39,
      features: ["1 OpenClaw instance", "All 25+ channels", "Priority support", "Custom domain (soon)"],
    },
    {
      key: "scale",
      name: "Scale",
      price: 79,
      features: ["1 OpenClaw instance", "All 25+ channels", "Priority support", "Higher resources", "Custom domain (soon)"],
    },
  ];
</script>

<svelte:head>
  <title>SparkClaw - Managed OpenClaw Hosting</title>
  <meta name="description" content="Launch your own OpenClaw AI assistant in minutes. Zero DevOps required." />
</svelte:head>

<main>
  <!-- Hero -->
  <section class="hero">
    <h1>Launch your own OpenClaw in minutes.</h1>
    <p>We host OpenClaw on modern cloud for you. You focus on building.</p>
    <a href="/pricing" class="cta">Get Started</a>
  </section>

  <!-- Features -->
  <section class="features">
    <h2>Why SparkClaw?</h2>
    <div class="grid">
      <div>
        <h3>Zero DevOps</h3>
        <p>No VPS, Docker, or Railway config. We handle everything.</p>
      </div>
      <div>
        <h3>Instant Setup</h3>
        <p>From signup to a running OpenClaw instance in under 5 minutes.</p>
      </div>
      <div>
        <h3>25+ Channels</h3>
        <p>Telegram, Discord, LINE, WhatsApp, Slack, and more out of the box.</p>
      </div>
      <div>
        <h3>Predictable Pricing</h3>
        <p>Simple monthly plans. No surprise bills.</p>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section class="pricing" id="pricing">
    <h2>Simple Pricing</h2>
    <div class="plans">
      {#each plans as plan}
        <div class="plan-card">
          <h3>{plan.name}</h3>
          <p class="price">${plan.price}<span>/mo</span></p>
          <ul>
            {#each plan.features as feature}
              <li>{feature}</li>
            {/each}
          </ul>
          <a href="/auth?plan={plan.key}" class="cta">Get Started</a>
        </div>
      {/each}
    </div>
  </section>

  <!-- FAQ -->
  <section class="faq">
    <h2>FAQ</h2>
    <details>
      <summary>What is OpenClaw?</summary>
      <p>OpenClaw is an open-source AI assistant framework with 270k+ GitHub stars, supporting 25+ messaging channels.</p>
    </details>
    <details>
      <summary>Can I bring my own LLM API keys?</summary>
      <p>In the initial version, instances use our managed LLM gateway (Prism). BYOK support is on the roadmap.</p>
    </details>
    <details>
      <summary>What happens if I cancel?</summary>
      <p>Your instance is suspended but your data is kept for 30 days. You can re-subscribe to restore it.</p>
    </details>
    <details>
      <summary>Which LLM models are supported?</summary>
      <p>GPT-4o, Claude, Qwen 2.5, and more via our Prism gateway.</p>
    </details>
    <details>
      <summary>Is my data private?</summary>
      <p>Each user gets a fully isolated container. Your data is never shared with other users.</p>
    </details>
  </section>
</main>
