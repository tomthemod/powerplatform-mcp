# CLAUDE.md — règles absolues du repo

Ce fichier est lu automatiquement par Claude Code. **Toutes les règles ci-dessous sont contraignantes pour toute modification du repo, sans exception.**

---

## R-1 : `README.md` doit être systématiquement mis à jour

Tout ajout ou modification d'un outil MCP, d'une commande CLI, d'un service ou d'un comportement utilisateur-visible **DOIT** s'accompagner d'une mise à jour de [`README.md`](README.md) **dans le même commit**.

- Nouvel outil MCP → ajouter une ligne dans la table de la section pertinente (`Outils MCP`), avec le préfixe 🆕.
- Nouvelle commande CLI → ajouter sous `## CLI` › `### Commandes principales (extrait)`.
- Changement de signature d'un outil existant → mettre à jour la table.
- Suppression d'un outil → retirer la ligne (et noter dans la roadmap projet appelant si rétrocompatibilité concernée).
- Nouvelle limite/préflight (ex. `iscustomizable`, refus silencieux Dataverse) → mentionner dans la description de l'outil concerné, voire ajouter un encadré ⚠️.

**Vérification avant commit** : `git diff --cached README.md` doit montrer un changement cohérent avec le code modifié. Pas de README à jour = pas de commit.

---

## R-2 : Repo public — aucune information d'environnement spécifique

Le repo est public. **Aucune information identifiant un environnement client, un tenant, un compte de service, ou un contexte projet précis ne doit apparaître** dans les fichiers versionnés (code source, commentaires, docs, exemples, tests).

### Interdit dans le code, les commits, et les exemples README

- URLs Dataverse spécifiques : `https://<orgname>.crm[N].dynamics.com` — utiliser `https://yourorg.crm.dynamics.com` ou équivalent générique.
- GUIDs réels de tenant Azure / client app / utilisateur / solution — utiliser `00000000-0000-0000-0000-000000000000` ou `...`.
- Noms de tenants, de sociétés client, d'éditeurs, de solutions, de préfixes (ex. `new_`, `sa_`, `simpliciti_`) qui révèlent un contexte précis. Préférer `your_prefix_`, `<prefix>_`, etc.
- Noms d'attributs, d'entités, de processus métier propres à un client (ex. `sa_projetsenvironnementettransport`, `Affichage compte asp selon client`). Si nécessaire pour illustrer, anonymiser (`new_account_status`, `Show field X when Y is set`).
- Adresses email professionnelles dans les commentaires ou les exemples (l'auteur des commits Git est OK, c'est inhérent à `git config`).
- Secrets, tokens, credentials, certificats sous toute forme (interdiction évidente).

### Bonnes pratiques

- Pour les exemples README/commentaire, utiliser : `yourorg`, `your_prefix`, `your_solution`, `<entity>`, `<attribute>`, `<workflowId>`.
- Variables d'environnement (`POWERPLATFORM_DEV_URL`, etc.) sont OK comme noms ; leurs **valeurs** ne doivent jamais être commitées.
- Pour debug/test local, utiliser `.env` (déjà gitignored). Ne jamais commiter `.env.example` avec des valeurs autres que des placeholders.

### Vérification automatique recommandée avant chaque commit

```
git diff --cached | grep -iE "crm[0-9]\.dynamics\.com|@simpliciti\.fr|<motif_client>"
```

Si match → sanitiser avant commit. Si match dans l'historique déjà poussé → décider explicitement avec le mainteneur si une réécriture d'historique (`git filter-repo`) est justifiée (force-push détruit les forks et les références externes).

---

## R-3 : État connu de l'historique (audit 2026-05-10)

Audit effectué : `git log --all -p -S` sur les patterns `&lt;client_subdomain&gt;`, `simpliciti`, `crm4.dynamics.com`, GUIDs tenant/client connus.

**Trouvé** :
- Commit `e84159b` (refonte README française) — contenait `https://&lt;client_subdomain&gt;.crm4.dynamics.com` dans l'exemple `.mcp.json`. **Sanitisé** dans le commit courant (remplacé par `https://yourorg.crm.dynamics.com`).
- Adresse email auteur `thomas.rivano@simpliciti.fr` présente dans tous les commits via `git config user.email`. Pas de réécriture d'historique entreprise (force-push destructif). À assumer.

**Non trouvé** : aucun secret, aucun client_id/tenant_id, aucune URL d'API privée.

**Action** : historique réécrit le 2026-05-10 (`git filter-branch` + `git push --force`). Tous les commits passés ont été repassés en remplaçant le subdomain leaké par `yourorg.crm.dynamics.com`. Tag de sauvegarde local `backup-pre-rewrite` créé sur l'état pré-réécriture (à supprimer après vérification visuelle GitHub).

---

## R-4 : Build avant commit

`npm run build` (= `tsc`) doit passer sans erreur avant tout commit. Le script [`C:\Work\Sources\00 - Perso\powerplatform-mcp-commit-push.bat`](../powerplatform-mcp-commit-push.bat) le fait déjà — l'utiliser systématiquement plutôt que `git commit` direct.

---

## R-5 : Documenter les bloqueurs Dataverse dans `_docs` du projet appelant

Quand un outil n'est **pas** implémentable proprement à cause d'un comportement Dataverse (ex. silent revert sur PATCH `clientdata` BPF/BR, silent ignore sur formxml de form managé), documenter dans le projet appelant qui consomme le MCP — pas dans ce repo (qui doit rester générique). Le repo MCP se contente d'exposer les outils techniquement faisables ; les workarounds projet (passer par maker portal, etc.) appartiennent à la doc projet.
