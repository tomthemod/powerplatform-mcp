import { readFile } from 'node:fs/promises';
import { PowerPlatformClient } from '../powerplatform-client.js';
import type { ApiCollectionResponse } from '../models/index.js';

/**
 * Power Pages (Enhanced Data Model, mspp_*) service.
 *
 * Modern Power Pages stores per-page customisation (JS, CSS, HTML/Liquid) directly
 * on the mspp_webpage CONTENT row (the row whose mspp_webpagelanguageid is set),
 * not on a separate mspp_webfile. So updating "the JS of a page" is a simple
 * PATCH on mspp_customjavascript of the content row — no annotation involved.
 *
 * mspp_webfile is reserved for shared assets (images, global JS libs) and is not
 * covered by this v1 service.
 *
 * Solution component types observed for portal exports:
 *   11400 = mspp_webpage / mspp_pagetemplate / mspp_publishingstate (site components)
 *   11401 = mspp_website
 *   11402 = mspp_websitelanguage
 *
 * Foundation components that every portal solution import needs (so the receiving
 * environment can resolve page references): website, language, default page template,
 * "Publié" publishing state, and the root "Accueil" page.
 */

export const PORTAL_COMPONENT_TYPES = {
  siteComponent: 11400,
  website: 11401,
  websiteLanguage: 11402,
} as const;

export interface FoundationComponent {
  componentId: string;
  componentType: number;
  kind: 'website' | 'websiteLanguage' | 'pageTemplate' | 'publishingState' | 'rootPage';
  name: string;
}

export class PortalService {
  constructor(private client: PowerPlatformClient) {}

  // ──────────────────────────── Read ────────────────────────────

  /** List active mspp_websites. */
  async listWebsites(): Promise<ApiCollectionResponse<Record<string, unknown>>> {
    return this.client.get<ApiCollectionResponse<Record<string, unknown>>>(
      `api/data/v9.2/mspp_websites?$filter=statecode eq 0&$select=mspp_websiteid,mspp_name,mspp_primarydomainname&$orderby=mspp_name`,
    );
  }

  /** List languages bound to a site. */
  async listWebsiteLanguages(websiteId: string): Promise<ApiCollectionResponse<Record<string, unknown>>> {
    return this.client.get<ApiCollectionResponse<Record<string, unknown>>>(
      `api/data/v9.2/mspp_websitelanguages?$filter=_mspp_websiteid_value eq ${websiteId} and statecode eq 0`,
    );
  }

  /**
   * List pages of a site. Returns root + content rows, with a derived `kind`
   * field ('root' | 'content') based on whether mspp_webpagelanguageid is set,
   * and the resolved rootId/contentId pair so the caller can locate both
   * solution components for a given partial URL.
   */
  async listWebpages(websiteId: string, options?: { nameFilter?: string; partialUrl?: string }): Promise<{
    count: number;
    pages: Array<{
      partialUrl: string;
      name: string;
      rootPageId: string | null;
      contentPages: Array<{ pageId: string; languageId: string | null; modifiedOn: string }>;
    }>;
    raw: Record<string, unknown>[];
  }> {
    const filters: string[] = [`_mspp_websiteid_value eq ${websiteId}`, `statecode eq 0`];
    if (options?.nameFilter) {
      filters.push(`contains(mspp_name,'${options.nameFilter.replace(/'/g, "''")}')`);
    }
    if (options?.partialUrl) {
      filters.push(`mspp_partialurl eq '${options.partialUrl.replace(/'/g, "''")}'`);
    }
    const select =
      'mspp_webpageid,mspp_name,mspp_partialurl,_mspp_parentpageid_value,_mspp_webpagelanguageid_value,_mspp_rootwebpageid_value,mspp_modifiedon';
    const result = await this.client.get<ApiCollectionResponse<Record<string, unknown>>>(
      `api/data/v9.2/mspp_webpages?$filter=${filters.join(' and ')}&$select=${select}&$orderby=mspp_name&$top=500`,
    );

    const raw = result.value ?? [];
    // Group by partial URL: a "page" in the user sense = one root + N content rows (per language).
    const buckets = new Map<string, {
      partialUrl: string;
      name: string;
      rootPageId: string | null;
      contentPages: Array<{ pageId: string; languageId: string | null; modifiedOn: string }>;
    }>();

    for (const row of raw) {
      const partialUrl = (row.mspp_partialurl as string) ?? '';
      const key = partialUrl || (row.mspp_webpageid as string);
      const bucket = buckets.get(key) ?? {
        partialUrl,
        name: row.mspp_name as string,
        rootPageId: null,
        contentPages: [],
      };
      const isContent = row._mspp_webpagelanguageid_value != null;
      if (isContent) {
        bucket.contentPages.push({
          pageId: row.mspp_webpageid as string,
          languageId: (row._mspp_webpagelanguageid_value as string) ?? null,
          modifiedOn: row.mspp_modifiedon as string,
        });
      } else {
        // root row: language=null. Pick the first one we find.
        bucket.rootPageId = bucket.rootPageId ?? (row.mspp_webpageid as string);
      }
      buckets.set(key, bucket);
    }

    return { count: raw.length, pages: [...buckets.values()], raw };
  }

