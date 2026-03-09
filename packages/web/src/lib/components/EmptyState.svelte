<script lang="ts">
  interface Props {
    icon?: "inbox" | "logs" | "search" | "error" | "key" | "users";
    title: string;
    description?: string;
    action?: {
      label: string;
      href?: string;
      onclick?: () => void;
    };
  }

  let { icon = "inbox", title, description, action }: Props = $props();

  const icons: Record<string, string> = {
    inbox: `<path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />`,
    logs: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />`,
    search: `<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />`,
    error: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />`,
    key: `<path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />`,
    users: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />`,
  };
</script>

<div class="text-center py-12">
  <!-- Icon -->
  <div class="w-16 h-16 bg-warm-100 rounded-full flex items-center justify-center mx-auto mb-4">
    <svg class="w-8 h-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      {@html icons[icon]}
    </svg>
  </div>

  <!-- Title -->
  <h3 class="font-display text-lg text-warm-800 mb-1">{title}</h3>

  <!-- Description -->
  {#if description}
    <p class="text-warm-500 text-sm mb-4 max-w-sm mx-auto">{description}</p>
  {/if}

  <!-- Action -->
  {#if action}
    {#if action.href}
      <a
        href={action.href}
        class="inline-flex items-center gap-2 bg-terra-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors"
      >
        {action.label}
      </a>
    {:else if action.onclick}
      <button
        onclick={action.onclick}
        class="inline-flex items-center gap-2 bg-terra-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors"
      >
        {action.label}
      </button>
    {/if}
  {/if}
</div>
