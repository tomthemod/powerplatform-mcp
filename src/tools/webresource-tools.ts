import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EnvironmentRegistry } from "../environment-config.js";

/**
 * Register web resource tools with the MCP server.
 */
export function registerWebResourceTools(server: McpServer, registry: EnvironmentRegistry): void {
  // Get Web Resources
  server.registerTool(
    "get-web-resources",
    {
      title: "Get Web Resources",
      description: "List web resources in a PowerPlatform environment with optional type and name filters",
      inputSchema: {
        webResourceType: z.number().optional().describe("Filter by web resource type (1=HTML, 2=CSS, 3=JavaScript, 4=XML, 5=PNG, 6=JPG, 7=GIF, 8=Silverlight, 9=StyleSheet, 10=ICO, 11=Vector, 12=SVG)"),
        nameFilter: z.string().optional().describe("Filter web resources whose name contains this string"),
        maxRecords: z.number().optional().describe("Maximum number of records to return (default: 100)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        webResources: z.any(),
        count: z.number(),
      }),
    },
    async ({ webResourceType, nameFilter, maxRecords, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getWebResourceService();
        const result = await service.getWebResources({ maxRecords, webResourceType, nameFilter });
        const webResources = result.value || [];

        return {
          structuredContent: { webResources, count: webResources.length },
          content: [
            {
              type: "text",
              text: `Found ${webResources.length} web resources:\n\n${JSON.stringify(webResources, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting web resources:", error);
        return {
          structuredContent: { webResources: [], count: 0 },
          content: [
            {
              type: "text",
              text: `Failed to get web resources: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Web Resource
  server.registerTool(
    "get-web-resource",
    {
      title: "Get Web Resource",
      description: "Get a single web resource by its exact name",
      inputSchema: {
        name: z.string().describe("The exact name of the web resource"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        name: z.string(),
        webResource: z.any(),
      }),
    },
    async ({ name, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getWebResourceService();
        const webResource = await service.getWebResource(name);

        if (!webResource) {
          return {
            structuredContent: { name, webResource: null },
            content: [
              {
                type: "text",
                text: `Web resource '${name}' not found.`,
              },
            ],
          };
        }

        return {
          structuredContent: { name, webResource },
          content: [
            {
              type: "text",
              text: `Web resource '${name}':\n\n${JSON.stringify(webResource, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting web resource:", error);
        return {
          structuredContent: { name, webResource: null },
          content: [
            {
              type: "text",
              text: `Failed to get web resource: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Create Web Resource
  server.registerTool(
    "create-web-resource",
    {
      title: "Create Web Resource",
      description: "Create a new web resource in a PowerPlatform environment. Content must be base64-encoded.",
      inputSchema: {
        name: z.string().describe("The name of the web resource (e.g. 'prefix_/scripts/main.js')"),
        displayName: z.string().describe("The display name of the web resource"),
        webResourceType: z.number().describe("Web resource type (1=HTML, 2=CSS, 3=JavaScript, 4=XML, 5=PNG, 6=JPG, 7=GIF, 8=Silverlight, 9=StyleSheet, 10=ICO, 11=Vector, 12=SVG)"),
        content: z.string().describe("The base64-encoded content of the web resource"),
        description: z.string().optional().describe("Description of the web resource"),
        solutionName: z.string().optional().describe("Solution unique name to add the component to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        name: z.string(),
        webResourceId: z.string(),
      }),
    },
    async ({ name, displayName, webResourceType, content, description, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getWebResourceService();
        const result = await service.createWebResource({
          name, displayName, webResourceType, content, description, solutionName,
        });

        return {
          structuredContent: { name, webResourceId: result.webResourceId },
          content: [
            {
              type: "text",
              text: `Created web resource '${name}' (ID: ${result.webResourceId})`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error creating web resource:", error);
        return {
          structuredContent: { name, webResourceId: "" },
          content: [
            {
              type: "text",
              text: `Failed to create web resource: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Update Web Resource
  server.registerTool(
    "update-web-resource",
    {
      title: "Update Web Resource",
      description: "Update an existing web resource's content (base64-encoded). Only `content` is touched; display name/type are left alone.",
      inputSchema: {
        webResourceId: z.string().describe("The GUID of the existing web resource"),
        content: z.string().describe("Base64-encoded new content"),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
    },
    async ({ webResourceId, content, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getWebResourceService();
        await service.updateWebResource(webResourceId, content, solutionName);
        return { content: [{ type: "text", text: `Updated web resource ${webResourceId}` }] };
      } catch (error: any) {
        console.error("Error updating web resource:", error);
        return { content: [{ type: "text", text: `Failed to update web resource: ${error.message}` }] };
      }
    }
  );

  // Delete Web Resource
  server.registerTool(
    "delete-web-resource",
    {
      title: "Delete Web Resource",
      description: "Delete a web resource by ID. Irreversible. Run check-component-dependencies first if the web resource is referenced by forms / ribbons / sitemap (Dataverse will refuse the delete otherwise).",
      inputSchema: {
        webResourceId: z.string(),
        environment: z.string().optional(),
      },
    },
    async ({ webResourceId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getWebResourceService();
        await service.deleteWebResource(webResourceId);
        return { content: [{ type: "text", text: `Deleted web resource ${webResourceId}` }] };
      } catch (error: any) {
        console.error("Error deleting web resource:", error);
        return { content: [{ type: "text", text: `Failed to delete web resource: ${error.message}` }] };
      }
    }
  );

  // Upsert Web Resource
  server.registerTool(
    "upsert-web-resource",
    {
      title: "Upsert Web Resource",
      description: "Create a new web resource, or update the content of an existing one with the same name. Idempotent across re-runs.",
      inputSchema: {
        name: z.string(),
        displayName: z.string(),
        webResourceType: z.number().describe("1=HTML, 2=CSS, 3=JS, 4=XML, 5=PNG, 6=JPG, 7=GIF, 9=XSL, 10=ICO, 11=SVG, 12=RESX"),
        content: z.string().describe("Base64-encoded content"),
        description: z.string().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ name: z.string(), webResourceId: z.string(), created: z.boolean() }),
    },
    async ({ name, displayName, webResourceType, content, description, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getWebResourceService();
        const result = await service.upsertWebResource({ name, displayName, webResourceType, content, description, solutionName });
        return {
          structuredContent: { name, webResourceId: result.webResourceId, created: result.created },
          content: [{ type: "text", text: `${result.created ? 'Created' : 'Updated'} web resource '${name}' (ID: ${result.webResourceId})` }],
        };
      } catch (error: any) {
        console.error("Error upserting web resource:", error);
        return {
          structuredContent: { name, webResourceId: "", created: false },
          content: [{ type: "text", text: `Failed to upsert web resource: ${error.message}` }],
        };
      }
    }
  );
}
