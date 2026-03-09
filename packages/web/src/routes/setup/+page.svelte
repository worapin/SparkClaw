<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getSetupState, saveSetup } from "$lib/api";
  import type { SetupWizardState, SetupChannelConfig, AIConfig, FeatureFlags } from "@sparkclaw/shared/types";

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state("");
  let step = $state(1);
  let wizardState = $state<SetupWizardState | null>(null);

  // Form state
  let instanceName = $state("");
  let selectedChannels = $state<SetupChannelConfig[]>([]);
  let aiConfig = $state<AIConfig>({
    model: "auto",
    persona: "friendly",
    language: "auto",
    temperature: 0.7,
    maxTokens: 4000,
  });
  let features = $state<FeatureFlags>({
    imageGeneration: true,
    webSearch: true,
    fileProcessing: true,
    voiceMessages: false,
    memory: true,
    codeExecution: false,
    mediaGeneration: false,
    calendar: false,
    email: false,
  });
  let customPrompt = $state("");

  const instanceId = page.url.searchParams.get("instance");

  const channelOptions = [
    { id: "telegram", name: "Telegram", icon: "📱", description: "Connect via Telegram bot" },
    { id: "discord", name: "Discord", icon: "💬", description: "Connect via Discord bot" },
    { id: "line", name: "LINE", icon: "💚", description: "Connect via LINE Official Account" },
    { id: "whatsapp", name: "WhatsApp", icon: "📲", description: "Connect via WhatsApp Business" },
    { id: "web", name: "Web Chat", icon: "🌐", description: "Embeddable web widget" },
    { id: "slack", name: "Slack", icon: "💼", description: "Connect via Slack app" },
    { id: "instagram", name: "Instagram", icon: "📸", description: "Connect via Instagram DM" },
    { id: "messenger", name: "Messenger", icon: "💙", description: "Connect via Facebook Messenger" },
  ];

  const modelOptions = [
    { id: "auto", name: "Auto (Recommended)", description: "Let the system choose the best model" },
    { id: "gpt-4o", name: "GPT-4o", description: "Most capable, best for complex tasks" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and cost-effective" },
    { id: "claude-sonnet", name: "Claude Sonnet", description: "Balanced performance" },
    { id: "claude-haiku", name: "Claude Haiku", description: "Fastest Claude model" },
    { id: "gemini-pro", name: "Gemini Pro", description: "Google's multimodal model" },
  ];

  const personaOptions = [
    { id: "professional", name: "Professional", description: "Formal, precise, business-focused" },
    { id: "friendly", name: "Friendly", description: "Warm, approachable, conversational" },
    { id: "creative", name: "Creative", description: "Imaginative, expressive, playful" },
    { id: "custom", name: "Custom", description: "Define your own personality" },
  ];

  const featureOptions = [
    { id: "imageGeneration", name: "Image Generation", icon: "🎨", description: "Generate images with DALL-E" },
    { id: "webSearch", name: "Web Search", icon: "🔍", description: "Search the web for real-time info" },
    { id: "fileProcessing", name: "File Processing", icon: "📄", description: "Parse PDFs, docs, spreadsheets" },
    { id: "memory", name: "Memory", icon: "🧠", description: "Remember conversation context" },
    { id: "voiceMessages", name: "Voice Messages", icon: "🎤", description: "Speech-to-text support" },
    { id: "codeExecution", name: "Code Execution", icon: "💻", description: "Run code snippets" },
    { id: "mediaGeneration", name: "Media Generation", icon: "🎵", description: "Generate music and videos" },
    { id: "calendar", name: "Calendar", icon: "📅", description: "Calendar integration" },
    { id: "email", name: "Email", icon: "📧", description: "Send emails on your behalf" },
  ];

  onMount(async () => {
    if (!instanceId) {
      goto("/dashboard");
      return;
    }
    try {
      const result = await getSetupState(instanceId);
      if (result.state) {
        wizardState = result.state;
        step = result.state.step;
        if (result.state.setupData) {
          instanceName = result.state.setupData.instanceName ?? "";
          selectedChannels = result.state.setupData.channels ?? [];
          aiConfig = result.state.setupData.aiConfig ?? aiConfig;
          features = result.state.setupData.features ?? features;
          customPrompt = result.state.setupData.aiConfig?.customPrompt ?? "";
        }
      }
    } catch {
      goto("/auth");
    } finally {
      loading = false;
    }
  });

  function toggleChannel(channelId: string) {
    const idx = selectedChannels.findIndex(c => c.type === channelId);
    if (idx >= 0) {
      selectedChannels = selectedChannels.filter(c => c.type !== channelId);
    } else {
      selectedChannels = [...selectedChannels, { type: channelId as any, enabled: true }];
    }
  }

  function isChannelSelected(channelId: string): boolean {
    return selectedChannels.some(c => c.type === channelId);
  }

  async function handleSave() {
    if (!instanceId) return;
    saving = true;
    errorMsg = "";

    try {
      await saveSetup({
        instanceId,
        instanceName: instanceName || undefined,
        channels: selectedChannels,
        aiConfig: {
          ...aiConfig,
          customPrompt: aiConfig.persona === "custom" ? customPrompt : undefined,
        },
        features,
      });

      goto("/dashboard?setup=complete");
    } catch (e) {
      errorMsg = (e as Error).message;
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Setup Your OpenClaw - SparkClaw</title>
</svelte:head>

{#if loading}
  <section class="pt-24 pb-20 px-6">
    <div class="max-w-2xl mx-auto text-center">
      <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-warm-500">Loading setup wizard...</p>
    </div>
  </section>
{:else if wizardState?.isConfigured}
  <section class="pt-24 pb-20 px-6">
    <div class="max-w-2xl mx-auto text-center">
      <h1 class="font-display text-3xl mb-4">Setup Complete!</h1>
      <p class="text-warm-500 mb-6">Your OpenClaw instance is already configured.</p>
      <a href="/dashboard" class="btn-lift inline-block bg-terra-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-terra-600 transition-colors">
        Go to Dashboard
      </a>
    </div>
  </section>
{:else}
  <section class="pt-24 pb-20 px-6">
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center justify-center mb-12">
        {#each [1, 2, 3, 4] as s}
          <div class="flex items-center">
            <div class="flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm
              {s === step ? 'bg-terra-500 text-white' : s < step ? 'bg-green-500 text-white' : 'bg-warm-200 text-warm-500'}">
              {s < step ? '✓' : s}
            </div>
            {#if s < 4}
              <div class="w-16 h-1 {s < step ? 'bg-green-500' : 'bg-warm-200'}"></div>
            {/if}
          </div>
        {/each}
      </div>

      {#if step === 1}
        <div class="stagger">
          <h1 class="font-display text-3xl text-center mb-2">Choose Your Channels</h1>
          <p class="text-warm-500 text-center mb-8">Select which platforms you want to connect your AI assistant to.</p>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {#each channelOptions as channel}
              <button
                onclick={() => toggleChannel(channel.id)}
                class="card-hover p-4 rounded-xl border-2 text-left transition-all
                  {isChannelSelected(channel.id) ? 'border-terra-500 bg-terra-50' : 'border-warm-200 bg-white'}"
              >
                <div class="text-2xl mb-2">{channel.icon}</div>
                <div class="font-semibold text-sm">{channel.name}</div>
                <div class="text-xs text-warm-500 mt-1">{channel.description}</div>
              </button>
            {/each}
          </div>

          {#if selectedChannels.length === 0}
            <p class="text-amber-600 text-sm text-center mb-4">⚠️ Please select at least one channel</p>
          {/if}

          <div class="flex justify-end">
            <button
              onclick={() => selectedChannels.length > 0 && (step = 2)}
              disabled={selectedChannels.length === 0}
              class="btn-lift bg-terra-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-terra-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          </div>
        </div>

      {:else if step === 2}
        <div class="stagger">
          <h1 class="font-display text-3xl text-center mb-2">Configure AI Behavior</h1>
          <p class="text-warm-500 text-center mb-8">Choose how your AI assistant should behave.</p>
          
          <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
            <h3 class="font-semibold mb-4">AI Model</h3>
            <div class="grid gap-3">
              {#each modelOptions as model}
                <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                  {aiConfig.model === model.id ? 'border-terra-500 bg-terra-50' : 'border-warm-200 hover:border-warm-300'}">
                  <input type="radio" name="model" value={model.id} bind:group={aiConfig.model} class="mt-1" />
                  <div>
                    <div class="font-medium">{model.name}</div>
                    <div class="text-sm text-warm-500">{model.description}</div>
                  </div>
                </label>
              {/each}
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
            <h3 class="font-semibold mb-4">Personality</h3>
            <div class="grid grid-cols-2 gap-3">
              {#each personaOptions as persona}
                <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                  {aiConfig.persona === persona.id ? 'border-terra-500 bg-terra-50' : 'border-warm-200 hover:border-warm-300'}">
                  <input type="radio" name="persona" value={persona.id} bind:group={aiConfig.persona} class="mt-1" />
                  <div>
                    <div class="font-medium">{persona.name}</div>
                    <div class="text-xs text-warm-500">{persona.description}</div>
                  </div>
                </label>
              {/each}
            </div>
            
            {#if aiConfig.persona === 'custom'}
              <textarea
                bind:value={customPrompt}
                placeholder="Describe how your AI should behave..."
                class="w-full mt-4 p-3 border border-warm-200 rounded-lg resize-none"
                rows="3"
              ></textarea>
            {/if}
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
            <h3 class="font-semibold mb-4">Language</h3>
            <div class="flex gap-3">
              {#each [{id: 'auto', name: 'Auto-detect'}, {id: 'en', name: 'English'}, {id: 'th', name: 'Thai'}] as lang}
                <label class="flex-1 p-3 rounded-lg border cursor-pointer text-center transition-all
                  {aiConfig.language === lang.id ? 'border-terra-500 bg-terra-50' : 'border-warm-200 hover:border-warm-300'}">
                  <input type="radio" name="language" value={lang.id} bind:group={aiConfig.language} class="sr-only" />
                  <span class="font-medium">{lang.name}</span>
                </label>
              {/each}
            </div>
          </div>

          <div class="flex justify-between">
            <button
              onclick={() => step = 1}
              class="px-6 py-3 rounded-xl font-semibold text-warm-600 hover:bg-warm-100 transition-colors"
            >
              ← Back
            </button>
            <button
              onclick={() => step = 3}
              class="btn-lift bg-terra-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-terra-600 transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>

      {:else if step === 3}
        <div class="stagger">
          <h1 class="font-display text-3xl text-center mb-2">Enable Features</h1>
          <p class="text-warm-500 text-center mb-8">Choose additional capabilities for your AI assistant.</p>
          
          <div class="grid gap-3 mb-8">
            {#each featureOptions as feature}
              <label class="flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all
                {features[feature.id as keyof FeatureFlags] ? 'border-terra-500 bg-terra-50' : 'border-warm-200 bg-white hover:border-warm-300'}">
                <input 
                  type="checkbox" 
                  checked={features[feature.id as keyof FeatureFlags]}
                  onchange={() => features[feature.id as keyof FeatureFlags] = !features[feature.id as keyof FeatureFlags]}
                  class="w-5 h-5 rounded"
                />
                <div class="text-xl">{feature.icon}</div>
                <div class="flex-1">
                  <div class="font-medium">{feature.name}</div>
                  <div class="text-sm text-warm-500">{feature.description}</div>
                </div>
              </label>
            {/each}
          </div>

          <div class="flex justify-between">
            <button
              onclick={() => step = 2}
              class="px-6 py-3 rounded-xl font-semibold text-warm-600 hover:bg-warm-100 transition-colors"
            >
              ← Back
            </button>
            <button
              onclick={() => step = 4}
              class="btn-lift bg-terra-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-terra-600 transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>

      {:else if step === 4}
        <div class="stagger">
          <h1 class="font-display text-3xl text-center mb-2">Review & Save</h1>
          <p class="text-warm-500 text-center mb-8">Confirm your setup and start using your AI assistant.</p>
          
          <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
            <h3 class="font-semibold mb-4">Summary</h3>
            
            <div class="space-y-4">
              <div>
                <div class="text-sm text-warm-500">Channels</div>
                <div class="flex flex-wrap gap-2 mt-1">
                  {#each selectedChannels as channel}
                    <span class="px-3 py-1 bg-terra-100 text-terra-700 rounded-full text-sm font-medium">
                      {channel.type}
                    </span>
                  {/each}
                </div>
              </div>
              
              <div>
                <div class="text-sm text-warm-500">AI Model</div>
                <div class="font-medium">{modelOptions.find(m => m.id === aiConfig.model)?.name}</div>
              </div>
              
              <div>
                <div class="text-sm text-warm-500">Personality</div>
                <div class="font-medium">{personaOptions.find(p => p.id === aiConfig.persona)?.name}</div>
              </div>
              
              <div>
                <div class="text-sm text-warm-500">Features</div>
                <div class="flex flex-wrap gap-2 mt-1">
                  {#each Object.entries(features) as [key, value]}
                    {#if value}
                      <span class="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        {featureOptions.find(f => f.id === key)?.name ?? key}
                      </span>
                    {/if}
                  {/each}
                </div>
              </div>
            </div>
          </div>

          {#if errorMsg}
            <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700">
              {errorMsg}
            </div>
          {/if}

          <div class="flex justify-between">
            <button
              onclick={() => step = 3}
              class="px-6 py-3 rounded-xl font-semibold text-warm-600 hover:bg-warm-100 transition-colors"
            >
              ← Back
            </button>
            <button
              onclick={handleSave}
              disabled={saving}
              class="btn-lift bg-terra-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-terra-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Complete Setup 🎉'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </section>
{/if}
