import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EnvironmentRegistry } from "../environment-config.js";

/**
 * Register option set tools with the MCP server.
 */
export function registerOptionSetTools(server: McpServer, registry: EnvironmentRegistry): void {
  // Get Global Option Set
  server.registerTool(
    "get-global-option-set",
    {
      title: "Get Global Option Set",
      description: "Get a global option set definition by name",
      inputSchema: {
        optionSetName: z.string().describe("The name of the global option set"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        optionSetName: z.string(),
        optionSet: z.any(),
      }),
    },
    async ({ optionSetName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getOptionSetService();
        const optionSet = await service.getGlobalOptionSet(optionSetName);

        return {
          structuredContent: { optionSetName, optionSet },
          content: [
            {
              type: "text",
              text: `Global option set '${optionSetName}':\n\n${JSON.stringify(optionSet, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting global option set:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to get global option set: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Create Global Option Set
  server.registerTool(
    "create-global-option-set",
    {
      title: "Create Global Option Set",
      description: "Create a global Choice / Option Set definition reusable across multiple Dataverse entities.",
      inputSchema: {
        name: z.string().describe("Schema name including publisher prefix (e.g. 'new_priority')"),
        displayName: z.string(),
        options: z.array(z.object({ value: z.number(), label: z.string() })),
        description: z.string().optional(),
        languageCode: z.number().optional().describe("Default: 1045"),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ name: z.string(), optionSetId: z.string() }),
    },
    async ({ name, displayName, options, description, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getOptionSetService();
        const result = await service.createGlobalOptionSet(name, displayName, options, description, languageCode ?? 1045, solutionName);
        return {
          structuredContent: { name, optionSetId: result.optionSetId },
          content: [{ type: "text", text: `Created global option set '${name}' with ${options.length} options (ID: ${result.optionSetId})` }],
        };
      } catch (error: any) {
        console.error("Error creating global option set:", error);
        return { content: [{ type: "text", text: `Failed to create global option set: ${error.message}` }] };
      }
    }
  );
}
