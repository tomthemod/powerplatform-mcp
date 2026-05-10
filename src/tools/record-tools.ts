import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EnvironmentRegistry } from "../environment-config.js";

/**
 * Register record tools with the MCP server.
 */
export function registerRecordTools(server: McpServer, registry: EnvironmentRegistry): void {
  // Get Record
  server.registerTool(
    "get-record",
    {
      title: "Get Record",
      description: "Get a specific record by entity name (plural) and ID",
      inputSchema: {
        entityNamePlural: z.string().describe("The plural name of the entity (e.g., 'accounts', 'contacts')"),
        recordId: z.string().describe("The GUID of the record"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entityNamePlural: z.string(),
        recordId: z.string(),
        record: z.any(),
      }),
    },
    async ({ entityNamePlural, recordId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getRecordService();
        const record = await service.getRecord(entityNamePlural, recordId);

        return {
          structuredContent: { entityNamePlural, recordId, record },
          content: [
            {
              type: "text",
              text: `Record from '${entityNamePlural}' with ID '${recordId}':\n\n${JSON.stringify(record, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting record:", error);
        return {
          structuredContent: { entityNamePlural, recordId, record: null },
          content: [
            {
              type: "text",
              text: `Failed to get record: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Query Records
  server.registerTool(
    "query-records",
    {
      title: "Query Records",
      description: "Query records using an OData filter expression",
      inputSchema: {
        entityNamePlural: z.string().describe("The plural name of the entity (e.g., 'accounts', 'contacts')"),
        filter: z.string().describe("OData filter expression (e.g., \"name eq 'test'\" or \"createdon gt 2023-01-01\")"),
        maxRecords: z.number().optional().describe("Maximum number of records to retrieve (default: 50)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entityNamePlural: z.string(),
        filter: z.string(),
        count: z.number(),
        records: z.any(),
      }),
    },
    async ({ entityNamePlural, filter, maxRecords, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getRecordService();
        const records = await service.queryRecords(entityNamePlural, filter, maxRecords || 50);
        const recordCount = records.value?.length || 0;

        return {
          structuredContent: { entityNamePlural, filter, count: recordCount, records },
          content: [
            {
              type: "text",
              text: `Retrieved ${recordCount} records from '${entityNamePlural}' with filter '${filter}':\n\n${JSON.stringify(records, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error querying records:", error);
        return {
          structuredContent: { entityNamePlural, filter, count: 0, records: [] },
          content: [
            {
              type: "text",
              text: `Failed to query records: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Create Record
  server.registerTool(
    "create-record",
    {
      title: "Create Record",
      description: "Create a record. Lookups use @odata.bind, e.g. { 'primarycontactid@odata.bind': '/contacts(<guid>)' }.",
      inputSchema: {
        entityNamePlural: z.string().describe("Plural entity name (e.g. 'accounts', 'contacts')"),
        data: z.record(z.string(), z.any()).describe("Record payload as JSON object"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ entityNamePlural: z.string(), entityId: z.string() }),
    },
    async ({ entityNamePlural, data, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getRecordService();
        const result = await service.createRecord(entityNamePlural, data);
        return {
          structuredContent: { entityNamePlural, entityId: result.entityId },
          content: [{ type: "text", text: `Created record in '${entityNamePlural}' (ID: ${result.entityId})` }],
        };
      } catch (error: any) {
        console.error("Error creating record:", error);
        return {
          structuredContent: { entityNamePlural, entityId: "" },
          content: [{ type: "text", text: `Failed to create record: ${error.message}` }],
        };
      }
    }
  );

  // Update Record
  server.registerTool(
    "update-record",
    {
      title: "Update Record",
      description: "Update a record via PATCH (partial update).",
      inputSchema: {
        entityNamePlural: z.string(),
        recordId: z.string(),
        data: z.record(z.string(), z.any()).describe("Partial record payload"),
        environment: z.string().optional(),
      },
    },
    async ({ entityNamePlural, recordId, data, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getRecordService();
        await service.updateRecord(entityNamePlural, recordId, data);
        return { content: [{ type: "text", text: `Updated record '${recordId}' in '${entityNamePlural}'` }] };
      } catch (error: any) {
        console.error("Error updating record:", error);
        return { content: [{ type: "text", text: `Failed to update record: ${error.message}` }] };
      }
    }
  );

  // Delete Record
  server.registerTool(
    "delete-record",
    {
      title: "Delete Record",
      description: "Delete a record. Irreversible.",
      inputSchema: {
        entityNamePlural: z.string(),
        recordId: z.string(),
        environment: z.string().optional(),
      },
    },
    async ({ entityNamePlural, recordId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getRecordService();
        await service.deleteRecord(entityNamePlural, recordId);
        return { content: [{ type: "text", text: `Deleted record '${recordId}' from '${entityNamePlural}'` }] };
      } catch (error: any) {
        console.error("Error deleting record:", error);
        return { content: [{ type: "text", text: `Failed to delete record: ${error.message}` }] };
      }
    }
  );

  // Associate Records
  server.registerTool(
    "associate-records",
    {
      title: "Associate Records",
      description: "Associate two records across a navigation property (N:N or 1:N).",
      inputSchema: {
        entityNamePlural: z.string().describe("Plural name of the primary entity"),
        recordId: z.string().describe("GUID of the primary record"),
        navigationProperty: z.string().describe("Navigation property name (from entity metadata)"),
        relatedEntityNamePlural: z.string().describe("Plural name of the related entity"),
        relatedRecordId: z.string().describe("GUID of the record to link"),
        environment: z.string().optional(),
      },
    },
    async ({ entityNamePlural, recordId, navigationProperty, relatedEntityNamePlural, relatedRecordId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getRecordService();
        await service.associateRecords(entityNamePlural, recordId, navigationProperty, relatedEntityNamePlural, relatedRecordId);
        return { content: [{ type: "text", text: `Associated ${entityNamePlural}(${recordId}) → ${navigationProperty} → ${relatedEntityNamePlural}(${relatedRecordId})` }] };
      } catch (error: any) {
        console.error("Error associating records:", error);
        return { content: [{ type: "text", text: `Failed to associate records: ${error.message}` }] };
      }
    }
  );

  // Disassociate Records
  server.registerTool(
    "disassociate-records",
    {
      title: "Disassociate Records",
      description: "Disassociate two records across a navigation property.",
      inputSchema: {
        entityNamePlural: z.string(),
        recordId: z.string(),
        navigationProperty: z.string(),
        relatedRecordId: z.string().optional().describe("Required for collection-valued navs (N:N), omit for single-valued (1:N)"),
        environment: z.string().optional(),
      },
    },
    async ({ entityNamePlural, recordId, navigationProperty, relatedRecordId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getRecordService();
        await service.disassociateRecords(entityNamePlural, recordId, navigationProperty, relatedRecordId);
        const target = relatedRecordId ? `(${relatedRecordId})` : '';
        return { content: [{ type: "text", text: `Disassociated ${entityNamePlural}(${recordId}) → ${navigationProperty}${target}` }] };
      } catch (error: any) {
        console.error("Error disassociating records:", error);
        return { content: [{ type: "text", text: `Failed to disassociate records: ${error.message}` }] };
      }
    }
  );
}
