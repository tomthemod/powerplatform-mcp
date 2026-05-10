import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EnvironmentRegistry } from "../environment-config.js";

/**
 * Register plugin tools with the MCP server.
 */
export function registerPluginTools(server: McpServer, registry: EnvironmentRegistry): void {
  // Get Plugin Assemblies
  server.registerTool(
    "get-plugin-assemblies",
    {
      title: "Get Plugin Assemblies",
      description: "Get all plugin assemblies in the environment",
      inputSchema: {
        includeManaged: z.boolean().optional().describe("Include managed assemblies (default: false)"),
        maxRecords: z.number().optional().describe("Maximum number of records to retrieve (default: 100)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        totalCount: z.number(),
        assemblies: z.any(),
      }),
    },
    async ({ includeManaged, maxRecords, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const result = await service.getPluginAssemblies(includeManaged ?? false, maxRecords ?? 100);

        return {
          structuredContent: result,
          content: [
            {
              type: "text",
              text: `Found ${result.totalCount} plugin assemblies:\n\n${JSON.stringify(result.assemblies, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting plugin assemblies:", error);
        return {
          structuredContent: { totalCount: 0, assemblies: [] },
          content: [
            {
              type: "text",
              text: `Failed to get plugin assemblies: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Plugin Assembly Complete
  server.registerTool(
    "get-plugin-assembly-complete",
    {
      title: "Get Plugin Assembly Complete",
      description: "Get a plugin assembly by name with all related plugin types, steps, and images",
      inputSchema: {
        assemblyName: z.string().describe("The name of the plugin assembly"),
        includeDisabled: z.boolean().optional().describe("Include disabled steps (default: false)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        assembly: z.any(),
        pluginTypes: z.any(),
        steps: z.any(),
        validation: z.any(),
      }),
    },
    async ({ assemblyName, includeDisabled, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const result = await service.getPluginAssemblyComplete(assemblyName, includeDisabled ?? false);

        return {
          structuredContent: result,
          content: [
            {
              type: "text",
              text: `Plugin assembly '${assemblyName}':\n\n` +
                `Plugin Types: ${result.pluginTypes.length}\n` +
                `Steps: ${result.steps.length}\n` +
                `Potential Issues: ${result.validation.potentialIssues.length > 0 ? result.validation.potentialIssues.join(', ') : 'None'}\n\n` +
                `${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting plugin assembly:", error);
        return {
          structuredContent: { assembly: null, pluginTypes: [], steps: [], validation: null },
          content: [
            {
              type: "text",
              text: `Failed to get plugin assembly: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Entity Plugin Pipeline
  server.registerTool(
    "get-entity-plugin-pipeline",
    {
      title: "Get Entity Plugin Pipeline",
      description: "Get all plugins that execute on a specific entity, organized by message and stage",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        messageFilter: z.string().optional().describe("Filter by specific message (e.g., 'Create', 'Update', 'Delete')"),
        includeDisabled: z.boolean().optional().describe("Include disabled steps (default: false)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entity: z.string(),
        messages: z.any(),
        steps: z.any(),
        executionOrder: z.any(),
      }),
    },
    async ({ entityName, messageFilter, includeDisabled, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const result = await service.getEntityPluginPipeline(entityName, messageFilter, includeDisabled ?? false);

        return {
          structuredContent: result,
          content: [
            {
              type: "text",
              text: `Plugin pipeline for entity '${entityName}':\n\n` +
                `Total Steps: ${result.steps.length}\n` +
                `Messages: ${result.messages.length}\n\n` +
                `Execution Order:\n${result.executionOrder.map((name, i) => `${i + 1}. ${name}`).join('\n')}\n\n` +
                `${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting entity plugin pipeline:", error);
        return {
          structuredContent: { entity: entityName, messages: [], steps: [], executionOrder: [] },
          content: [
            {
              type: "text",
              text: `Failed to get entity plugin pipeline: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Plugin Trace Logs
  server.registerTool(
    "get-plugin-trace-logs",
    {
      title: "Get Plugin Trace Logs",
      description: "Get plugin trace logs with filtering options",
      inputSchema: {
        entityName: z.string().optional().describe("Filter by entity name"),
        messageName: z.string().optional().describe("Filter by message name (e.g., 'Create', 'Update')"),
        correlationId: z.string().optional().describe("Filter by correlation ID"),
        pluginStepId: z.string().optional().describe("Filter by plugin step ID"),
        exceptionOnly: z.boolean().optional().describe("Only show logs with exceptions (default: false)"),
        hoursBack: z.number().optional().describe("Hours to look back (default: 24)"),
        maxRecords: z.number().optional().describe("Maximum number of records (default: 50)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        totalCount: z.number(),
        logs: z.any(),
      }),
    },
    async ({ entityName, messageName, correlationId, pluginStepId, exceptionOnly, hoursBack, maxRecords, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const result = await service.getPluginTraceLogs({
          entityName,
          messageName,
          correlationId,
          pluginStepId,
          exceptionOnly: exceptionOnly ?? false,
          hoursBack: hoursBack ?? 24,
          maxRecords: maxRecords ?? 50,
        });

        const exceptionCount = result.logs.filter((log: any) => log.parsed?.hasException).length;

        return {
          structuredContent: result,
          content: [
            {
              type: "text",
              text: `Plugin trace logs:\n\n` +
                `Total Logs: ${result.totalCount}\n` +
                `Exceptions: ${exceptionCount}\n\n` +
                `${JSON.stringify(result.logs, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting plugin trace logs:", error);
        return {
          structuredContent: { totalCount: 0, logs: [] },
          content: [
            {
              type: "text",
              text: `Failed to get plugin trace logs: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Plugin Type
  server.registerTool(
    "get-plugin-type",
    {
      title: "Get Plugin Type",
      description: "Look up a plugin type by its fully qualified class name (e.g. 'miejskinajem.Plugins.Hospitable.SyncProperties')",
      inputSchema: {
        typeName: z.string().describe("The fully qualified class name of the plugin type"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        typeName: z.string(),
        pluginType: z.any(),
      }),
    },
    async ({ typeName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const pluginType = await service.getPluginType(typeName);

        if (!pluginType) {
          return {
            structuredContent: { typeName, pluginType: null },
            content: [{ type: "text", text: `Plugin type '${typeName}' not found` }],
          };
        }

        return {
          structuredContent: { typeName, pluginType },
          content: [
            {
              type: "text",
              text: `Plugin type '${typeName}':\n\n${JSON.stringify(pluginType, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting plugin type:", error);
        return {
          structuredContent: { typeName, pluginType: null },
          content: [{ type: "text", text: `Failed to get plugin type: ${error.message}` }],
        };
      }
    }
  );

  // Get SDK Message
  server.registerTool(
    "get-sdk-message",
    {
      title: "Get SDK Message",
      description: "Look up an SDK message by name (e.g. 'Create', 'Update', 'br_SyncProperties'). Returns the message GUID needed for plugin step registration.",
      inputSchema: {
        messageName: z.string().describe("The name of the SDK message"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        messageName: z.string(),
        message: z.any(),
      }),
    },
    async ({ messageName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const message = await service.getSdkMessage(messageName);

        if (!message) {
          return {
            structuredContent: { messageName, message: null },
            content: [
              {
                type: "text",
                text: `SDK message '${messageName}' not found`,
              },
            ],
          };
        }

        return {
          structuredContent: { messageName, message },
          content: [
            {
              type: "text",
              text: `SDK message '${messageName}':\n\n${JSON.stringify(message, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting SDK message:", error);
        return {
          structuredContent: { messageName, message: null },
          content: [
            {
              type: "text",
              text: `Failed to get SDK message: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Create Plugin Step
  server.registerTool(
    "create-plugin-step",
    {
      title: "Create Plugin Step",
      description: "Register a new plugin step (SDK message processing step)",
      inputSchema: {
        name: z.string().describe("Step name"),
        pluginTypeId: z.string().describe("GUID of the plugin type to execute"),
        sdkMessageId: z.string().describe("GUID of the SDK message (e.g. from get-sdk-message)"),
        stage: z.number().describe("Execution stage: 10=PreValidation, 20=PreOperation, 40=PostOperation"),
        mode: z.number().describe("Execution mode: 0=Synchronous, 1=Asynchronous"),
        rank: z.number().optional().describe("Execution order (default: 1)"),
        supportedDeployment: z.number().optional().describe("0=ServerOnly, 1=OfflineOnly, 2=Both (default: 0)"),
        description: z.string().optional().describe("Step description"),
        configuration: z.string().optional().describe("Unsecure configuration string"),
        sdkMessageFilterId: z.string().optional().describe("GUID of the SDK message filter (entity filter)"),
        solutionName: z.string().optional().describe("Solution unique name to add the component to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        name: z.string(),
        stepId: z.string(),
      }),
    },
    async ({ name, pluginTypeId, sdkMessageId, stage, mode, rank, supportedDeployment, description, configuration, sdkMessageFilterId, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const result = await service.createPluginStep({
          name, pluginTypeId, sdkMessageId, stage, mode,
          rank, supportedDeployment, description, configuration, sdkMessageFilterId, solutionName,
        });

        const stageName = stage === 10 ? 'PreValidation' : stage === 20 ? 'PreOperation' : 'PostOperation';
        const modeName = mode === 0 ? 'Synchronous' : 'Asynchronous';

        return {
          structuredContent: { name, stepId: result.stepId },
          content: [
            {
              type: "text",
              text: `Created plugin step '${name}' (${stageName}, ${modeName}, ID: ${result.stepId})`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error creating plugin step:", error);
        return {
          structuredContent: { name, stepId: "" },
          content: [
            {
              type: "text",
              text: `Failed to create plugin step: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get All Plugin Steps
  server.registerTool(
    "get-all-plugin-steps",
    {
      title: "Get All Plugin Steps",
      description: "Get all plugin SDK message processing steps across all assemblies in the environment",
      inputSchema: {
        includeDisabled: z.boolean().optional().describe("Include disabled steps (default: true)"),
        maxRecords: z.number().optional().describe("Maximum records (default: 500)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
    },
    async ({ includeDisabled, maxRecords, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const result = await service.getAllPluginSteps({
          includeDisabled: includeDisabled ?? true,
          maxRecords: maxRecords ?? 500,
        });

        const enabledCount = result.steps.filter((s) => s.enabled).length;

        return {
          structuredContent: result,
          content: [
            {
              type: "text",
              text: `Found ${result.totalCount} plugin steps (${enabledCount} enabled):\n\n${JSON.stringify(result.steps, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting all plugin steps:", error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to get plugin steps: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Plugin Packages
  server.registerTool(
    "get-plugin-packages",
    {
      title: "Get Plugin Packages",
      description: "List plugin packages (.nupkg-based plugin assemblies) in the environment.",
      inputSchema: {
        includeManaged: z.boolean().optional().describe("Include managed packages (default: false)"),
        maxRecords: z.number().optional().describe("Default: 100"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ totalCount: z.number(), packages: z.any() }),
    },
    async ({ includeManaged, maxRecords, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const result = await service.getPluginPackages(includeManaged ?? false, maxRecords ?? 100);
        return {
          structuredContent: result,
          content: [{ type: "text", text: `Found ${result.totalCount} plugin packages:\n\n${JSON.stringify(result.packages, null, 2)}` }],
        };
      } catch (error: any) {
        console.error("Error getting plugin packages:", error);
        return {
          structuredContent: { totalCount: 0, packages: [] },
          content: [{ type: "text", text: `Failed to get plugin packages: ${error.message}` }],
        };
      }
    }
  );

  // Register Plugin Package
  server.registerTool(
    "register-plugin-package",
    {
      title: "Register Plugin Package",
      description: "Register a new plugin package by uploading a base64-encoded .nupkg file.",
      inputSchema: {
        name: z.string(),
        uniqueName: z.string(),
        version: z.string().describe("Package version, e.g. '1.0.0'"),
        content: z.string().describe("Base64-encoded .nupkg file content"),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ pluginPackageId: z.string() }),
    },
    async ({ name, uniqueName, version, content, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const result = await service.registerPluginPackage({ name, uniqueName, version, content, solutionName });
        return {
          structuredContent: { pluginPackageId: result.pluginPackageId },
          content: [{ type: "text", text: `Registered plugin package '${name}' v${version} (ID: ${result.pluginPackageId})` }],
        };
      } catch (error: any) {
        console.error("Error registering plugin package:", error);
        return {
          structuredContent: { pluginPackageId: "" },
          content: [{ type: "text", text: `Failed to register plugin package: ${error.message}` }],
        };
      }
    }
  );

  // Update Plugin Package
  server.registerTool(
    "update-plugin-package",
    {
      title: "Update Plugin Package",
      description: "Update an existing plugin package's content (and optionally version).",
      inputSchema: {
        pluginPackageId: z.string(),
        content: z.string().describe("Base64-encoded .nupkg file content"),
        version: z.string().optional(),
        environment: z.string().optional(),
      },
    },
    async ({ pluginPackageId, content, version, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        await service.updatePluginPackage({ pluginPackageId, content, version });
        return { content: [{ type: "text", text: `Updated plugin package ${pluginPackageId}${version ? ` to v${version}` : ''}` }] };
      } catch (error: any) {
        console.error("Error updating plugin package:", error);
        return { content: [{ type: "text", text: `Failed to update plugin package: ${error.message}` }] };
      }
    }
  );

  // Enable Plugin Step
  server.registerTool(
    "enable-plugin-step",
    {
      title: "Enable Plugin Step",
      description: "Activate a plugin step (statecode=0, statuscode=1).",
      inputSchema: {
        stepId: z.string().describe("The SDK message processing step ID"),
        environment: z.string().optional(),
      },
    },
    async ({ stepId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        await service.enablePluginStep(stepId);
        return { content: [{ type: "text", text: `Enabled plugin step ${stepId}` }] };
      } catch (error: any) {
        console.error("Error enabling plugin step:", error);
        return { content: [{ type: "text", text: `Failed to enable plugin step: ${error.message}` }] };
      }
    }
  );

  // Disable Plugin Step
  server.registerTool(
    "disable-plugin-step",
    {
      title: "Disable Plugin Step",
      description: "Deactivate a plugin step (statecode=1, statuscode=2). Reversible — use enable-plugin-step to re-activate.",
      inputSchema: {
        stepId: z.string(),
        environment: z.string().optional(),
      },
    },
    async ({ stepId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        await service.disablePluginStep(stepId);
        return { content: [{ type: "text", text: `Disabled plugin step ${stepId}` }] };
      } catch (error: any) {
        console.error("Error disabling plugin step:", error);
        return { content: [{ type: "text", text: `Failed to disable plugin step: ${error.message}` }] };
      }
    }
  );

  // Delete Plugin Step
  server.registerTool(
    "delete-plugin-step",
    {
      title: "Delete Plugin Step",
      description: "Delete a plugin step. Irreversible — Dataverse cascades to its images. Run check-component-dependencies first if the step is in a managed solution.",
      inputSchema: {
        stepId: z.string(),
        environment: z.string().optional(),
      },
    },
    async ({ stepId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        await service.deletePluginStep(stepId);
        return { content: [{ type: "text", text: `Deleted plugin step ${stepId}` }] };
      } catch (error: any) {
        console.error("Error deleting plugin step:", error);
        return { content: [{ type: "text", text: `Failed to delete plugin step: ${error.message}` }] };
      }
    }
  );

  // Register Plugin Assembly (traditional .dll)
  server.registerTool(
    "register-plugin-assembly",
    {
      title: "Register Plugin Assembly",
      description: "Register a traditional plugin assembly (.dll, base64-encoded). For .nupkg-based packages, use register-plugin-package instead.",
      inputSchema: {
        name: z.string().describe("Assembly name (display + identifier)"),
        content: z.string().describe("Base64-encoded .dll bytes"),
        version: z.string().describe("Assembly version, e.g. '1.0.0.0'"),
        isolationMode: z.enum(["1", "2"]).optional().describe("1=None, 2=Sandbox (default 2 — Online forces sandbox anyway)"),
        description: z.string().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ pluginAssemblyId: z.string() }),
    },
    async ({ name, content, version, isolationMode, description, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const iso = isolationMode ? (parseInt(isolationMode, 10) as 1 | 2) : 2;
        const result = await service.registerPluginAssembly({ name, content, version, isolationMode: iso, description, solutionName });
        return {
          structuredContent: { pluginAssemblyId: result.pluginAssemblyId },
          content: [{ type: "text", text: `Registered plugin assembly '${name}' v${version} (ID: ${result.pluginAssemblyId})` }],
        };
      } catch (error: any) {
        console.error("Error registering plugin assembly:", error);
        return {
          structuredContent: { pluginAssemblyId: "" },
          content: [{ type: "text", text: `Failed to register plugin assembly: ${error.message}` }],
        };
      }
    }
  );

  // Create Plugin Step Image
  server.registerTool(
    "create-plugin-step-image",
    {
      title: "Create Plugin Step Image",
      description: "Register a PreImage or PostImage on an existing SDK message processing step. Images let plugins read pre/post operation row state.",
      inputSchema: {
        stepId: z.string().describe("The SDK message processing step ID"),
        name: z.string().optional().describe("Default: 'PreImage'"),
        entityAlias: z.string().optional().describe("Default: same as name"),
        imageType: z.number().optional().describe("0=PreImage, 1=PostImage, 2=Both (default: 0)"),
        messagePropertyName: z.string().optional().describe("Default: 'Target'"),
        attributes: z.string().optional().describe("Comma-separated attribute names; omit for all attributes"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ imageId: z.string() }),
    },
    async ({ stepId, name, entityAlias, imageType, messagePropertyName, attributes, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getPluginService();
        const result = await service.createPluginStepImage({ stepId, name, entityAlias, imageType, messagePropertyName, attributes });
        return {
          structuredContent: { imageId: result.imageId },
          content: [{ type: "text", text: `Created plugin step image (ID: ${result.imageId})` }],
        };
      } catch (error: any) {
        console.error("Error creating plugin step image:", error);
        return {
          structuredContent: { imageId: "" },
          content: [{ type: "text", text: `Failed to create plugin step image: ${error.message}` }],
        };
      }
    }
  );
}
