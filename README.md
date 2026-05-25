# PowerPlatform MCP — Fork

> **Fork de [michsob/powerplatform-mcp](https://github.com/michsob/powerplatform-mcp)** maintenu par [@tomthemod](https://github.com/tomthemod) avec des outils supplémentaires non disponibles dans le package amont.
>
> Serveur **Model Context Protocol (MCP)** + **CLI** pour interroger **et configurer** des environnements PowerPlatform / Dataverse depuis un client IA (Claude, Cursor, GitHub Copilot) ou en ligne de commande.
>
> Supporte : environnements multiples, métadonnée d'entités, enregistrements, plugins, flows, solutions, workflows, business rules, security roles, custom APIs, web resources, formulaires, vues, **Power Pages (modèle moderne `mspp_*` / `powerpagecomponent`)**, et plus — opérations en lecture **et en écriture**.

---

## ⚠️ Avertissement — projet expérimental, à utiliser à vos risques et périls

Ce fork est un **projet personnel en développement actif**, non publié sur npm, sans cycle de release stable, sans suite de tests automatisés couvrant les chemins d'écriture. Il a été construit et éprouvé sur un seul environnement Dataverse, à des fins de productivité personnelle.

**Risques spécifiques à connaître avant utilisation** :

- Les opérations d'écriture exposées sont **largement destructives ou irréversibles** côté Dataverse (suppression d'attributs, suppression d'enregistrements, modification de schémas, modification de formulaires). Une erreur dans un appel peut corrompre la métadonnée ou faire perdre des données sans possibilité de rollback automatique.
- Les outils de manipulation de **formxml** (`add-form-field`, `add-form-field-relative`, `add-form-event-handler`, `add-form-pcf-control`, `add-form-library`…) opèrent par regex sur le XML brut. Si la structure d'un formulaire diffère du cas standard, la manipulation peut le casser silencieusement (formulaire qui ne se charge plus, handlers qui ne se déclenchent plus).
- Le format `clientdata` des cloud flows et des global option sets est partiellement non documenté par Microsoft. Un payload mal formé peut produire un composant qui se charge sans erreur mais ne fonctionne pas comme attendu.
- Certains outils (création d'entité, de relations, d'attributs) acceptent un `solutionName` qui ajoute le composant à une solution **sans validation d'éligibilité préalable**. C'est à l'appelant de vérifier les dépendances et la cohérence de la solution.

**Recommandations** :

1. **N'utilisez jamais ce fork directement en production.** Limitez-le à des environnements de développement / sandbox.
2. **Sauvegardez** systématiquement la solution cible (`export-solution`) avant toute modification destructive.
3. **Vérifiez chaque modification** dans le maker portal après exécution — ne faites pas confiance à un retour de l'outil sans contrôle visuel côté Dataverse.
4. **Lisez le code du service** (`src/services/<domaine>-service.ts`) avant d'utiliser un outil critique pour comprendre exactement ce qu'il fait.

Ce fork est distribué **sous licence MIT** (voir `LICENSE`), **sans aucune garantie expresse ou implicite**. Ni l'auteur du fork ni l'auteur du projet amont ne pourront être tenus pour responsables d'une perte de données, d'une corruption de métadonnée, d'une indisponibilité de service, ou de tout autre dommage direct ou indirect résultant de l'utilisation de cet outil. **Vous l'utilisez sous votre entière responsabilité.**

---

## Pourquoi ce fork ?

Le package amont expose principalement de la lecture sur la métadonnée Dataverse plus quelques opérations d'écriture limitées (création de champs string, alternate keys, plugin steps, custom APIs, web resources, environment variables). Ce fork **ajoute la couverture write manquante** pour automatiser un projet Dynamics de bout en bout :

- **Création d'entités**, de **tous les types d'attributs** (string/memo/integer/decimal/money/datetime/boolean/picklist/lookup), de **relations N:1 et N:N**
- **Création/liaison de Global Option Sets**, de **solutions**, de **connection references**
- **Édition de formulaires** (`add-form-field`, positionnement relatif, attachement de PCF, handlers JS, enregistrement de libraries)
- **Édition de vues** (`add-view-column`, `add-view-column-relative`, `set-view-columns`)
- **CRUD d'enregistrements** (create/update/delete + associate/disassociate)
- **Plugins traditionnels** (assemblies + toggle/delete des steps)
- **Web resources** (update / upsert / delete)
- **Cloud flows** (création + activation/désactivation)
- **Solutions** (création + bump de version)

🆕 **Outils ajoutés par ce fork** sont marqués 🆕 dans les tableaux ci-dessous.

---

## Installation

Pré-requis : **Node.js 22+** (< 25).

### Cloner et builder le fork

```bash
git clone https://github.com/tomthemod/powerplatform-mcp.git
cd powerplatform-mcp
npm install
npm run build
```

L'entrypoint MCP est ensuite `build/index.js`. À pointer depuis ton client MCP (cf. § Configuration).

### Synchroniser avec l'amont

```bash
git remote add upstream https://github.com/michsob/powerplatform-mcp.git
git fetch upstream
git merge upstream/main
npm install && npm run build
```

---

## Configuration

Le serveur supporte **plusieurs environnements**. À déclarer via variables d'environnement :

```bash
POWERPLATFORM_ENVIRONMENTS=DEV,UAT,PROD

# Pour chaque environnement :
POWERPLATFORM_DEV_URL=https://dev-org.crm.dynamics.com
POWERPLATFORM_DEV_CLIENT_ID=your-client-id
POWERPLATFORM_DEV_CLIENT_SECRET=your-client-secret
POWERPLATFORM_DEV_TENANT_ID=your-tenant-id
```

Pour le développement local, copier `.env.example` en `.env` et remplir les credentials.

### Exemple de `.mcp.json` (Claude Code)

```json
{
  "mcpServers": {
    "powerplatform": {
      "command": "node",
      "args": ["C:/chemin/vers/05 - powerplatform-mcp/build/index.js"],
      "env": {
        "POWERPLATFORM_ENVIRONMENTS": "DEV",
        "POWERPLATFORM_DEV_URL": "https://yourorg.crm.dynamics.com",
        "POWERPLATFORM_DEV_CLIENT_ID": "...",
        "POWERPLATFORM_DEV_CLIENT_SECRET": "${POWERPLATFORM_DEV_CLIENT_SECRET}",
        "POWERPLATFORM_DEV_TENANT_ID": "..."
      }
    }
  }
}
```

---

## Outils MCP

Tous les outils acceptent un paramètre optionnel `environment` pour cibler un environnement spécifique (par défaut, le premier configuré).

### Entité (métadonnée)

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-entity-metadata` | Métadonnée d'une entité | `entityName` | |
| `get-entity-attributes` | Liste des attributs/champs | `entityName` | |
| `get-entity-attribute` | Détails d'un attribut spécifique | `entityName`, `attributeName` | |
| `get-entity-relationships` | Relations 1:N et N:N | `entityName` | |
| `get-entity-keys` | Clés alternatives sur l'entité | `entityName` | |
| 🆕 `create-entity` | Créer une nouvelle table custom | `schemaName`, `displayName`, `displayCollectionName`, `primaryNameSchemaName`, `primaryNameDisplayName` | `description`, `ownershipType`, `hasActivities`, `hasNotes`, `languageCode`, `solutionName` |
| 🆕 `set-entity-icon-vector` | Définir l'icône SVG d'une entité (UI navigation) | `entityName`, `iconVectorName` | `solutionName` |
| `create-entity-string-attribute` | Champ texte simple | `entityName`, `schemaName`, `displayName` | `maxLength`, `requiredLevel`, `description`, `solutionName` |
| 🆕 `create-entity-memo-attribute` | Champ texte multilignes | `entityName`, `schemaName`, `displayName` | `maxLength`, `requiredLevel`, `description`, `languageCode`, `solutionName` |
| 🆕 `create-entity-integer-attribute` | Champ nombre entier | `entityName`, `schemaName`, `displayName` | `minValue`, `maxValue`, `requiredLevel`, `description`, `languageCode`, `solutionName` |
| 🆕 `create-entity-decimal-attribute` | Champ nombre décimal | `entityName`, `schemaName`, `displayName` | `precision`, `minValue`, `maxValue`, `requiredLevel`, `description`, `languageCode`, `solutionName` |
| 🆕 `create-entity-money-attribute` | Champ monnaie | `entityName`, `schemaName`, `displayName` | `precisionSource`, `precision`, `minValue`, `maxValue`, `requiredLevel`, `description`, `languageCode`, `solutionName` |
| 🆕 `create-entity-datetime-attribute` | Champ date/heure | `entityName`, `schemaName`, `displayName` | `format`, `behavior`, `requiredLevel`, `description`, `languageCode`, `solutionName` |
| 🆕 `create-entity-boolean-attribute` | Champ Oui/Non | `entityName`, `schemaName`, `displayName` | `trueLabel`, `falseLabel`, `defaultValue`, `requiredLevel`, `description`, `languageCode`, `solutionName` |
| 🆕 `create-entity-picklist-attribute` | Champ choix (local OU lié à un global option set) | `entityName`, `schemaName`, `displayName` | `options` (local) **OU** `globalOptionSetName` (global), `requiredLevel`, `description`, `languageCode`, `solutionName` |
| 🆕 `create-entity-lookup-attribute` | Champ lookup (relation N:1 + colonne en un appel) | `referencingEntity`, `referencedEntity`, `relationshipSchemaName`, `lookupSchemaName`, `displayName` | `requiredLevel`, `description`, `cascadeDelete`, `languageCode`, `solutionName` |
| 🆕 `create-entity-many-to-many-relationship` | Relation N:N (Dataverse génère l'intersect entity) | `entity1LogicalName`, `entity2LogicalName`, `relationshipSchemaName` | `intersectEntitySchemaName`, `entity1NavLabel`, `entity2NavLabel`, `languageCode`, `solutionName` |
| `create-entity-alternate-key` | Clé alternative | `entityName`, `schemaName`, `displayName`, `keyAttributes` | `solutionName` |
| 🆕 `delete-entity-attribute` | Supprimer un attribut (irréversible) | `entityName`, `attributeName` | |

### Option Sets

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-global-option-set` | Détails d'un global option set | `optionSetName` | |
| 🆕 `create-global-option-set` | Créer un global option set réutilisable | `name`, `displayName`, `options` | `description`, `languageCode`, `solutionName` |

### Enregistrements (CRUD)

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-record` | Lire un enregistrement par ID | `entityNamePlural`, `recordId` | |
| `query-records` | Requête OData | `entityNamePlural`, `filter` | `maxRecords` (défaut 50) |
| 🆕 `create-record` | Créer un enregistrement (lookups via `@odata.bind`) | `entityNamePlural`, `data` | |
| 🆕 `update-record` | PATCH partiel | `entityNamePlural`, `recordId`, `data` | |
| 🆕 `delete-record` | Supprimer un enregistrement | `entityNamePlural`, `recordId` | |
| 🆕 `associate-records` | Lier deux enregistrements (N:N ou 1:N) | `entityNamePlural`, `recordId`, `navigationProperty`, `relatedEntityNamePlural`, `relatedRecordId` | |
| 🆕 `disassociate-records` | Délier deux enregistrements | `entityNamePlural`, `recordId`, `navigationProperty` | `relatedRecordId` |

### Formulaires & Vues

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| 🆕 `get-entity-forms` | Lister les formulaires d'une entité | `entityLogicalName` | `type` (2=Main, 5=QuickView, 6=QuickCreate, 7=Dashboard) |
| 🆕 `get-form-fields` | Champs présents sur un formulaire | `formId` | |
| 🆕 `add-form-field` | Ajouter un champ en bas de la 1re section (classid auto-résolu selon le type Dataverse : Lookup, DateTime, Boolean, Picklist, Memo, etc.) | `entityLogicalName`, `formId`, `attributeName` | |
| 🆕 `add-form-field-relative` | Ajouter un champ avant/après un champ existant (classid auto-résolu selon le type) | `entityLogicalName`, `formId`, `attributeName`, `relativeToField`, `position` (`before`/`after`) | |
| 🆕 `remove-form-field` | Retirer un champ d'un formulaire | `entityLogicalName`, `formId`, `attributeName` | |
| 🆕 `add-form-library` | Inscrire une web resource JS dans `<formLibraries>` | `entityLogicalName`, `formId`, `libraryName` | |
| 🆕 `remove-form-library` | Désinscrire une library (refuse si handlers la référencent, sauf `force=true`) | `entityLogicalName`, `formId`, `libraryName` | `force` |
| 🆕 `add-form-event-handler` | Attacher un handler JS (onload/onsave/onchange) | `entityLogicalName`, `formId`, `eventName`, `functionName`, `libraryName` | `attributeName` (requis pour onchange), `passExecutionContext`, `parameters` |
| 🆕 `remove-form-event-handler` | Retirer un handler par `functionName` | `entityLogicalName`, `formId`, `functionName` | `libraryName` |
| 🆕 `add-form-pcf-control` | Attacher un PCF custom à un champ | `entityLogicalName`, `formId`, `attributeName`, `pcfControlName` | `formFactors`, `customParameters` |
| 🆕 `remove-form-pcf-control` | Détacher le PCF (revient au contrôle standard) | `entityLogicalName`, `formId`, `attributeName` | |
| 🆕 `get-entity-views` | Lister les vues d'une entité | `entityLogicalName` | |
| 🆕 `get-view-columns` | Colonnes d'une vue | `viewId` | |
| 🆕 `add-view-column` | Ajouter une colonne (en fin) | `entityLogicalName`, `viewId`, `attributeName` | `width` |
| 🆕 `add-view-column-relative` | Ajouter une colonne avant/après une autre | `entityLogicalName`, `viewId`, `attributeName`, `relativeToField`, `position` | `width` |
| 🆕 `remove-view-column` | Retirer une colonne (refuse si c'est la dernière) | `entityLogicalName`, `viewId`, `attributeName` | |
| 🆕 `set-view-columns` | Remplacer le set complet de colonnes (préserve filtres) | `entityLogicalName`, `viewId`, `columns` | `orderBy`, `orderDescending` |

### Plugins

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-plugin-assemblies` | Liste des assemblies | | `includeManaged`, `maxRecords` |
| `get-plugin-assembly-complete` | Assembly + types + steps + images | `assemblyName` | `includeDisabled` |
| `get-entity-plugin-pipeline` | Plugins exécutés sur une entité | `entityName` | `messageFilter`, `includeDisabled` |
| `get-plugin-trace-logs` | Trace logs (debug runtime) | | `entityName`, `messageName`, `correlationId`, `pluginStepId`, `exceptionOnly`, `hoursBack`, `maxRecords` |
| `get-all-plugin-steps` | Tous les SDK message processing steps | | `includeDisabled`, `maxRecords` |
| `get-plugin-type` | Lookup d'un plugin type par nom de classe | `typeName` | |
| `get-sdk-message` | Lookup d'un SDK message par nom | `messageName` | |
| 🆕 `get-plugin-packages` | Lister les plugin packages (.nupkg) | | `includeManaged`, `maxRecords` |
| 🆕 `register-plugin-package` | Enregistrer un nouveau package .nupkg (base64) | `name`, `uniqueName`, `version`, `content` | `solutionName` |
| 🆕 `update-plugin-package` | Mettre à jour un package existant | `pluginPackageId`, `content` | `version` |
| 🆕 `register-plugin-assembly` | Enregistrer une assembly .dll traditionnelle (base64) | `name`, `content`, `version` | `isolationMode`, `description`, `solutionName` |
| `create-plugin-step` | Enregistrer un step | `name`, `pluginTypeId`, `sdkMessageId`, `stage`, `mode` | `rank`, `supportedDeployment`, `description`, `configuration`, `sdkMessageFilterId`, `solutionName` |
| 🆕 `create-plugin-step-image` | Enregistrer une PreImage/PostImage sur un step | `stepId` | `name`, `entityAlias`, `imageType`, `messagePropertyName`, `attributes` |
| 🆕 `enable-plugin-step` | Activer un step | `stepId` | |
| 🆕 `disable-plugin-step` | Désactiver un step | `stepId` | |
| 🆕 `delete-plugin-step` | Supprimer un step (cascade sur ses images) | `stepId` | |

### Solutions

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-publishers` | Publishers non-readonly | | |
| `get-solutions` | Solutions visibles | | |
| `get-solution` | Solution par unique name | `uniqueName` | |
| `get-solution-components` | Composants d'une solution | `solutionUniqueName` | |
| 🆕 `create-solution` | Créer une nouvelle solution unmanaged | `uniqueName`, `friendlyName`, `publisherUniqueName` | `version`, `description` |
| 🆕 `update-solution-version` | Bump de version (releases) | `uniqueName`, `version` | |
| `add-solution-component` | Ajouter un composant à une solution | `solutionUniqueName`, `componentId`, `componentType` | `addRequiredComponents` |
| `export-solution` | Exporter une solution (base64) | `solutionName` | `managed` |
| `publish-customizations` | Publier les customizations | | `entityLogicalName` |

### Flows (Power Automate)

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-flows` | Lister les cloud flows (filtrage smart) | | `activeOnly`, `maxRecords`, `nameContains`, `excludeSystem`, `excludeCustomerInsights`, `excludeCopilotSales` |
| `search-workflows` | Recherche workflows + flows | | `name`, `primaryEntity`, `description`, `category`, `statecode`, `includeDescription`, `maxResults` |
| `get-flow-definition` | Définition complète ou résumé | `flowId` | `summary` |
| `get-flow-runs` | Historique des runs | `flowId` | `status`, `startedAfter`, `startedBefore`, `maxRecords` |
| `get-flow-run-details` | Détail d'un run avec erreurs par action | `flowId`, `runId` | |
| `cancel-flow-run` | Annuler un run en cours | `flowId`, `runId` | |
| `resubmit-flow-run` | Relancer un run échoué | `flowId`, `runId` | |
| `scan-flow-health` | Scan global (taux de succès) | | `daysBack`, `maxRunsPerFlow`, `maxFlows`, `activeOnly` |
| `get-flow-inventory` | Inventaire léger | | `maxRecords` |
| 🆕 `create-cloud-flow` | Créer un cloud flow en Draft | `name`, `clientData` | `primaryEntity`, `solutionName` |
| 🆕 `set-flow-state` | Activer/désactiver un cloud flow | `flowId`, `activate` | |

### Workflows classiques + Business Rules + BPF

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-workflows` | Workflows classiques | | `activeOnly`, `maxRecords` |
| `get-workflow-definition` | Définition XAML ou résumé | `workflowId` | `summary` |
| `get-ootb-workflows` | Workflows out-of-the-box (background, BPF, actions, on-demand) | | `maxRecords`, `categories` |
| `get-business-rules` | Business rules | | `activeOnly`, `maxRecords` |
| `get-business-rule` | Business rule + XAML | `workflowId` | |
| 🆕 `get-business-rule-summary` | Parse le XAML d'une BR → entité, attributs/contrôles référencés, conditions (avec descriptions humaines), actions (`SetVisibility`, `SetAttributeValue`, `SetBusinessRequired`, etc.). Utile pour préparer une copie cross-entité dans le maker portal. | `workflowId` | |
| 🆕 `get-bpf` | Business Process Flow + `clientdata` parsé en arborescence (stages, fields par stage, branches conditionnelles via `__class` discriminator). | `workflowId` | `includeRaw` |

> ⚠️ **Édition programmatique des BPF et Business Rules non supportée**. Le `xaml` est régénéré côté Dataverse au PATCH du `clientdata` — pas d'API publique pour synthétiser un xaml cohérent. Voie supportée = maker portal. Les outils ci-dessus sont en lecture seule pour préparer les modifs manuelles.

### Web Resources

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-web-resources` | Lister les web resources | | `maxRecords`, `webResourceType`, `nameFilter` |
| `get-web-resource` | Web resource par nom | `name` | |
| `create-web-resource` | Créer une web resource | `name`, `displayName`, `webResourceType`, + (`content` **OU** `filePath`) | `description`, `solutionName` |
| 🆕 `update-web-resource` | Mettre à jour le contenu d'une web resource existante | `webResourceId`, + (`content` **OU** `filePath`) | `solutionName` |
| 🆕 `upsert-web-resource` | Créer ou mettre à jour (idempotent par nom) | `name`, `displayName`, `webResourceType`, + (`content` **OU** `filePath`) | `description`, `solutionName` |
| 🆕 `delete-web-resource` | Supprimer une web resource (irréversible) | `webResourceId` | |

> ⚠️ **`content` vs `filePath` (create / update / upsert web resource)** : fournir **exactement un des deux**. `content` = chaîne base64 inline (legacy, force l'appelant — typiquement un LLM — à re-générer tout le contenu en sortie) — **validé syntaxiquement avant envoi** (caractères non-base64 ou round-trip cassé → erreur immédiate). `filePath` = chemin absolu sur disque, lu et base64-encodé côté serveur — **à préférer pour tout JS/CSS de plus de quelques Ko**, évite la regénération coûteuse côté modèle. Les deux ensemble = erreur. Aucun des deux = erreur.

### 🆕 Power Pages (portail — modèle moderne `mspp_*` / `powerpagecomponent`)

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| 🆕 `list-portal-websites` | Lister les sites Power Pages actifs (`mspp_websites`) | | `environment` |
| 🆕 `list-portal-webpages` | Pages d'un site **groupées par `partialUrl`** (root + content résolus, prêtes à consommer) | `websiteId` | `nameFilter`, `partialUrl`, `environment` |
| 🆕 `get-portal-webpage` | Page unique avec `mspp_copy` (HTML+Liquid), `mspp_customjavascript`, `mspp_customcss`, refs root/parent/template | `pageId` | `environment` |
| 🆕 `list-portal-entitylists` | `mspp_entitylists` d'un site + leur `mspp_view` et table cible (matcher avec `{% include 'entity_list' key:'…' %}` du `mspp_copy`) | `websiteId` | `environment` |
| 🆕 `list-portal-entityforms` | `mspp_entityforms` d'un site + leur `mspp_formname` et table cible | `websiteId` | `environment` |
| 🆕 `get-portal-foundation-components` | Résout les 5 composants fondations d'un site (website, langue, page template par défaut, "Publié", page d'accueil root) prêts à feeder `AddSolutionComponent` — sans eux, l'import sur UAT/PROD échoue | `websiteId` | `environment` |
| 🆕 `update-portal-webpage-js` | Patche `customjavascript` d'une page (CONTENT row obligatoire) via la source de vérité `powerpagecomponent.content` (JSON sérialisé) — préserve toutes les autres clés du JSON verbatim | `contentPageId`, + (`jsText` **OU** `filePath`) | `environment` |
| 🆕 `add-portal-story-components` | Batch-ajoute à une solution : 5 fondations + pour chaque content page sa row CONTENT + ROOT (résolue) + extras (savedquery / mspp_entitylist). Idempotent. | `solutionUniqueName`, `websiteId`, `contentPageIds[]` | `extra[]`, `environment` |

> ⚠️ **Pourquoi ces outils existent — modèle Enhanced Data Model Power Pages** : un PATCH direct sur `mspp_webpages` est **refusé** par le plugin Microsoft `Microsoft.Portal.SingleEntity.Plugins.CUDFromSingleEntity` (PostOperation, sync), avec un message trompeur du type « la page d'accueil doit avoir partial URL = / », **même pour un PATCH no-op** (`{ mspp_title: <valeur actuelle> }`). La cause : les tables `mspp_*` sont des **projections** maintenues par le plugin depuis l'entité unifiée `powerpagecomponent` (ObjectTypeCode 11400). Le `powerpagecomponentid` est le même GUID que `mspp_webpageid`. Le contenu typé (`customjavascript`, `customcss`, `copy`, `partialurl`, `title`, `parentpageid`, `rootwebpageid`, …) est un **JSON sérialisé** dans `powerpagecomponent.content`.
>
> `update-portal-webpage-js` fait donc en interne : GET `powerpagecomponents(id).content` → parse JSON → remplace **uniquement** la clé `customjavascript` → PATCH `powerpagecomponents(id).content` avec le JSON ré-encodé. Le plugin projette ensuite vers `mspp_webpages.mspp_customjavascript` dans la même transaction. **Pas de `publish-customizations` requis** côté portail moderne.
>
> Refuse explicitement les pages root (sans `mspp_webpagelanguageid`) — le JS vit toujours sur la page CONTENT.

> ⚠️ **`jsText` vs `filePath` (update-portal-webpage-js)** : même règle que les web resources Dataverse — fournir **exactement un des deux**. `filePath` à préférer pour un round-trip byte-exact (accents UTF-8, line endings `\r\n` préservés).

> ⚠️ **Componenttypes solution** : `mspp_website` = **11401**, `mspp_websitelanguage` = **11402**, tout autre composant Power Pages (webpage, pagetemplate, publishingstate, webfile, entitylist, entityform, …) = **11400** (regroupés sous "Site Components" sous le capot `powerpagecomponent`).

> **Hors scope actuel** : `mspp_webfile` (assets globaux partagés), `mspp_webtemplates`, `mspp_contentsnippets`, tables legacy `adx_*`, création de nouvelles pages côté portail.

### Configuration (env vars + connection refs)

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-connection-references` | Connection references | | `maxRecords`, `managedOnly`, `hasConnection`, `inactive` |
| 🆕 `create-connection-reference` | Créer une connection reference | `logicalName`, `displayName`, `connectorId` | `description`, `solutionName` |
| `get-environment-variables` | Definitions + valeurs courantes | | `maxRecords`, `managedOnly` |
| `create-environment-variable` | Créer une env var | `schemaName`, `displayName`, `type` | `defaultValue`, `description`, `solutionName` |
| `set-environment-variable-value` | Set ou update d'une valeur | `definitionId`, `value` | `existingValueId` |

### Custom APIs

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-custom-apis` | Lister les Custom APIs | | `maxRecords`, `includeManaged` |
| `get-custom-api` | Custom API par unique name | `uniqueName` | |
| `create-custom-api` | Créer une Custom API | `uniqueName`, `name`, `displayName`, `bindingType`, `isFunction`, `isPrivate`, `allowedCustomProcessingStepType` | `description`, `pluginTypeId`, `pluginTypeName`, `boundEntityLogicalName`, `solutionName` |
| `get-custom-api-response-properties` | Lister les response properties | `customApiId` | |
| `create-custom-api-response-property` | Créer une response property | `customApiId`, `uniqueName`, `name`, `displayName`, `type` | `description`, `logicalEntityName`, `isOptional`, `solutionName` |
| `get-custom-api-request-parameters` | Lister les request parameters | `customApiId` | |
| `create-custom-api-request-parameter` | Créer une request parameter | `customApiId`, `uniqueName`, `name`, `displayName`, `type` | `description`, `logicalEntityName`, `isOptional`, `solutionName` |

### Security Roles

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `get-security-roles` | Roles customizables | | `solutionUniqueName`, `excludeSystemRoles`, `includePrivileges`, `maxRecords` |
| `get-security-role-privileges` | Privilèges d'un role | `roleId` | `entityFilter`, `accessRightFilter` |
| 🆕 `get-security-roles-by-solution` | Roles inclus dans une solution donnée | `solutionUniqueName` | `includePrivileges` |

### Dépendances et Service Endpoints

| Outil | Description | Paramètres requis | Optionnels |
|---|---|---|---|
| `check-component-dependencies` | Dépendances bloquant la suppression | `componentId`, `componentType` | |
| `check-delete-eligibility` | Vérifier qu'un composant peut être supprimé | `componentId`, `componentType` | |
| `get-service-endpoints` | Service Bus, webhooks, Event Hub, Event Grid | | `maxRecords` |

---

## Prompts MCP

| Prompt | Description | Args requis |
|---|---|---|
| `entity-overview` | Vue d'ensemble d'une entité (attributs clés + relations) | `entityName` |
| `attribute-details` | Détails d'un attribut (type, format, contraintes) | `entityName`, `attributeName` |
| `query-template` | Template de requête OData avec filtres d'exemple | `entityName` |
| `relationship-map` | Carte complète des relations 1:N et N:N | `entityName` |

---

## CLI

Mêmes outils que le serveur MCP, mais les résultats sont mis en cache sur le système de fichiers — utile sur des environnements avec beaucoup d'entités/flows/steps qui satureraient le contexte d'un client IA.

### Option globale

`--env <name>` — environnement cible (défaut : premier configuré).

### Commandes principales (extrait)

```bash
# Entité
entity-metadata <entityName>
entity-attributes <entityName>
create-entity <schemaName> <displayName> <displayCollectionName> [--ownership ...] [--solution ...]
create-entity-string-attribute <entityName> <schemaName> <displayName> [--max-length ...]
create-entity-picklist-attribute <entityName> <schemaName> <displayName> -o 1:Haute -o 2:Moyenne
create-entity-lookup <referencing> <referenced> <relSchema> <lookupSchema> <displayName>
delete-entity-attribute <entityName> <attributeName>

# Records
create-record <entityNamePlural> <jsonBody>
update-record <entityNamePlural> <recordId> <jsonBody>
delete-record <entityNamePlural> <recordId>

# Flows
create-cloud-flow <clientDataFile> [--solution ...]
activate-flow <flowId>
deactivate-flow <flowId>

# Web resources
create-web-resource <name> <displayName> <filePath> [--type 3] [--solution ...]
set-entity-icon <entityName> <svgFilePath> [--solution ...]

# Formulaires & vues
add-form-field <entityName> <formId> <attributeName>
remove-form-field <entityName> <formId> <attributeName>
add-view-column <entityName> <viewId> <attributeName> [--width 150]
set-view-columns <entityName> <viewId> col1:120 col2:200 [--order-by ...]

# PAC
pac-auth                                   # Authentifie pac CLI avec les credentials
generate-models <outdir>                   # Early-bound depuis le schéma
deploy-plugin <pluginFile> --plugin-id <id>

# Workflows / BR / BPF
business-rule <workflowId>                  # XAML brut de la BR
business-rule-summary <workflowId>          # 🆕 BR parsée (conditions, actions, attributs)
bpf <workflowId> [--raw]                    # 🆕 BPF parsé (stages, fields, branches)
```

La liste complète est dans `src/cli/commands/` (un fichier par domaine).

---

## Développement

```bash
git clone https://github.com/tomthemod/powerplatform-mcp.git
cd powerplatform-mcp
npm install
cp .env.example .env   # remplir les credentials
npm run build
npm run inspector      # tester avec MCP Inspector
```

### Workflow de modification

Pour ajouter un nouvel outil :

1. Ajouter la méthode au service concerné dans `src/services/<domaine>-service.ts`.
2. Ajouter le `server.registerTool(...)` correspondant dans `src/tools/<domaine>-tools.ts`.
3. Si c'est un nouveau domaine : créer aussi `src/services/<domaine>-service.ts` + `src/tools/<domaine>-tools.ts` + brancher dans `src/tools/index.ts` et `src/services/index.ts`.
4. `npm run build` pour vérifier le typage.
5. Mettre à jour ce README.

### Scripts batch (Windows) — workflow rapide

Disponibles dans le dossier parent (`C:\Work\Sources\`) :

- `powerplatform-mcp-commit-push.bat ["message"]` — commit + build + push origin
- `powerplatform-mcp-sync-upstream.bat` — fetch + merge `michsob/main` + build + push fork

---

## Comparaison avec le package amont

Pour reprendre les évolutions du repo amont :

```bash
git fetch upstream
git merge upstream/main
npm install && npm run build
```

Les conflits sont rares parce que le fork ne fait qu'**ajouter** des `registerTool(...)` et de nouveaux fichiers — il ne modifie pratiquement aucun service ou outil existant (à part `createPicklistAttribute` étendu pour accepter `globalOptionSetName`).

---

## License

MIT — héritée du projet amont.

Crédits : projet d'origine [michsob/powerplatform-mcp](https://github.com/michsob/powerplatform-mcp).