  /**
   * Get a single page with its content fields (copy, customjavascript, customcss).
   * Resolves the root page id via mspp_rootwebpageid_value when the supplied id
   * points to a content row.
   */
  async getWebpage(pageId: string): Promise<Record<string, unknown> | null> {
    const select = [
      'mspp_webpageid',
      'mspp_name',
      'mspp_partialurl',
      '_mspp_parentpageid_value',
      '_mspp_webpagelanguageid_value',
      '_mspp_rootwebpageid_value',
      '_mspp_websiteid_value',
      '_mspp_pagetemplateid_value',
      'mspp_copy',
      'mspp_customjavascript',
      'mspp_customcss',
      'mspp_modifiedon',
    ].join(',');
    const result = await this.client.get<Record<string, unknown>>(
      `api/data/v9.2/mspp_webpages(${pageId})?$select=${select}`,
    );
    return result ?? null;
  }

  /** List mspp_entitylist of a site with their bound view ids and target table. */
  async listEntityLists(websiteId: string): Promise<ApiCollectionResponse<Record<string, unknown>>> {
    const select =
      'mspp_entitylistid,mspp_name,mspp_entityname,mspp_view,mspp_views,_mspp_websiteid_value,mspp_modifiedon';
    return this.client.get<ApiCollectionResponse<Record<string, unknown>>>(
      `api/data/v9.2/mspp_entitylists?$filter=_mspp_websiteid_value eq ${websiteId} and statecode eq 0&$select=${select}&$orderby=mspp_name&$top=500`,
    );
  }

  /** List mspp_entityform of a site with their bound formid and target table. */
  async listEntityForms(websiteId: string): Promise<ApiCollectionResponse<Record<string, unknown>>> {
    const select =
      'mspp_entityformid,mspp_name,mspp_entityname,mspp_formname,mspp_mode,_mspp_websiteid_value,mspp_modifiedon';
    return this.client.get<ApiCollectionResponse<Record<string, unknown>>>(
      `api/data/v9.2/mspp_entityforms?$filter=_mspp_websiteid_value eq ${websiteId} and statecode eq 0&$select=${select}&$orderby=mspp_name&$top=500`,
    );
  }

  // ──────────────────────────── Write ────────────────────────────

  /**
   * Update the JS attached to a page.
   *
   * Power Pages "Enhanced Data Model" forbids direct writes on the projected
   * mspp_* tables — those trigger the CUDFromSingleEntity sync plugin which
   * raises misleading validation errors (e.g. "the home page partial URL must
   * be /"). The actual source-of-truth table is `powerpagecomponent` (object
   * type code 11400), keyed by the SAME GUID as mspp_webpageid. Its `content`
   * column stores a JSON-serialised payload with every typed field of the
   * webpage (customjavascript, customcss, copy, partialurl, …). The plugin
   * projects writes from powerpagecomponent back into mspp_webpages.
   *
   * So the round-trip is: read the current `content` JSON → patch the
   * `customjavascript` key → PATCH the whole JSON back. All other keys must be
   * preserved as-is, or they'll be wiped from the projection.
   *
   * Safety: if the supplied pageId points to a root row (no language), we
   * still throw — JS only makes sense on the content row, just like before.
   */
  async updateWebpageJs(input: {
    contentPageId: string;
    jsText?: string;
    filePath?: string;
  }): Promise<void> {
    const text = await resolvePortalText(input);

    // 1. Verify the target is a content row via the typed mspp view (cheap).
    const projection = await this.getWebpage(input.contentPageId);
    if (!projection) {
      throw new Error(`Webpage ${input.contentPageId} not found.`);
    }
    if (projection._mspp_webpagelanguageid_value == null) {
      throw new Error(
        `Webpage ${input.contentPageId} ('${projection.mspp_name}') is a ROOT row (no language). ` +
          `Pass the CONTENT row id (the one with mspp_webpagelanguageid set) — that is the row ` +
          `that holds the JS via the powerpagecomponent.content JSON.`,
      );
    }

    // 2. Fetch the powerpagecomponent.content JSON for this id.
    const component = await this.client.get<Record<string, unknown>>(
      `api/data/v9.2/powerpagecomponents(${input.contentPageId})?$select=powerpagecomponentid,powerpagecomponenttype,content,name`,
    );
    if (!component) {
      throw new Error(`powerpagecomponent ${input.contentPageId} not found.`);
    }
    if (component.powerpagecomponenttype !== 2) {
      throw new Error(
        `powerpagecomponent ${input.contentPageId} ('${component.name}') has type ` +
          `${component.powerpagecomponenttype} — expected 2 (webpage). Use the right tool ` +
          `for this component type.`,
      );
    }
    const rawContent = component.content as string | null;
    if (!rawContent) {
      throw new Error(`powerpagecomponent ${input.contentPageId} has empty content — refusing to overwrite.`);
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err: any) {
      throw new Error(
        `powerpagecomponent ${input.contentPageId} content is not valid JSON: ${err.message}. ` +
          `Refusing to overwrite — investigate manually.`,
      );
    }

    // 3. Patch the customjavascript field, preserving every other key verbatim.
    parsed.customjavascript = text;
    const newContent = JSON.stringify(parsed);

    // 4. PATCH the source-of-truth row. The CUDFromSingleEntity plugin will
    //    propagate to mspp_webpages.mspp_customjavascript automatically.
    await this.client.patch(
      `api/data/v9.2/powerpagecomponents(${input.contentPageId})`,
      { content: newContent },
    );
  }

