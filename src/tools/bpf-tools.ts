import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EnvironmentRegistry } from "../environment-config.js";

/**
 * Register Business Process Flow (BPF) tools with the MCP server.
 *
 * Wave 1 — read only. Subsequent waves add stage/step editing.
 */
export function registerBpfTools(server: McpServer, registry: EnvironmentRegistry): void {
  server.registerTool(
    "get-bpf",
    {
      title: "Get Business Process Flow",
      description:
        "Get a Business Process Flow definition with parsed clientdata (stages, steps, branches). " +
        "Set includeRaw=true to also retrieve the original clientdata JSON and xaml.",
      inputSchema: {
        workflowId: z.string().describe("BPF workflow ID (GUID)"),
        includeRaw: z
          .boolean()
          .optional()
          .describe("Include raw clientdata + xaml strings (default: false)"),
        environment: z
          .string()
          .optional()
          .describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
    },
    async ({ workflowId, includeRaw, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getBpfService();
        const result = await service.getBpf(workflowId, includeRaw ?? false);

        const stageCount = result.summary?.stages.length ?? 0;
        const branchNote = result.summary?.hasBranches ? " (with branches)" : "";

        return {
          structuredContent: result as unknown as Record<string, unknown>,
          content: [
            {
              type: "text",
              text:
                `BPF '${result.name}' — ${result.state}, ${stageCount} stage(s)${branchNote}:\n\n` +
                JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting BPF:", error);
        return {
          content: [{ type: "text", text: `Failed to get BPF: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
