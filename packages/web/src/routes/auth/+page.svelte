<script lang="ts">
  import { sendOtp, verifyOtp } from "$lib/api";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { planSchema } from "@sparkclaw/shared/schemas";

  let email = $state("");
  let code = $state("");
  let step = $state<"email" | "otp">("email");
  let loading = $state(false);
  let error = $state("");

  function getValidPlan(): string | null {
    const raw = page.url.searchParams.get("plan");
    if (!raw) return null;
    const parsed = planSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

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
      await verifyOtp(email, code);
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

<section class="pt-32 pb-20 px-6 min-h-screen flex items-center justify-center">
  <div class="w-full max-w-md">
    <div class="text-center mb-8 stagger">
      <div class="w-14 h-14 bg-terra-500 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      </div>
      <h1 class="font-display text-3xl mb-2">Welcome back</h1>
      <p class="text-warm-500">Sign in with a magic code sent to your email</p>
    </div>

    {#if step === "email"}
      <div class="bg-white rounded-2xl border border-warm-200 p-8 shadow-sm animate-fade-up">
        <form onsubmit={handleSendOtp}>
          <label for="email" class="block text-sm font-medium text-warm-700 mb-2">Email address</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="you@example.com"
            required
            disabled={loading}
            class="w-full px-4 py-3 rounded-xl border border-warm-200 bg-warm-50 text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500 transition-all text-base disabled:opacity-50"
          />
          <button type="submit" disabled={loading || !email} class="btn-lift w-full mt-4 bg-terra-500 text-white py-3 rounded-xl font-semibold hover:bg-terra-600 transition-colors disabled:opacity-50 disabled:hover:transform-none">
            {loading ? "Sending..." : "Send Code"}
          </button>
        </form>
      </div>
    {:else}
      <div class="bg-white rounded-2xl border border-warm-200 p-8 shadow-sm animate-fade-up">
        <p class="text-sm text-warm-500 mb-4">We sent a 6-digit code to <strong class="text-warm-900">{email}</strong></p>
        <form onsubmit={handleVerifyOtp}>
          <label for="code" class="block text-sm font-medium text-warm-700 mb-2">Verification code</label>
          <input
            id="code"
            type="text"
            inputmode="numeric"
            pattern="[0-9]{6}"
            maxlength={6}
            bind:value={code}
            placeholder="000000"
            required
            disabled={loading}
            class="w-full px-4 py-3 rounded-xl border border-warm-200 bg-warm-50 text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500 transition-all text-center text-2xl tracking-[0.5em] font-mono disabled:opacity-50"
          />
          <button type="submit" disabled={loading || code.length !== 6} class="btn-lift w-full mt-4 bg-terra-500 text-white py-3 rounded-xl font-semibold hover:bg-terra-600 transition-colors disabled:opacity-50">
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
        <button class="w-full mt-3 text-sm text-warm-500 hover:text-warm-700 transition-colors" onclick={() => { step = "email"; code = ""; error = ""; }}>
          Use a different email
        </button>
      </div>
    {/if}

    {#if error}
      <div class="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm animate-fade-up">
        {error}
      </div>
    {/if}

    <p class="text-center text-sm text-warm-400 mt-6">No password needed. We'll email you a magic code.</p>
  </div>
</section>
