import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EnvironmentRegistry } from "../environment-config.js";

/**
 * Register configuration tools with the MCP server.
 */
export function registerConfigurationTools(server: McpServer, registry: EnvironmentRegistry): void {
  // Get Connection References
  server.registerTool(
    "get-connection-references",
    {
      title: "Get Connection References",
      description: "Get connection references in the PowerPlatform environment with optional filtering by managed status, connection presence, and active state",
      inputSchema: {
        maxRecords: z.number().optional().describe("Maximum number of records to return (default: 100)"),
        managedOnly: z.boolean().optional().describe("Only return managed connection references (default: false)"),
        hasConnection: z.boolean().optional().describe("Filter to connection references that have (true) or lack (false) a connection set"),
        inactive: z.boolean().optional().describe("Filter to inactive connection references (statecode ne 0)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        connectionReferences: z.any(),
      }),
    },
    async ({ maxRecords, managedOnly, hasConnection, inactive, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getConfigurationService();
        const result = await service.getConnectionReferences({ maxRecords, managedOnly, hasConnection, inactive });

        return {
          structuredContent: { connectionReferences: result.value },
          content: [
            {
              type: "text",
              text: `Found ${result.value.length} connection references:\n\n${JSON.stringify(result.value, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting connection references:", error);
        return {
          structuredContent: { connectionReferences: [] },
          content: [
            {
              type: "text",
              text: `Failed to get connection references: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Create Environment Variable
  server.registerTool(
    "create-environment-variable",
    {
      title: "Create Environment Variable",
      description: "Create a new environment variable definition in Dataverse",
      inputSchema: {
        schemaName: z.string().describe("The schema name (e.g. br_HospitableApiToken)"),
        displayName: z.string().describe("The display name"),
        type: z.enum(["String", "Number", "Boolean", "JSON", "DataSource"]).describe("The variable type"),
        defaultValue: z.string().optional().describe("Default value"),
        description: z.string().optional().describe("Description"),
        solutionName: z.string().optional().describe("Solution unique name to add the component to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        schemaName: z.string(),
        definitionId: z.string(),
      }),
    },
    async ({ schemaName, displayName, type, defaultValue, description, solutionName, environment }) => {
      try {
        const typeMap: Record<string, number> = {
          String: 100000000, Number: 100000001, Boolean: 100000002,
          JSON: 100000003, DataSource: 100000004,
        };
        const ctx = registry.getContext(environment);
        const service = ctx.getConfigurationService();
        const result = await service.createEnvironmentVariableDefinition({
          schemaName, displayName, type: typeMap[type], defaultValue, description, solutionName,
        });

        return {
          structuredContent: { schemaName, definitionId: result.definitionId },
          content: [
            {
              type: "text",
              text: `Created environment variable '${schemaName}' (type: ${type}, ID: ${result.definitionId})`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error creating environment variable:", error);
        return {
          structuredContent: { schemaName, definitionId: "" },
          content: [
            {
              type: "text",
              text: `Failed to create environment variable: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Set Environment Variable Value
  server.registerTool(
    "set-environment-variable-value",
    {
      title: "Set Environment Variable Value",
      description: "Set or update the current value of an environment variable",
      inputSchema: {
        definitionId: z.string().describe("The environment variable definition ID"),
        value: z.string().describe("The value to set"),
        existingValueId: z.string().optional().describe("Existing value record ID to update (if omitted, creates new)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        valueId: z.string(),
      }),
    },
    async ({ definitionId, value, existingValueId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getConfigurationService();
        const result = await service.setEnvironmentVariableValue({
          definitionId, value, existingValueId,
        });

        return {
          structuredContent: { valueId: result.valueId },
          content: [
            {
              type: "text",
              text: `${existingValueId ? 'Updated' : 'Created'} environment variable value (ID: ${result.valueId})`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error setting environment variable value:", error);
        return {
          structuredContent: { valueId: "" },
          content: [
            {
              type: "text",
              text: `Failed to set environment variable value: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Environment Variables
  server.registerTool(
    "get-environment-variables",
    {
      title: "Get Environment Variables",
      description: "Get environment variable definitions and their current values from the PowerPlatform environment",
      inputSchema: {
        maxRecords: z.number().optional().describe("Maximum number of records to return (default: 100)"),
        managedOnly: z.boolean().optional().describe("Only return managed environment variables (default: false)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        environmentVariables: z.any(),
      }),
    },
    async ({ maxRecords, managedOnly, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getConfigurationService();
        const result = await service.getEnvironmentVariables({ maxRecords, managedOnly });

        return {
          structuredContent: { environmentVariables: result.value },
          content: [
            {
              type: "text",
              text: `Found ${result.value.length} environment variables:\n\n${JSON.stringify(result.value, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting environment variables:", error);
        return {
          structuredContent: { environmentVariables: [] },
          content: [
            {
              type: "text",
              text: `Failed to get environment variables: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Create Connection Reference
  server.registerTool(
    "create-connection-reference",
    {
      title: "Create Connection Reference",
      description: "Create a connection reference. When solutionName is provided, places it directly in that solution.",
      inputSchema: {
        logicalName: z.string().describe("Connection reference logical name (e.g. 'new_SharedSharepointonline')"),
        displayName: z.string(),
        connectorId: z.string().describe("Connector ID, e.g. '/providers/Microsoft.PowerApps/apis/shared_sharepointonline'"),
        description: z.string().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ connectionReferenceId: z.string() }),
    },
    async ({ logicalName, displayName, connectorId, description, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getConfigurationService();
        const result = await service.createConnectionReference({ logicalName, displayName, connectorId, description, solutionName });
        return {
          structuredContent: { connectionReferenceId: result.connectionReferenceId },
          content: [{ type: "text", text: `Created connection reference '${logicalName}' (ID: ${result.connectionReferenceId})` }],
        };
      } catch (error: any) {
        console.error("Error creating connection reference:", error);
        return {
          structuredContent: { connectionReferenceId: "" },
          content: [{ type: "text", text: `Failed to create connection reference: ${error.message}` }],
        };
      }
    }
  );
}