  /**
   * Resolve and return the canonical 5 foundation components that every portal
   * solution import needs:
   *   - mspp_website                  (componenttype 11401)
   *   - mspp_websitelanguage          (componenttype 11402)
   *   - default mspp_pagetemplate     (componenttype 11400)
   *   - "Publié" mspp_publishingstate (componenttype 11400)
   *   - root mspp_webpage "Accueil"   (componenttype 11400)
   *
   * For the language and template we pick the most recent active row tied to the
   * site; for the publishing state we look up the row named "Publié" (FR) /
   * "Published" (EN). For the root page we walk the page tree until we find one
   * with mspp_partialurl = '/'.
   */
  async resolveFoundationComponents(websiteId: string): Promise<FoundationComponent[]> {
    const found: FoundationComponent[] = [];

    // 1. Website itself.
    const site = await this.client.get<Record<string, unknown>>(
      `api/data/v9.2/mspp_websites(${websiteId})?$select=mspp_websiteid,mspp_name`,
    );
    if (!site) throw new Error(`Website ${websiteId} not found.`);
    found.push({
      componentId: site.mspp_websiteid as string,
      componentType: PORTAL_COMPONENT_TYPES.website,
      kind: 'website',
      name: site.mspp_name as string,
    });

    // 2. Languages (we add them all — typically just one or two).
    const languages = await this.listWebsiteLanguages(websiteId);
    for (const lang of languages.value ?? []) {
      found.push({
        componentId: lang.mspp_websitelanguageid as string,
        componentType: PORTAL_COMPONENT_TYPES.websiteLanguage,
        kind: 'websiteLanguage',
        name: (lang.mspp_name as string) ?? '',
      });
    }

    // 3. Default page template — pick the one referenced by the root page if any,
    //    otherwise the most recent active one on the site.
    const templates = await this.client.get<ApiCollectionResponse<Record<string, unknown>>>(
      `api/data/v9.2/mspp_pagetemplates?$filter=_mspp_websiteid_value eq ${websiteId} and statecode eq 0&$select=mspp_pagetemplateid,mspp_name&$orderby=mspp_modifiedon desc&$top=10`,
    );
    const defaultTemplate =
      (templates.value ?? []).find((t) => /default/i.test(t.mspp_name as string)) ??
      (templates.value ?? [])[0];
    if (defaultTemplate) {
      found.push({
        componentId: defaultTemplate.mspp_pagetemplateid as string,
        componentType: PORTAL_COMPONENT_TYPES.siteComponent,
        kind: 'pageTemplate',
        name: defaultTemplate.mspp_name as string,
      });
    }

    // 4. Publishing state "Publié" / "Published".
    const states = await this.client.get<ApiCollectionResponse<Record<string, unknown>>>(
      `api/data/v9.2/mspp_publishingstates?$filter=_mspp_websiteid_value eq ${websiteId} and statecode eq 0&$select=mspp_publishingstateid,mspp_name`,
    );
    const publishedState = (states.value ?? []).find((s) =>
      /^(publi(é|e)|published)$/i.test((s.mspp_name as string) ?? ''),
    );
    if (publishedState) {
      found.push({
        componentId: publishedState.mspp_publishingstateid as string,
        componentType: PORTAL_COMPONENT_TYPES.siteComponent,
        kind: 'publishingState',
        name: publishedState.mspp_name as string,
      });
    }

    // 5. Root page (partial URL = '/').
    const rootPages = await this.client.get<ApiCollectionResponse<Record<string, unknown>>>(
      `api/data/v9.2/mspp_webpages?$filter=_mspp_websiteid_value eq ${websiteId} and mspp_partialurl eq '/' and _mspp_webpagelanguageid_value eq null and statecode eq 0&$select=mspp_webpageid,mspp_name&$top=1`,
    );
    const rootPage = (rootPages.value ?? [])[0];
    if (rootPage) {
      found.push({
        componentId: rootPage.mspp_webpageid as string,
        componentType: PORTAL_COMPONENT_TYPES.siteComponent,
        kind: 'rootPage',
        name: rootPage.mspp_name as string,
      });
    }

    return found;
  }

