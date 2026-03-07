<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status} - SparkClaw</title>
</svelte:head>

<section class="pt-32 pb-20 px-6 min-h-screen flex items-center justify-center">
  <div class="text-center stagger">
    <div class="font-display text-[10rem] leading-none text-warm-200 mb-4 select-none" style="letter-spacing: -0.05em;">{page.status}</div>
    <h1 class="font-display text-3xl mb-3">
      {#if page.status === 404}
        Page not found
      {:else}
        Something went wrong
      {/if}
    </h1>
    <p class="text-warm-500 text-lg mb-8 max-w-md mx-auto">
      {#if page.status === 404}
        The page you're looking for doesn't exist or has been moved. Let's get you back on track.
      {:else}
        {page.error?.message || "An unexpected error occurred."}
      {/if}
    </p>
    <a href="/" class="btn-lift inline-block bg-terra-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-terra-600 transition-colors">
      Back to Home
    </a>
  </div>
</section>
