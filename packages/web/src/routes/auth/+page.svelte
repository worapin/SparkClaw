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

<main>
  <div class="auth-container">
    <h1>Sign in to SparkClaw</h1>

    {#if step === "email"}
      <form onsubmit={handleSendOtp}>
        <label for="email">Email address</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="you@example.com"
          required
          disabled={loading}
        />
        <button type="submit" disabled={loading || !email}>
          {loading ? "Sending..." : "Send Code"}
        </button>
      </form>
    {:else}
      <p>We sent a 6-digit code to <strong>{email}</strong></p>
      <form onsubmit={handleVerifyOtp}>
        <label for="code">Verification code</label>
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
        />
        <button type="submit" disabled={loading || code.length !== 6}>
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>
      <button class="link" onclick={() => { step = "email"; code = ""; error = ""; }}>
        Use a different email
      </button>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
</main>
