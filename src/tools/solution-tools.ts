import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EnvironmentRegistry } from "../environment-config.js";

/**
 * Register solution tools with the MCP server.
 */
export function registerSolutionTools(server: McpServer, registry: EnvironmentRegistry): void {
  // Get Publishers
  server.registerTool(
    "get-publishers",
    {
      title: "Get Publishers",
      description: "Get all non-readonly publishers in the PowerPlatform environment",
      inputSchema: {
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        publishers: z.any(),
      }),
    },
    async ({ environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getSolutionService();
        const result = await service.getPublishers();

        return {
          structuredContent: { publishers: result.value },
          content: [
            {
              type: "text",
              text: `Found ${result.value.length} publishers:\n\n${JSON.stringify(result.value, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting publishers:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to get publishers: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Solutions
  server.registerTool(
    "get-solutions",
    {
      title: "Get Solutions",
      description: "Get all visible solutions in the PowerPlatform environment, ordered by creation date",
      inputSchema: {
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        solutions: z.any(),
      }),
    },
    async ({ environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getSolutionService();
        const result = await service.getSolutions();

        return {
          structuredContent: { solutions: result.value },
          content: [
            {
              type: "text",
              text: `Found ${result.value.length} solutions:\n\n${JSON.stringify(result.value, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting solutions:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to get solutions: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Solution
  server.registerTool(
    "get-solution",
    {
      title: "Get Solution",
      description: "Get a specific solution by its unique name",
      inputSchema: {
        uniqueName: z.string().describe("The unique name of the solution"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        uniqueName: z.string(),
        solution: z.any(),
      }),
    },
    async ({ uniqueName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getSolutionService();
        const solution = await service.getSolution(uniqueName);

        if (!solution) {
          return {
            content: [
              {
                type: "text",
                text: `Solution '${uniqueName}' not found`,
              },
            ],
          };
        }

        return {
          structuredContent: { uniqueName, solution },
          content: [
            {
              type: "text",
              text: `Solution '${uniqueName}':\n\n${JSON.stringify(solution, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting solution:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to get solution: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Solution Components
  server.registerTool(
    "get-solution-components",
    {
      title: "Get Solution Components",
      description: "Get all components in a solution, ordered by component type",
      inputSchema: {
        solutionUniqueName: z.string().describe("The unique name of the solution"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        solutionUniqueName: z.string(),
        components: z.any(),
      }),
    },
    async ({ solutionUniqueName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getSolutionService();
        const result = await service.getSolutionComponents(solutionUniqueName);

        return {
          structuredContent: { solutionUniqueName, components: result.value },
          content: [
            {
              type: "text",
              text: `Found ${result.value.length} components in solution '${solutionUniqueName}':\n\n${JSON.stringify(result.value, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting solution components:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to get solution components: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Add Solution Component
  server.registerTool(
    "add-solution-component",
    {
      title: "Add Solution Component",
      description: "Add a component to a Dataverse solution",
      inputSchema: {
        solutionUniqueName: z.string().describe("The unique name of the target solution"),
        componentId: z.string().describe("The GUID of the component to add"),
        componentType: z.number().describe("Component type code (1=Entity, 2=Attribute, 14=SDKMessageProcessingStep, 61=WebResource, etc.)"),
        addRequiredComponents: z.boolean().optional().describe("Also add required dependencies (default: false)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        solutionUniqueName: z.string(),
        componentId: z.string(),
        result: z.any(),
      }),
    },
    async ({ solutionUniqueName, componentId, componentType, addRequiredComponents, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getSolutionService();
        const result = await service.addSolutionComponent(
          solutionUniqueName, componentId, componentType, addRequiredComponents ?? false,
        );

        return {
          structuredContent: { solutionUniqueName, componentId, result },
          content: [
            {
              type: "text",
              text: `Added component ${componentId} (type: ${componentType}) to solution '${solutionUniqueName}'`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error adding solution component:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to add solution component: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Publish Customizations
  server.registerTool(
    "publish-customizations",
    {
      title: "Publish Customizations",
      description: "Publish entity customizations or all customizations in Dataverse",
      inputSchema: {
        entityLogicalName: z.string().optional().describe("Entity to publish (if omitted, publishes all)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
    },
    async ({ entityLogicalName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getSolutionService();
        await service.publishCustomizations(entityLogicalName);

        const scope = entityLogicalName ? `entity '${entityLogicalName}'` : 'all entities';

        return {
          content: [
            {
              type: "text",
              text: `Published customizations for ${scope}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error publishing customizations:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to publish customizations: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Export Solution
  server.registerTool(
    "export-solution",
    {
      title: "Export Solution",
      description: "Export a solution as a base64-encoded package. This is a read-only operation that serializes the solution.",
      inputSchema: {
        solutionName: z.string().describe("The unique name of the solution to export"),
        managed: z.boolean().optional().describe("Export as managed solution (default: false)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        solutionName: z.string(),
        exportResult: z.any(),
      }),
    },
    async ({ solutionName, managed, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getSolutionService();
        const result = await service.exportSolution(solutionName, managed ?? false);

        return {
          structuredContent: { solutionName, exportResult: result },
          content: [
            {
              type: "text",
              text: `Solution '${solutionName}' exported successfully (managed: ${managed ?? false}):\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error exporting solution:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to export solution: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Update Solution Version
  server.registerTool(
    "update-solution-version",
    {
      title: "Update Solution Version",
      description: "Update the version of an existing solution. Used for releases (e.g. '1.0.0.0' → '1.0.1.0').",
      inputSchema: {
        uniqueName: z.string().describe("The unique name of the solution"),
        version: z.string().describe("New version string (4-part: major.minor.build.revision)"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ uniqueName: z.string(), solutionId: z.string(), version: z.string() }),
    },
    async ({ uniqueName, version, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getSolutionService();
        const result = await service.updateSolutionVersion(uniqueName, version);
        return {
          structuredContent: { uniqueName, ...result },
          content: [{ type: "text", text: `Solution '${uniqueName}' version updated to ${result.version}` }],
        };
      } catch (error: any) {
        console.error("Error updating solution version:", error);
        return { content: [{ type: "text", text: `Failed to update solution version: ${error.message}` }] };
      }
    }
  );

  // Create Solution
  server.registerTool(
    "create-solution",
    {
      title: "Create Solution",
      description: "Create a new unmanaged solution. The publisher must already exist (use get-publishers to find one).",
      inputSchema: {
        uniqueName: z.string().describe("Technical unique name (letters/digits/underscores). Convention: '{YYYYMMDD} - {EpicName}'"),
        friendlyName: z.string().describe("Display name shown in the maker portal"),
        publisherUniqueName: z.string().describe("Unique name of an existing publisher"),
        version: z.string().optional().describe("Default: '1.0.0.0'"),
        description: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ uniqueName: z.string(), solutionId: z.string() }),
    },
    async ({ uniqueName, friendlyName, publisherUniqueName, version, description, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getSolutionService();
        const result = await service.createSolution(uniqueName, friendlyName, publisherUniqueName, version ?? '1.0.0.0', description);
        return {
          structuredContent: { uniqueName, solutionId: result.solutionId },
          content: [{ type: "text", text: `Created solution '${uniqueName}' (ID: ${result.solutionId})` }],
        };
      } catch (error: any) {
        console.error("Error creating solution:", error);
        return { content: [{ type: "text", text: `Failed to create solution: ${error.message}` }] };
      }
    }
  );
}
