import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EnvironmentRegistry } from "../environment-config.js";

/**
 * Register Power Pages (mspp_*) portal tools with the MCP server.
 *
 * Scope (v1):
 *   - Read sites, pages (root+content grouped), entitylists, entityforms.
 *   - Write JS attached to a page (mspp_customjavascript on the content row).
 *   - Resolve the 5 foundation components every portal solution needs.
 *   - Batch-add story components (foundations + root + content + extras) to a solution.
 */
export function registerPortalTools(server: McpServer, registry: EnvironmentRegistry): void {
  // ───────────────────────── list-portal-websites ─────────────────────────
  server.registerTool(
    "list-portal-websites",
    {
      title: "List Power Pages websites",
      description: "List active Power Pages sites (mspp_websites). Use the returned websiteId in the other portal tools.",
      inputSchema: {
        environment: z.string().optional(),
      },
      outputSchema: z.object({ websites: z.any(), count: z.number() }),
    },
    async ({ environment }) => {
      try {
        const svc = registry.getContext(environment).getPortalService();
        const result = await svc.listWebsites();
        const websites = result.value ?? [];
        return {
          structuredContent: { websites, count: websites.length },
          content: [{ type: "text", text: `Found ${websites.length} websites:\n\n${JSON.stringify(websites, null, 2)}` }],
        };
      } catch (error: any) {
        return {
          structuredContent: { websites: [], count: 0 },
          content: [{ type: "text", text: `Failed to list portal websites: ${error.message}` }],
        };
      }
    },
  );

  // ───────────────────────── list-portal-webpages ─────────────────────────
  server.registerTool(
    "list-portal-webpages",
    {
      title: "List Power Pages pages",
      description:
        "List pages of a Power Pages site, grouped by partial URL with root + content rows resolved. " +
        "Use this to find the page id you need before update-portal-webpage-js. " +
        "The CONTENT row (language set) is what holds mspp_customjavascript / mspp_customcss / mspp_copy.",
      inputSchema: {
        websiteId: z.string().describe("mspp_websiteid"),
        nameFilter: z.string().optional().describe("Substring match on mspp_name"),
        partialUrl: z.string().optional().describe("Exact match on mspp_partialurl (e.g. 'Mes-incidents')"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ pages: z.any(), count: z.number() }),
    },
    async ({ websiteId, nameFilter, partialUrl, environment }) => {
      try {
        const svc = registry.getContext(environment).getPortalService();
        const result = await svc.listWebpages(websiteId, { nameFilter, partialUrl });
        return {
          structuredContent: { pages: result.pages, count: result.count },
          content: [{ type: "text", text: `Found ${result.count} page rows grouped into ${result.pages.length} pages:\n\n${JSON.stringify(result.pages, null, 2)}` }],
        };
      } catch (error: any) {
        return {
          structuredContent: { pages: [], count: 0 },
          content: [{ type: "text", text: `Failed to list portal webpages: ${error.message}` }],
        };
      }
    },
  );

  // ───────────────────────── get-portal-webpage ─────────────────────────
  server.registerTool(
    "get-portal-webpage",
    {
      title: "Get a Power Pages page",
      description:
        "Get a single mspp_webpage row with its full content fields: mspp_copy (HTML+Liquid), " +
        "mspp_customjavascript, mspp_customcss, plus root/parent/template references.",
      inputSchema: {
        pageId: z.string().describe("mspp_webpageid"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ page: z.any() }),
    },
    async ({ pageId, environment }) => {
      try {
        const svc = registry.getContext(environment).getPortalService();
        const page = await svc.getWebpage(pageId);
        return {
          structuredContent: { page },
          content: [{ type: "text", text: page ? `Page:\n\n${JSON.stringify(page, null, 2)}` : `Page ${pageId} not found.` }],
        };
      } catch (error: any) {
        return {
          structuredContent: { page: null },
          content: [{ type: "text", text: `Failed to get portal webpage: ${error.message}` }],
        };
      }
    },
  );

  // ───────────────────────── list-portal-entitylists ─────────────────────────
  server.registerTool(
    "list-portal-entitylists",
    {
      title: "List Power Pages entity lists",
      description:
        "List mspp_entitylists of a site with their target table (mspp_entityname) and bound view id(s). " +
        "Match by `key` to what appears inside the Liquid {% entitylist key:\"…\" %} of a page's mspp_copy.",
      inputSchema: {
        websiteId: z.string(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ entityLists: z.any(), count: z.number() }),
    },
    async ({ websiteId, environment }) => {
      try {
        const svc = registry.getContext(environment).getPortalService();
        const result = await svc.listEntityLists(websiteId);
        const entityLists = result.value ?? [];
        return {
          structuredContent: { entityLists, count: entityLists.length },
          content: [{ type: "text", text: `Found ${entityLists.length} entity lists:\n\n${JSON.stringify(entityLists, null, 2)}` }],
        };
      } catch (error: any) {
        return {
          structuredContent: { entityLists: [], count: 0 },
          content: [{ type: "text", text: `Failed to list portal entity lists: ${error.message}` }],
        };
      }
    },
  );

  // ───────────────────────── list-portal-entityforms ─────────────────────────
  server.registerTool(
    "list-portal-entityforms",
    {
      title: "List Power Pages entity forms",
      description:
        "List mspp_entityforms of a site with their bound Dataverse formname and target table. " +
        "Match by `key` to what appears inside the Liquid {% entityform key:\"…\" %} of a page's mspp_copy.",
      inputSchema: {
        websiteId: z.string(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ entityForms: z.any(), count: z.number() }),
    },
    async ({ websiteId, environment }) => {
      try {
        const svc = registry.getContext(environment).getPortalService();
        const result = await svc.listEntityForms(websiteId);
        const entityForms = result.value ?? [];
        return {
          structuredContent: { entityForms, count: entityForms.length },
          content: [{ type: "text", text: `Found ${entityForms.length} entity forms:\n\n${JSON.stringify(entityForms, null, 2)}` }],
        };
      } catch (error: any) {
        return {
          structuredContent: { entityForms: [], count: 0 },
          content: [{ type: "text", text: `Failed to list portal entity forms: ${error.message}` }],
        };
      }
    },
  );

  // ───────────────────────── update-portal-webpage-js ─────────────────────────
  server.registerTool(
    "update-portal-webpage-js",
    {
      title: "Update the JS attached to a Power Pages page",
      description:
        "PATCH mspp_customjavascript on the CONTENT row of a Power Pages page. " +
        "The pageId MUST be the content row (language set) — the tool refuses to write to a root row " +
        "since it would have no runtime effect. Provide either `jsText` (inline string) or `filePath` " +
        "(absolute path to a local .js file — preferred for large files).",
      inputSchema: {
        contentPageId: z.string().describe("mspp_webpageid of the CONTENT row (the one with mspp_webpagelanguageid set)"),
        jsText: z.string().optional().describe("JS source as a string. Mutually exclusive with filePath."),
        filePath: z.string().optional().describe("Absolute path to a local .js file. Mutually exclusive with jsText."),
        environment: z.string().optional(),
      },
    },
    async ({ contentPageId, jsText, filePath, environment }) => {
      try {
        const svc = registry.getContext(environment).getPortalService();
        await svc.updateWebpageJs({ contentPageId, jsText, filePath });
        return { content: [{ type: "text", text: `Updated mspp_customjavascript on page ${contentPageId}` }] };
      } catch (error: any) {
        return { content: [{ type: "text", text: `Failed to update portal webpage JS: ${error.message}` }] };
      }
    },
  );

  // ───────────────────────── get-portal-foundation-components ─────────────────────────
  server.registerTool(
    "get-portal-foundation-components",
    {
      title: "Resolve the 5 foundation components of a Power Pages site",
      description:
        "Return the website, language(s), default page template, 'Publié' publishing state and root page " +
        "of a Power Pages site, with their componenttype codes ready to feed AddSolutionComponent. " +
        "These must be present in every portal solution so the import on UAT/PROD can resolve page references.",
      inputSchema: {
        websiteId: z.string(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ foundations: z.any(), count: z.number() }),
    },
    async ({ websiteId, environment }) => {
      try {
        const svc = registry.getContext(environment).getPortalService();
        const foundations = await svc.resolveFoundationComponents(websiteId);
        return {
          structuredContent: { foundations, count: foundations.length },
          content: [{ type: "text", text: `Foundation components:\n\n${JSON.stringify(foundations, null, 2)}` }],
        };
      } catch (error: any) {
        return {
          structuredContent: { foundations: [], count: 0 },
          content: [{ type: "text", text: `Failed to resolve foundation components: ${error.message}` }],
        };
      }
    },
  );

  // ───────────────────────── add-portal-story-components ─────────────────────────
  server.registerTool(
    "add-portal-story-components",
    {
      title: "Add a Power Pages story's components to a solution",
      description:
        "Batch-add to a solution: (1) the 5 foundation components of the site, (2) for each supplied " +
        "content page id, its content row + the resolved root row, (3) any extra components passed in " +
        "(typically savedquery + mspp_entitylist when a view was modified). All AddSolutionComponent calls " +
        "are idempotent on the Dataverse side — re-running is safe.",
      inputSchema: {
        solutionUniqueName: z.string().describe("Unique name of the target solution (already created)"),
        websiteId: z.string().describe("mspp_websiteid"),
        contentPageIds: z.array(z.string()).describe("List of CONTENT row mspp_webpageid (one per page modified)"),
        extra: z
          .array(
            z.object({
              componentId: z.string(),
              componentType: z.number(),
              label: z.string().optional(),
            }),
          )
          .optional()
          .describe(
            "Extra components to also add. Common cases: { componentId: <savedqueryid>, componentType: 26 } for a modified view; " +
              "{ componentId: <mspp_entitylistid>, componentType: 11400 } for the bound entity list.",
          ),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ added: z.any() }),
    },
    async ({ solutionUniqueName, websiteId, contentPageIds, extra, environment }) => {
      try {
        const svc = registry.getContext(environment).getPortalService();
        const result = await svc.addStoryComponents({ solutionUniqueName, websiteId, contentPageIds, extra });
        const failures = result.added.filter((c) => !c.ok);
        return {
          structuredContent: { added: result.added },
          content: [
            {
              type: "text",
              text:
                `Processed ${result.added.length} components for solution '${solutionUniqueName}'. ` +
                `Failures: ${failures.length}.\n\n${JSON.stringify(result.added, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          structuredContent: { added: [] },
          content: [{ type: "text", text: `Failed to add portal story components: ${error.message}` }],
        };
      }
    },
  );
}
