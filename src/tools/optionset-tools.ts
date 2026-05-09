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
        solutionName: z.string().optional().describe("Solution unique name to add the component to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
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

  // Update Attribute Label
  server.registerTool(
    "update-attribute-label",
    {
      title: "Update Attribute Label",
      description:
        "Update the display label of an existing column on an entity. Preserves labels in other languages. " +
        "Does NOT publish customizations — call publish-customizations once at the end of the build.",
      inputSchema: {
        entityName: z.string().describe("Logical name of the entity (e.g. 'br_reservation')"),
        attributeName: z.string().describe("Logical name of the attribute (e.g. 'br_status')"),
        displayName: z.string().describe("New display label"),
        languageCode: z.number().optional().describe("Language code (default: 1045)"),
        solutionName: z.string().optional().describe("Solution unique name to add the component to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({ entityName: z.string(), attributeName: z.string(), displayName: z.string() }),
    },
    async ({ entityName, attributeName, displayName, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getOptionSetService();
        await service.updateAttributeLabel(entityName, attributeName, displayName, languageCode ?? 1045, solutionName);
        return {
          structuredContent: { entityName, attributeName, displayName },
          content: [{ type: "text", text: `Updated label of '${entityName}.${attributeName}' to '${displayName}'. Remember to publish at the end of the build.` }],
        };
      } catch (error: any) {
        console.error("Error updating attribute label:", error);
        return { content: [{ type: "text", text: `Failed to update attribute label: ${error.message}` }] };
      }
    }
  );

  // Add Picklist Option
  server.registerTool(
    "add-picklist-option",
    {
      title: "Add Picklist Option",
      description:
        "Add an option to a local picklist (entityName + attributeName) or to a global option set (optionSetName). " +
        "Provide exactly one target. Value is auto-assigned if omitted. " +
        "Does NOT publish customizations.",
      inputSchema: {
        entityName: z.string().optional().describe("Local picklist: entity logical name"),
        attributeName: z.string().optional().describe("Local picklist: attribute logical name"),
        optionSetName: z.string().optional().describe("Global option set: schema name"),
        label: z.string().describe("Display label of the new option"),
        value: z.number().optional().describe("Explicit option value (auto-assigned if omitted)"),
        languageCode: z.number().optional().describe("Language code (default: 1045)"),
        solutionName: z.string().optional().describe("Solution unique name to add the component to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ value: z.number() }),
    },
    async ({ entityName, attributeName, optionSetName, label, value, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getOptionSetService();
        const result = await service.insertOptionValue({
          entityName, attributeName, optionSetName, label, value, languageCode, solutionName,
        });
        const target = optionSetName ?? `${entityName}.${attributeName}`;
        return {
          structuredContent: { value: result.value },
          content: [{ type: "text", text: `Added option '${label}' (value=${result.value}) to ${target}. Remember to publish at the end of the build.` }],
        };
      } catch (error: any) {
        console.error("Error adding picklist option:", error);
        return { content: [{ type: "text", text: `Failed to add picklist option: ${error.message}` }] };
      }
    }
  );

  // Remove Picklist Option
  server.registerTool(
    "remove-picklist-option",
    {
      title: "Remove Picklist Option",
      description:
        "Remove an option from a local picklist or a global option set. " +
        "Existing records that hold this value will keep the orphan integer — verify usage before deleting. " +
        "Does NOT publish customizations.",
      inputSchema: {
        entityName: z.string().optional(),
        attributeName: z.string().optional(),
        optionSetName: z.string().optional(),
        value: z.number().describe("Option value to remove"),
        solutionName: z.string().optional().describe("Solution unique name to add the component to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ value: z.number(), removed: z.boolean() }),
    },
    async ({ entityName, attributeName, optionSetName, value, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getOptionSetService();
        await service.deleteOptionValue({ entityName, attributeName, optionSetName, value, solutionName });
        const target = optionSetName ?? `${entityName}.${attributeName}`;
        return {
          structuredContent: { value, removed: true },
          content: [{ type: "text", text: `Removed option value=${value} from ${target}. Remember to publish at the end of the build.` }],
        };
      } catch (error: any) {
        console.error("Error removing picklist option:", error);
        return { content: [{ type: "text", text: `Failed to remove picklist option: ${error.message}` }] };
      }
    }
  );

  // Update Picklist Option Label
  server.registerTool(
    "update-picklist-option-label",
    {
      title: "Update Picklist Option Label",
      description:
        "Rename an existing option in a local picklist or a global option set. " +
        "Labels in other languages are preserved. Does NOT publish customizations.",
      inputSchema: {
        entityName: z.string().optional(),
        attributeName: z.string().optional(),
        optionSetName: z.string().optional(),
        value: z.number().describe("Option value to relabel"),
        label: z.string().describe("New label"),
        languageCode: z.number().optional().describe("Language code (default: 1045)"),
        solutionName: z.string().optional().describe("Solution unique name to add the component to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ value: z.number(), label: z.string() }),
    },
    async ({ entityName, attributeName, optionSetName, value, label, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getOptionSetService();
        await service.updateOptionValue({
          entityName, attributeName, optionSetName, value, label, languageCode, solutionName,
        });
        const target = optionSetName ?? `${entityName}.${attributeName}`;
        return {
          structuredContent: { value, label },
          content: [{ type: "text", text: `Renamed option value=${value} to '${label}' on ${target}. Remember to publish at the end of the build.` }],
        };
      } catch (error: any) {
        console.error("Error updating picklist option label:", error);
        return { content: [{ type: "text", text: `Failed to update picklist option label: ${error.message}` }] };
      }
    }
  );
}
