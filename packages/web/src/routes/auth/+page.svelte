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
  let showCode = $state(false);

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
          <h1 class="font-display text-3xl text-warm-900 mb-2">Welcome back</h1>
          <p class="text-warm-500">Enter your email to receive a magic sign-in code.</p>
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
            {loading ? "Sending..." : "Continue with Email"}
          </button>
        </form>

        <div class="mt-6">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-warm-200"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-4 bg-warm-50 text-warm-400">Or continue with</span>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-warm-200 bg-white text-warm-700 font-medium hover:bg-warm-100 transition-colors"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button
              type="button"
              class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-warm-200 bg-white text-warm-700 font-medium hover:bg-warm-100 transition-colors"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Apple
            </button>
          </div>
        </div>

        <p class="mt-8 text-center text-sm text-warm-500">
          Don't have an account? <a href="/pricing" class="text-terra-600 hover:text-terra-700 font-medium">Get started free</a>
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
    <div class="mt-auto pt-8 flex items-center justify-between text-sm text-warm-400">\n      <span>© 2026 WiseSpark Co., Ltd.</span>
      <a href="#" class="hover:text-warm-600">Privacy Policy</a>
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
    </div>
  </div>
</div>
