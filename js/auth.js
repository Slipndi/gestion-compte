import { ctx } from './ctx.js';
import { state } from './state.js';
import { $ } from './utils.js';
import { bootstrap } from './data.js';
import { render } from './render.js';

let mode = "in";

export function initAuth() {
  $("auth-toggle").onclick = () => {
    mode = mode === "in" ? "up" : "in";
    $("auth-sub").textContent = mode === "in"
      ? "Connecte-toi pour accéder à tes comptes."
      : "Crée ton compte (email + mot de passe).";
    $("auth-go").textContent    = mode === "in" ? "Se connecter" : "Créer le compte";
    $("auth-toggle").textContent = mode === "in" ? "Pas de compte ? Créer un compte" : "Déjà un compte ? Se connecter";
    $("auth-err").textContent = "";
  };
  $("auth-go").onclick = doAuth;
  $("password").addEventListener("keydown", e => { if (e.key === "Enter") doAuth(); });

  ctx.sb.auth.onAuthStateChange((_e, s) => {
    state.session = s;
    if (s) showApp(); else showAuth();
  });
}

async function doAuth() {
  const email    = $("email").value.trim();
  const password = $("password").value;
  $("auth-err").textContent = "";
  if (!email || !password) return ($("auth-err").textContent = "Email et mot de passe requis.");
  const fn = mode === "in"
    ? ctx.sb.auth.signInWithPassword({ email, password })
    : ctx.sb.auth.signUp({ email, password });
  const { data, error } = await fn;
  if (error) return ($("auth-err").textContent = error.message);
  if (mode === "up" && !data.session)
    return ($("auth-err").textContent = "Compte créé. Confirme l'email puis connecte-toi.");
}

export function showAuth() {
  const nav = $("nav");
  $("auth").hidden = false;
  $("app").hidden  = true;
  nav.classList.remove("pointer-events-auto", "opacity-100");
  nav.classList.add("pointer-events-none", "opacity-0");
}

export async function showApp() {
  const nav = $("nav");
  $("auth").hidden = true;
  $("app").hidden  = false;
  nav.classList.remove("pointer-events-none", "opacity-0");
  nav.classList.add("pointer-events-auto", "opacity-100");
  await bootstrap();
  render();
}
