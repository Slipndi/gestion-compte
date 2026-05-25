# Budget — app multi-plateforme (Supabase)

App web installable (PWA) : login sécurisé, reste à dépenser par mois, dépenses
catégorisées, paiements récurrents (avec/sans date de fin), revenus modifiables
mois par mois, et analyse rapide. Données privées par compte (Row-Level Security).

## 1. Créer le projet Supabase (5 min)

1. Va sur https://supabase.com → **New project**. Note le mot de passe DB (pas
   utilisé par l'app, mais à garder).
2. Menu **SQL Editor → New query** → colle tout le contenu de `schema.sql` → **Run**.
   Ça crée les tables et active la sécurité RLS.
3. Menu **Authentication → Sign In / Providers → Email** : laisse activé.
   - Pour aller vite en perso : **Authentication → Settings**, désactive
     « Confirm email ». Sinon, le 1er compte devra confirmer via le mail reçu.

## 2. Brancher l'app

1. **Settings → API**, copie :
   - *Project URL* → dans `index.html`, remplace `SUPABASE_URL`
   - *anon public* (clé) → remplace `SUPABASE_ANON_KEY`
2. La clé *anon* est **publique par conception** : aucun risque à la mettre dans
   le HTML, car la RLS empêche tout accès aux données d'un autre compte. (Ne mets
   JAMAIS la clé *service_role* ici.)

## 3. Lancer

- **En local (test)** : depuis le dossier, `python3 -m http.server 8080` puis
  ouvre http://localhost:8080 (le chiffrement/login exige http://localhost ou HTTPS,
  pas un double-clic sur le fichier).
- **En ligne (recommandé, pour l'avoir partout + l'installer sur le tél)** :
  - Le plus simple : https://app.netlify.com/drop → glisse le dossier `budget-app`.
  - Ou GitHub Pages, ou `vercel` / `netlify deploy`.
  - Une fois servie en HTTPS, le navigateur proposera « Ajouter à l'écran d'accueil ».

## 4. Premier lancement

- Crée ton compte (email + mot de passe).
- Les catégories de base et tes revenus par défaut (Ludovic 2640 / Marie-Laure
  2300 / Aides 616) sont pré-créés — modifiables dans l'onglet **Revenus**.
- Onglet **Récurrents** → bouton « Importer le modèle (mars 2026) » pour charger
  tes prélèvements d'un coup, puis ajuste.

## Notes

- **Sécurité** : auth Supabase + RLS. Chaque compte ne lit/écrit que ses lignes.
  Pour durcir : active la double authentification (MFA) côté Supabase, et un mot
  de passe fort. Pour des données très sensibles, fais relire l'archi par un pro.
- **Multi-appareil** : connecte-toi avec le même compte depuis n'importe quel
  navigateur ou téléphone — tout est synchronisé en temps réel via Supabase.
- **Reste à dépenser** = revenus du mois − récurrents actifs du mois − dépenses
  du mois.
