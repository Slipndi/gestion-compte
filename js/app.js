import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { ctx } from './ctx.js';
import { state } from './state.js';
import { $ } from './utils.js';
import { initAuth, showApp, showAuth } from './auth.js';
import { render } from './render.js';

// Vérification de la configuration
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes("VOTRE_SUPABASE")) {
  document.body.innerHTML = `<div class="min-h-screen flex items-center justify-center bg-bg text-slate-100"><div class="max-w-md mx-auto rounded-3xl border border-slate-800 bg-slate-950/80 px-5 py-6 shadow-2xl"><h1 class="text-lg font-semibold mb-3">Configuration requise</h1><p class="text-sm text-slate-400">Copie <code>config.example.js</code> en <code>config.js</code> et renseigne <code>SUPABASE_URL</code> et <code>SUPABASE_ANON_KEY</code>. Puis recharge.</p></div></div>`;
} else {
  ctx.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Navigation par onglets
  $("nav").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    state.tab = b.dataset.tab;
    render();
  });
  $("logout").onclick = () => ctx.sb.auth.signOut();

  // Auth
  initAuth();
  ctx.sb.auth.getSession().then(({ data }) => {
    state.session = data.session;
    if (data.session) showApp(); else showAuth();
  });

  // Service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
}
