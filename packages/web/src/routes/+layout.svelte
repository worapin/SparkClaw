<script lang="ts">
  import '../app.css';
  import Navbar from '$lib/components/Navbar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { toasts } from '$lib/stores/toast';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="grain min-h-screen flex flex-col">
  <Navbar />
  <main class="flex-1">
    {@render children()}
  </main>
  <Footer />
</div>

<!-- Toast notifications -->
<div class="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3">
  {#each $toasts as toast (toast.id)}
    <div class="flex items-center gap-3 px-5 py-4 rounded-xl border shadow-lg animate-fade-up {toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}">
      <span class="font-semibold">{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠' : 'ℹ'}</span>
      <span>{toast.message}</span>
      <button onclick={() => toasts.remove(toast.id)} class="ml-2 hover:opacity-70 transition-opacity">✕</button>
    </div>
  {/each}
</div>
