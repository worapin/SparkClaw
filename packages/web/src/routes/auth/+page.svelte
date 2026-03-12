<script lang="ts">
  import { sendOtp, verifyOtp } from "$lib/api";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { planSchema } from "@sparkclaw/shared/schemas";
  import type { Plan } from "@sparkclaw/shared/types";

  let email = $state("");
  let code = $state("");
  let step = $state<"email" | "otp">("email");
  let loading = $state(false);
  let error = $state("");
  let showCode = $state(false);

  function getValidPlan(): Plan | null {
    const raw = page.url.searchParams.get("plan");
    if (!raw) return null;
    const parsed = planSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  const planMeta: Record<Plan, { label: string; price: string; note: string }> = {
    starter: {
      label: "Starter",
      price: "$19/mo",
      note: "1 instance. Best for trying SparkClaw.",
    },
    pro: {
      label: "Pro",
      price: "$39/mo",
      note: "Up to 3 instances. Most popular.",
    },
    scale: {
      label: "Scale",
      price: "$79/mo",
      note: "Up to 10 instances for teams.",
    },
  };

  const selectedPlan = $derived(getValidPlan());
  const selectedPlanMeta = $derived(selectedPlan ? planMeta[selectedPlan] : null);

  async function handleSendOtp() {
    loading = true;
    error = "";
    try {
      await sendOtp(email);
      step = "otp";
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to send code";
    } finally {
      loading = false;
    }
  }

  async function handleVerifyOtp() {
    loading = true;
    error = "";
    try {
      const cleanCode = code.replace(/\D/g, ""); // Remove non-digits
      await verifyOtp(email, cleanCode);
      const validPlan = getValidPlan();
      if (validPlan) {
        goto(`/dashboard?plan=${validPlan}`);
      } else {
        goto("/dashboard");
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Invalid code";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in - SparkClaw</title>
</svelte:head>

<div class="min-h-screen flex">
  <!-- Left Side - Login Form -->
  <div class="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 bg-warm-50">
    <div class="w-full max-w-md mx-auto">
      <!-- Logo -->
      <div class="flex items-center gap-2.5 mb-8">
        <div class="w-10 h-10 bg-terra-500 rounded-xl flex items-center justify-center">
          <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <span class="font-display text-2xl text-warm-900">SparkClaw</span>
      </div>

      {#if step === "email"}
        <!-- Email Step -->
        <div class="mb-8">
          <h1 class="font-display text-3xl text-warm-900 mb-2">{selectedPlan ? "Complete your signup" : "Welcome back"}</h1>
          <p class="text-warm-500">
            {selectedPlan ? "Enter your email to continue checkout securely." : "Enter your email to receive a magic sign-in code."}
          </p>
          {#if selectedPlanMeta}
            <div class="mt-4 soft-card p-4">
              <div class="text-xs uppercase tracking-wider text-warm-400 mb-1">Selected Plan</div>
              <div class="font-semibold text-warm-800">{selectedPlanMeta.label} <span class="text-terra-600">{selectedPlanMeta.price}</span></div>
              <div class="text-sm text-warm-500 mt-1">{selectedPlanMeta.note}</div>
            </div>
          {/if}
        </div>

        <form onsubmit={handleSendOtp} class="space-y-5">
          <div>
            <label for="email" class="block text-sm font-medium text-warm-700 mb-2">Email address</label>
            <input
              id="email"
              type="email"
              bind:value={email}
              placeholder="you@company.com"
              required
              disabled={loading}
              class="w-full px-4 py-3.5 rounded-xl border border-warm-200 bg-white text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500 transition-all text-base disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            class="w-full bg-terra-500 text-white py-3.5 rounded-xl font-semibold hover:bg-terra-600 transition-all disabled:opacity-50 disabled:hover:bg-terra-500 flex items-center justify-center gap-2"
          >
            {loading ? "Sending..." : (selectedPlan ? "Continue to Checkout" : "Continue with Email")}
          </button>
        </form>

        <p class="mt-8 text-center text-sm text-warm-500">
          Don't have an account? <a href="/pricing" class="text-terra-600 hover:text-terra-700 font-medium">Choose a plan</a>
        </p>
      {:else}
        <!-- OTP Step -->
        <div class="mb-8">
          <h1 class="font-display text-3xl text-warm-900 mb-2">Check your email</h1>
          <p class="text-warm-500">We sent a 6-digit code to <strong class="text-warm-900">{email}</strong></p>
        </div>

        <form onsubmit={handleVerifyOtp} class="space-y-5">
          <div>
            <label for="code" class="block text-sm font-medium text-warm-700 mb-2">Verification code</label>
            <div class="relative">
              <input
                id="code"
                type={showCode ? "text" : "password"}
                inputmode="numeric"
                maxlength={6}
                bind:value={code}
                placeholder="000000"
                required
                disabled={loading}
                class="w-full px-4 py-3.5 rounded-xl border border-warm-200 bg-white text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500 transition-all text-center text-2xl tracking-[0.5em] font-mono disabled:opacity-50"
                oninput={(e) => { code = e.currentTarget.value.replace(/\D/g, ""); }}
              />
              <button
                type="button"
                onclick={() => showCode = !showCode}
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-warm-400 hover:text-warm-600"
              >
                {#if showCode}
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                {:else}
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                {/if}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            class="w-full bg-terra-500 text-white py-3.5 rounded-xl font-semibold hover:bg-terra-600 transition-all disabled:opacity-50 disabled:hover:bg-terra-500 flex items-center justify-center gap-2"
          >
            {loading ? "Verifying..." : "Verify & Sign In"}
          </button>
        </form>

        <button
          class="mt-4 w-full text-sm text-warm-500 hover:text-warm-700 transition-colors"
          onclick={() => { step = "email"; code = ""; error = ""; }}
        >
          Use a different email
        </button>
      {/if}

      {#if error}
        <div class="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="mt-auto pt-8 flex items-center justify-between text-sm text-warm-400">
      <span>© 2026 WiseSpark Co., Ltd.</span>
      <button type="button" class="hover:text-warm-600">Privacy Policy</button>
    </div>
  </div>

  <!-- Right Side - Hero -->
  <div class="hidden lg:flex lg:flex-1 bg-gradient-to-br from-warm-800 via-warm-900 to-warm-950 relative overflow-hidden">
    <!-- Decorative elements -->
    <div class="absolute inset-0">
      <div class="absolute top-20 left-20 w-72 h-72 bg-terra-500/20 rounded-full blur-3xl"></div>
      <div class="absolute bottom-20 right-20 w-96 h-96 bg-terra-600/10 rounded-full blur-3xl"></div>
    </div>

    <div class="relative z-10 flex flex-col justify-center px-12 xl:px-16">
      <h2 class="font-display text-4xl xl:text-5xl text-white mb-4 leading-tight">
        Launch your AI assistant<br/>in minutes, not months.
      </h2>
      <p class="text-warm-300 text-lg mb-8 max-w-lg">
        Deploy OpenClaw with zero DevOps. Let us handle the infrastructure while you focus on building amazing AI experiences.
      </p>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-6 mb-8">
        <div class="bg-white/5 backdrop-blur rounded-2xl p-4">
          <div class="font-display text-3xl text-terra-400 mb-1">270k+</div>
          <div class="text-warm-400 text-sm">GitHub Stars</div>
        </div>
        <div class="bg-white/5 backdrop-blur rounded-2xl p-4">
          <div class="font-display text-3xl text-terra-400 mb-1">&lt;5m</div>
          <div class="text-warm-400 text-sm">Setup Time</div>
        </div>
        <div class="bg-white/5 backdrop-blur rounded-2xl p-4">
          <div class="font-display text-3xl text-terra-400 mb-1">99.9%</div>
          <div class="text-warm-400 text-sm">Uptime SLA</div>
        </div>
      </div>

      <!-- Mock Dashboard Card -->
      <div class="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
        <div class="flex items-center justify-between mb-4">
          <span class="text-white font-medium">Your Dashboard</span>
          <span class="text-terra-400 text-sm">Live Preview</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white/10 rounded-xl p-3">
            <div class="text-warm-400 text-xs mb-1">Total Messages</div>
            <div class="text-white font-semibold">128,459</div>
          </div>
          <div class="bg-white/10 rounded-xl p-3">
            <div class="text-warm-400 text-xs mb-1">Active Users</div>
            <div class="text-white font-semibold">2,847</div>
          </div>
          <div class="bg-white/10 rounded-xl p-3">
            <div class="text-warm-400 text-xs mb-1">Response Time</div>
            <div class="text-terra-400 font-semibold">0.8s</div>
          </div>
          <div class="bg-white/10 rounded-xl p-3">
            <div class="text-warm-400 text-xs mb-1">Satisfaction</div>
            <div class="text-terra-400 font-semibold">98.2%</div>
          </div>
        </div>
      </div>
      <p class="text-warm-400 text-sm mt-5">No long forms. Just email + one-time code.</p>
    </div>
  </div>
</div>