  /**
   * Add the full set of components needed for a story to a solution:
   *   - the 5 foundation components of the site (idempotent)
   *   - the root + content rows of every supplied page (deduplicated)
   *   - any extra component (typically savedquery + mspp_entitylist) passed in
   *
   * Returns a report of what was attempted. `add-solution-component` is itself
   * idempotent on the Dataverse side, but we surface per-component success/failure
   * so the agent can flag the rare miss (rights, locked component, …).
   */
  async addStoryComponents(input: {
    solutionUniqueName: string;
    websiteId: string;
    contentPageIds: string[];
    extra?: Array<{ componentId: string; componentType: number; label?: string }>;
  }): Promise<{
    added: Array<{ componentId: string; componentType: number; label: string; ok: boolean; error?: string }>;
  }> {
    const planned: Array<{ componentId: string; componentType: number; label: string }> = [];

    // Foundations.
    const foundations = await this.resolveFoundationComponents(input.websiteId);
    for (const f of foundations) {
      planned.push({ componentId: f.componentId, componentType: f.componentType, label: `${f.kind}: ${f.name}` });
    }

    // For each content page, resolve its root, and add both rows as 11400.
    for (const contentId of input.contentPageIds) {
      const page = await this.getWebpage(contentId);
      if (!page) {
        planned.push({
          componentId: contentId,
          componentType: PORTAL_COMPONENT_TYPES.siteComponent,
          label: `(missing page ${contentId})`,
        });
        continue;
      }
      planned.push({
        componentId: page.mspp_webpageid as string,
        componentType: PORTAL_COMPONENT_TYPES.siteComponent,
        label: `webpage[content]: ${page.mspp_name} (${page.mspp_partialurl})`,
      });
      const rootId = page._mspp_rootwebpageid_value as string | null;
      if (rootId) {
        planned.push({
          componentId: rootId,
          componentType: PORTAL_COMPONENT_TYPES.siteComponent,
          label: `webpage[root]: ${page.mspp_name} (${page.mspp_partialurl})`,
        });
      }
    }

    // Extras.
    for (const e of input.extra ?? []) {
      planned.push({
        componentId: e.componentId,
        componentType: e.componentType,
        label: e.label ?? `componentType=${e.componentType}`,
      });
    }

    // Deduplicate by componentId (componenttype is implied per row in our planning).
    const seen = new Set<string>();
    const deduped = planned.filter((c) => {
      const key = `${c.componentId}|${c.componentType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Apply.
    const added: Array<{ componentId: string; componentType: number; label: string; ok: boolean; error?: string }> = [];
    for (const c of deduped) {
      try {
        await this.client.post('api/data/v9.2/AddSolutionComponent', {
          ComponentId: c.componentId,
          ComponentType: c.componentType,
          SolutionUniqueName: input.solutionUniqueName,
          AddRequiredComponents: false,
        });
        added.push({ ...c, ok: true });
      } catch (err: any) {
        added.push({ ...c, ok: false, error: err?.message ?? String(err) });
      }
    }
    return { added };
  }
}

/** Resolve text content from inline string or local file path. */
async function resolvePortalText(input: { jsText?: string; filePath?: string }): Promise<string> {
  const hasText = typeof input.jsText === 'string';
  const hasPath = typeof input.filePath === 'string' && input.filePath.length > 0;
  if (hasText && hasPath) {
    throw new Error("Provide either 'jsText' or 'filePath' — not both.");
  }
  if (!hasText && !hasPath) {
    throw new Error("One of 'jsText' or 'filePath' is required.");
  }
  if (hasText) return input.jsText as string;
  const buf = await readFile(input.filePath as string, 'utf-8');
  return buf;
}
