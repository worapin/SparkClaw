<svelte:head>
  <title>Getting Started - SparkClaw</title>
</svelte:head>

<section class="pt-24 pb-20 px-6">
  <div class="max-w-3xl mx-auto">
    <div class="mb-12 stagger">
      <div class="inline-block mb-4 px-3 py-1 bg-terra-50 text-terra-600 rounded-full text-xs font-semibold uppercase tracking-wider">Documentation</div>
      <h1 class="font-display text-4xl mb-3">Getting Started</h1>
      <p class="text-warm-500 text-lg">Go from zero to a running AI assistant in 3 steps.</p>
    </div>

    <div class="space-y-8 stagger">
      <!-- Step 1 -->
      <div class="bg-white rounded-2xl border border-warm-200 p-8">
        <div class="flex items-start gap-5">
          <div class="w-10 h-10 bg-terra-500 text-white rounded-full flex items-center justify-center font-display text-lg shrink-0">1</div>
          <div class="flex-1">
            <h3 class="font-display text-xl mb-2">Create your account</h3>
            <p class="text-warm-500 leading-relaxed mb-4">Sign up with your email. We use passwordless magic codes — no password to remember.</p>
            <a href="/auth" class="text-sm font-semibold text-terra-500 hover:text-terra-600 transition-colors">Sign up now &rarr;</a>
          </div>
        </div>
      </div>

      <!-- Step 2 -->
      <div class="bg-white rounded-2xl border border-warm-200 p-8">
        <div class="flex items-start gap-5">
          <div class="w-10 h-10 bg-terra-500 text-white rounded-full flex items-center justify-center font-display text-lg shrink-0">2</div>
          <div class="flex-1">
            <h3 class="font-display text-xl mb-2">Choose a plan & subscribe</h3>
            <p class="text-warm-500 leading-relaxed mb-4">Pick Starter ($19), Pro ($39), or Scale ($79). Your OpenClaw instance is automatically provisioned within about a minute.</p>
            <a href="/pricing" class="text-sm font-semibold text-terra-500 hover:text-terra-600 transition-colors">See pricing &rarr;</a>
          </div>
        </div>
      </div>

      <!-- Step 3 -->
      <div class="bg-white rounded-2xl border border-warm-200 p-8">
        <div class="flex items-start gap-5">
          <div class="w-10 h-10 bg-terra-500 text-white rounded-full flex items-center justify-center font-display text-lg shrink-0">3</div>
          <div class="flex-1">
            <h3 class="font-display text-xl mb-2">Connect your channels</h3>
            <p class="text-warm-500 leading-relaxed mb-4">Open your instance's setup page and follow the wizard to connect Telegram, Discord, LINE, or any other channel.</p>
            <div class="bg-warm-900 rounded-xl p-5 mt-4">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-warm-500 text-xs font-mono">Telegram Bot Setup</span>
              </div>
              <pre class="text-sm text-warm-200 font-mono overflow-x-auto leading-relaxed"><code>1. Open @BotFather on Telegram
2. Send /newbot and follow prompts
3. Copy the bot token
4. Paste it in your OpenClaw setup page
5. Done! Your bot is live.</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Additional resources -->
    <div class="mt-12 p-6 bg-warm-100 rounded-2xl border border-warm-200">
      <h3 class="font-display text-lg mb-3">Need more help?</h3>
      <div class="grid md:grid-cols-2 gap-4">
        <span class="flex items-center gap-3 text-warm-700">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          <span class="text-sm font-medium">OpenClaw Documentation</span>
        </span>
        <span class="flex items-center gap-3 text-warm-700">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          <span class="text-sm font-medium">Community Discord</span>
        </span>
        <span class="flex items-center gap-3 text-warm-700">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <span class="text-sm font-medium">Email support</span>
        </span>
        <span class="flex items-center gap-3 text-warm-700">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
          <span class="text-sm font-medium">GitHub Repository</span>
        </span>
      </div>
    </div>
  </div>
</section>
