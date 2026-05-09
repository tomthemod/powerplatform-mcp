import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EnvironmentRegistry } from "../environment-config.js";

/**
 * Register form & view tools (systemforms + savedqueries) with the MCP server.
 */
export function registerFormViewTools(server: McpServer, registry: EnvironmentRegistry): void {
  // ─── FORMS ──────────────────────────────────────────────────────────────────

  // Get Entity Forms
  server.registerTool(
    "get-entity-forms",
    {
      title: "Get Entity Forms",
      description: "List forms (systemforms) defined on a Dataverse entity, optionally filtered by type.",
      inputSchema: {
        entityLogicalName: z.string().describe("The entity logical name"),
        type: z.number().optional().describe("Form type filter: 2=Main, 5=QuickView, 6=QuickCreate, 7=Dashboard"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({
        entityLogicalName: z.string(),
        count: z.number(),
        forms: z.any(),
      }),
    },
    async ({ entityLogicalName, type, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const forms = await service.getEntityForms(entityLogicalName, type);
        return {
          structuredContent: { entityLogicalName, count: forms.length, forms },
          content: [{ type: "text", text: `Found ${forms.length} forms on '${entityLogicalName}':\n\n${JSON.stringify(forms, null, 2)}` }],
        };
      } catch (error: any) {
        console.error("Error getting entity forms:", error);
        return { content: [{ type: "text", text: `Failed to get entity forms: ${error.message}` }] };
      }
    }
  );

  // Get Form Fields
  server.registerTool(
    "get-form-fields",
    {
      title: "Get Form Fields",
      description: "List the fields currently rendered on a Dataverse form (parsed from formxml).",
      inputSchema: {
        formId: z.string().describe("The systemform GUID"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ formId: z.string(), count: z.number(), fields: z.array(z.string()) }),
    },
    async ({ formId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const fields = await service.getFormFields(formId);
        return {
          structuredContent: { formId, count: fields.length, fields },
          content: [{ type: "text", text: `Form ${formId} has ${fields.length} fields:\n${fields.map(f => `  ${f}`).join('\n')}` }],
        };
      } catch (error: any) {
        console.error("Error getting form fields:", error);
        return { content: [{ type: "text", text: `Failed to get form fields: ${error.message}` }] };
      }
    }
  );

  // Add Form Field
  server.registerTool(
    "add-form-field",
    {
      title: "Add Form Field",
      description: "Append a field at the end of the first section of a form. Auto-publishes the entity afterwards. No-op if the field is already on the form.",
      inputSchema: {
        entityLogicalName: z.string().describe("The entity logical name (used for publishing)"),
        formId: z.string().describe("The systemform GUID"),
        attributeName: z.string().describe("The logical name of the attribute to add"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ formId: z.string(), attributeName: z.string(), added: z.boolean() }),
    },
    async ({ entityLogicalName, formId, attributeName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.addFormField(formId, attributeName, entityLogicalName);
        return {
          structuredContent: { formId, attributeName, added: result.added },
          content: [{ type: "text", text: result.added ? `Added '${attributeName}' to form ${formId} and published '${entityLogicalName}'.` : `'${attributeName}' is already on the form — no change.` }],
        };
      } catch (error: any) {
        console.error("Error adding form field:", error);
        return { content: [{ type: "text", text: `Failed to add form field: ${error.message}` }] };
      }
    }
  );

  // Add Form Field Relative (NEW — positions a field before/after a reference field)
  server.registerTool(
    "add-form-field-relative",
    {
      title: "Add Form Field (Relative Position)",
      description: "Add a field to a form, placed BEFORE or AFTER an existing reference field. The new row is inserted next to the row containing the reference field. Auto-publishes the entity. No-op if the field is already on the form. Throws if the reference field is not on the form.",
      inputSchema: {
        entityLogicalName: z.string().describe("The entity logical name (used for publishing)"),
        formId: z.string().describe("The systemform GUID"),
        attributeName: z.string().describe("The logical name of the attribute to add"),
        relativeToField: z.string().describe("The logical name of the existing reference field on the form"),
        position: z.enum(["before", "after"]).describe("Where to place the new field relative to the reference field"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({
        formId: z.string(),
        attributeName: z.string(),
        relativeToField: z.string(),
        position: z.string(),
        added: z.boolean(),
      }),
    },
    async ({ entityLogicalName, formId, attributeName, relativeToField, position, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.addFormFieldRelative(formId, attributeName, relativeToField, position, entityLogicalName);
        return {
          structuredContent: { formId, attributeName, relativeToField, position, added: result.added },
          content: [{ type: "text", text: result.added ? `Inserted '${attributeName}' ${position} '${relativeToField}' on form ${formId} and published '${entityLogicalName}'.` : `'${attributeName}' is already on the form — no change.` }],
        };
      } catch (error: any) {
        console.error("Error adding form field (relative):", error);
        return {
          structuredContent: { formId, attributeName, relativeToField, position, added: false },
          content: [{ type: "text", text: `Failed to add form field (relative): ${error.message}` }],
        };
      }
    }
  );

  // Remove Form Field
  server.registerTool(
    "remove-form-field",
    {
      title: "Remove Form Field",
      description: "Remove a field from a Dataverse form. Removes the entire row containing its control. Auto-publishes the entity.",
      inputSchema: {
        entityLogicalName: z.string(),
        formId: z.string(),
        attributeName: z.string(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ formId: z.string(), attributeName: z.string(), removed: z.boolean() }),
    },
    async ({ entityLogicalName, formId, attributeName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.removeFormField(formId, attributeName, entityLogicalName);
        return {
          structuredContent: { formId, attributeName, removed: result.removed },
          content: [{ type: "text", text: result.removed ? `Removed '${attributeName}' from form ${formId} and published '${entityLogicalName}'.` : `'${attributeName}' was not on the form — no change.` }],
        };
      } catch (error: any) {
        console.error("Error removing form field:", error);
        return { content: [{ type: "text", text: `Failed to remove form field: ${error.message}` }] };
      }
    }
  );

  // ─── FORM LIBRARIES ─────────────────────────────────────────────────────────

  // Add Form Library
  server.registerTool(
    "add-form-library",
    {
      title: "Add Form Library",
      description: "Register a JS web resource as a library on a form, so handlers can reference it. Looks up the web resource id by name automatically. The web resource must already be deployed to Dataverse.",
      inputSchema: {
        entityLogicalName: z.string(),
        formId: z.string(),
        libraryName: z.string().describe("Web resource name (e.g. 'new_Simpliciti_Opportunity.js')"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ formId: z.string(), libraryName: z.string(), added: z.boolean() }),
    },
    async ({ entityLogicalName, formId, libraryName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.addFormLibrary(formId, libraryName, entityLogicalName);
        return {
          structuredContent: { formId, libraryName, added: result.added },
          content: [{ type: "text", text: result.added ? `Registered library '${libraryName}' on form ${formId}, published '${entityLogicalName}'.` : `Library '${libraryName}' is already registered on this form — no change.` }],
        };
      } catch (error: any) {
        console.error("Error adding form library:", error);
        return { content: [{ type: "text", text: `Failed to add form library: ${error.message}` }] };
      }
    }
  );

  // Remove Form Library
  server.registerTool(
    "remove-form-library",
    {
      title: "Remove Form Library",
      description: "Unregister a JS web resource from a form. Refuses if any event handler still references the library, unless force=true.",
      inputSchema: {
        entityLogicalName: z.string(),
        formId: z.string(),
        libraryName: z.string(),
        force: z.boolean().optional().describe("Bypass the 'still referenced by handlers' check (default: false)"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ formId: z.string(), libraryName: z.string(), removed: z.boolean() }),
    },
    async ({ entityLogicalName, formId, libraryName, force, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.removeFormLibrary(formId, libraryName, force ?? false, entityLogicalName);
        return {
          structuredContent: { formId, libraryName, removed: result.removed },
          content: [{ type: "text", text: result.removed ? `Unregistered library '${libraryName}' from form ${formId}, published '${entityLogicalName}'.` : `Library '${libraryName}' was not registered on this form — no change.` }],
        };
      } catch (error: any) {
        console.error("Error removing form library:", error);
        return { content: [{ type: "text", text: `Failed to remove form library: ${error.message}` }] };
      }
    }
  );

  // ─── FORM EVENT HANDLERS ────────────────────────────────────────────────────

  // Add Form Event Handler
  server.registerTool(
    "add-form-event-handler",
    {
      title: "Add Form Event Handler",
      description: "Attach a JS event handler to a form. eventName='onload'/'onsave' = form-level (no attributeName); 'onchange' = field-level (requires attributeName). The JS library web resource must already be registered in the form's <formLibraries>.",
      inputSchema: {
        entityLogicalName: z.string(),
        formId: z.string(),
        eventName: z.enum(["onload", "onsave", "onchange"]),
        functionName: z.string().describe("Fully-qualified JS function (e.g. 'Simpliciti.Opportunity.onLoad')"),
        libraryName: z.string().describe("Web resource name of the JS file (e.g. 'new_Simpliciti_Opportunity.js')"),
        attributeName: z.string().optional().describe("REQUIRED when eventName='onchange'; logical name of the field to bind to"),
        passExecutionContext: z.boolean().optional().describe("Default: true"),
        parameters: z.string().optional().describe("Comma-separated extra parameters (default: '')"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({
        formId: z.string(),
        eventName: z.string(),
        functionName: z.string(),
        attributeName: z.string().optional(),
        added: z.boolean(),
      }),
    },
    async ({ entityLogicalName, formId, eventName, functionName, libraryName, attributeName, passExecutionContext, parameters, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.addFormEventHandler(
          formId, eventName, functionName, libraryName, attributeName,
          passExecutionContext ?? true, parameters ?? '', entityLogicalName,
        );
        const scope = eventName === 'onchange' ? `field '${attributeName}'` : `form-level (${eventName})`;
        return {
          structuredContent: { formId, eventName, functionName, attributeName, added: result.added },
          content: [{ type: "text", text: result.added ? `Attached '${functionName}' (${libraryName}) to ${scope} on form ${formId}, published '${entityLogicalName}'.` : `Handler '${functionName}' from '${libraryName}' is already on this event — no change.` }],
        };
      } catch (error: any) {
        console.error("Error adding form event handler:", error);
        return { content: [{ type: "text", text: `Failed to add form event handler: ${error.message}` }] };
      }
    }
  );

  // Remove Form Event Handler
  server.registerTool(
    "remove-form-event-handler",
    {
      title: "Remove Form Event Handler",
      description: "Remove a JS event handler from a form, identified by its functionName (and optionally libraryName). Cleans up empty <Handlers>/<event>/<events> wrappers.",
      inputSchema: {
        entityLogicalName: z.string(),
        formId: z.string(),
        functionName: z.string(),
        libraryName: z.string().optional().describe("Optional — also match library to avoid cross-library collisions"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ formId: z.string(), functionName: z.string(), removed: z.boolean() }),
    },
    async ({ entityLogicalName, formId, functionName, libraryName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.removeFormEventHandler(formId, functionName, libraryName, entityLogicalName);
        return {
          structuredContent: { formId, functionName, removed: result.removed },
          content: [{ type: "text", text: result.removed ? `Removed handler '${functionName}' from form ${formId}, published '${entityLogicalName}'.` : `Handler '${functionName}' was not on this form — no change.` }],
        };
      } catch (error: any) {
        console.error("Error removing form event handler:", error);
        return { content: [{ type: "text", text: `Failed to remove form event handler: ${error.message}` }] };
      }
    }
  );

  // ─── FORM PCF CONTROLS ──────────────────────────────────────────────────────

  // Add Form PCF Control
  server.registerTool(
    "add-form-pcf-control",
    {
      title: "Add Form PCF Custom Control",
      description: "Attach a PCF custom control to a field on a form. The PCF must already be deployed to Dataverse.",
      inputSchema: {
        entityLogicalName: z.string(),
        formId: z.string(),
        attributeName: z.string().describe("Logical name of the field to host the PCF"),
        pcfControlName: z.string().describe("Fully-qualified PCF name (e.g. 'Simpliciti.MyPcf')"),
        formFactors: z.number().optional().describe("Bitmask: 1=Phone, 2=Tablet, 3=Both, 4=Web, 7=All (default 3)"),
        customParameters: z.string().optional().describe("Optional raw XML for the inner <Parameters> block. If omitted, a minimal binding to the field is generated."),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ formId: z.string(), attributeName: z.string(), pcfControlName: z.string(), added: z.boolean() }),
    },
    async ({ entityLogicalName, formId, attributeName, pcfControlName, formFactors, customParameters, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.addFormPcfControl(formId, attributeName, pcfControlName, formFactors ?? 3, customParameters, entityLogicalName);
        return {
          structuredContent: { formId, attributeName, pcfControlName, added: result.added },
          content: [{ type: "text", text: result.added ? `Attached PCF '${pcfControlName}' to field '${attributeName}' on form ${formId}, published '${entityLogicalName}'.` : `Could not attach PCF — see error.` }],
        };
      } catch (error: any) {
        console.error("Error adding form PCF control:", error);
        return { content: [{ type: "text", text: `Failed to add form PCF control: ${error.message}` }] };
      }
    }
  );

  // Remove Form PCF Control
  server.registerTool(
    "remove-form-pcf-control",
    {
      title: "Remove Form PCF Custom Control",
      description: "Detach the PCF custom control from a field — restores the standard control on that field.",
      inputSchema: {
        entityLogicalName: z.string(),
        formId: z.string(),
        attributeName: z.string(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ formId: z.string(), attributeName: z.string(), removed: z.boolean() }),
    },
    async ({ entityLogicalName, formId, attributeName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.removeFormPcfControl(formId, attributeName, entityLogicalName);
        return {
          structuredContent: { formId, attributeName, removed: result.removed },
          content: [{ type: "text", text: result.removed ? `Removed PCF from field '${attributeName}' on form ${formId}, published '${entityLogicalName}'.` : `No PCF was attached to '${attributeName}' on this form — no change.` }],
        };
      } catch (error: any) {
        console.error("Error removing form PCF control:", error);
        return { content: [{ type: "text", text: `Failed to remove form PCF control: ${error.message}` }] };
      }
    }
  );

  // ─── VIEWS ──────────────────────────────────────────────────────────────────

  // Get Entity Views
  server.registerTool(
    "get-entity-views",
    {
      title: "Get Entity Views",
      description: "List views (savedqueries) defined on a Dataverse entity.",
      inputSchema: {
        entityLogicalName: z.string(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ entityLogicalName: z.string(), count: z.number(), views: z.any() }),
    },
    async ({ entityLogicalName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const views = await service.getEntityViews(entityLogicalName);
        return {
          structuredContent: { entityLogicalName, count: views.length, views },
          content: [{ type: "text", text: `Found ${views.length} views on '${entityLogicalName}':\n\n${JSON.stringify(views, null, 2)}` }],
        };
      } catch (error: any) {
        console.error("Error getting entity views:", error);
        return { content: [{ type: "text", text: `Failed to get entity views: ${error.message}` }] };
      }
    }
  );

  // Get View Columns
  server.registerTool(
    "get-view-columns",
    {
      title: "Get View Columns",
      description: "List the columns currently shown in a Dataverse view (parsed from layoutxml).",
      inputSchema: {
        viewId: z.string().describe("The savedquery GUID"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ viewId: z.string(), count: z.number(), columns: z.array(z.string()) }),
    },
    async ({ viewId, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const columns = await service.getViewColumns(viewId);
        return {
          structuredContent: { viewId, count: columns.length, columns },
          content: [{ type: "text", text: `View ${viewId} has ${columns.length} columns:\n${columns.map(c => `  ${c}`).join('\n')}` }],
        };
      } catch (error: any) {
        console.error("Error getting view columns:", error);
        return { content: [{ type: "text", text: `Failed to get view columns: ${error.message}` }] };
      }
    }
  );

  // Add View Column
  server.registerTool(
    "add-view-column",
    {
      title: "Add View Column",
      description: "Add a column to a Dataverse view (updates both layoutxml and fetchxml). Auto-publishes.",
      inputSchema: {
        entityLogicalName: z.string(),
        viewId: z.string(),
        attributeName: z.string(),
        width: z.number().optional().describe("Column width in pixels (default: 150)"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ viewId: z.string(), attributeName: z.string(), added: z.boolean() }),
    },
    async ({ entityLogicalName, viewId, attributeName, width, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.addViewColumn(viewId, attributeName, entityLogicalName, width ?? 150);
        return {
          structuredContent: { viewId, attributeName, added: result.added },
          content: [{ type: "text", text: result.added ? `Added '${attributeName}' (width ${width ?? 150}) to view ${viewId}, published '${entityLogicalName}'.` : `'${attributeName}' is already in the view — no change.` }],
        };
      } catch (error: any) {
        console.error("Error adding view column:", error);
        return { content: [{ type: "text", text: `Failed to add view column: ${error.message}` }] };
      }
    }
  );

  // Add View Column Relative
  server.registerTool(
    "add-view-column-relative",
    {
      title: "Add View Column (Relative Position)",
      description: "Add a column to a Dataverse view, placed BEFORE or AFTER an existing reference column. Auto-publishes. Throws if the reference column is not in the view.",
      inputSchema: {
        entityLogicalName: z.string(),
        viewId: z.string(),
        attributeName: z.string(),
        relativeToField: z.string(),
        position: z.enum(["before", "after"]),
        width: z.number().optional().describe("Column width in pixels (default: 150)"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({
        viewId: z.string(),
        attributeName: z.string(),
        relativeToField: z.string(),
        position: z.string(),
        added: z.boolean(),
      }),
    },
    async ({ entityLogicalName, viewId, attributeName, relativeToField, position, width, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.addViewColumnRelative(viewId, attributeName, relativeToField, position, width ?? 150, entityLogicalName);
        return {
          structuredContent: { viewId, attributeName, relativeToField, position, added: result.added },
          content: [{ type: "text", text: result.added ? `Inserted '${attributeName}' ${position} '${relativeToField}' on view ${viewId}, published '${entityLogicalName}'.` : `'${attributeName}' is already in the view — no change.` }],
        };
      } catch (error: any) {
        console.error("Error adding view column (relative):", error);
        return { content: [{ type: "text", text: `Failed to add view column (relative): ${error.message}` }] };
      }
    }
  );

  // Remove View Column
  server.registerTool(
    "remove-view-column",
    {
      title: "Remove View Column",
      description: "Remove a column from a Dataverse view. Refuses to remove the last column. Auto-publishes.",
      inputSchema: {
        entityLogicalName: z.string(),
        viewId: z.string(),
        attributeName: z.string(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ viewId: z.string(), attributeName: z.string(), removed: z.boolean() }),
    },
    async ({ entityLogicalName, viewId, attributeName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.removeViewColumn(viewId, attributeName, entityLogicalName);
        return {
          structuredContent: { viewId, attributeName, removed: result.removed },
          content: [{ type: "text", text: result.removed ? `Removed '${attributeName}' from view ${viewId}, published '${entityLogicalName}'.` : `'${attributeName}' was not in the view — no change.` }],
        };
      } catch (error: any) {
        console.error("Error removing view column:", error);
        return { content: [{ type: "text", text: `Failed to remove view column: ${error.message}` }] };
      }
    }
  );

  // Set View Columns (replace entire column set)
  server.registerTool(
    "set-view-columns",
    {
      title: "Set View Columns",
      description: "Replace the entire column set of a Dataverse view (preserves filters and link-entities).",
      inputSchema: {
        entityLogicalName: z.string(),
        viewId: z.string(),
        columns: z.array(z.object({ name: z.string(), width: z.number().optional() })).describe("Columns in display order"),
        orderBy: z.string().optional().describe("Attribute to sort by (default: first column)"),
        orderDescending: z.boolean().optional().describe("Sort descending (default: false)"),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ viewId: z.string(), columns: z.array(z.string()) }),
    },
    async ({ entityLogicalName, viewId, columns, orderBy, orderDescending, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getFormViewService();
        const result = await service.setViewColumns(viewId, columns, entityLogicalName, orderBy, orderDescending ?? false);
        return {
          structuredContent: { viewId, columns: result.columns },
          content: [{ type: "text", text: `Set ${result.columns.length} columns on view ${viewId} and published '${entityLogicalName}':\n${result.columns.map(c => `  ${c}`).join('\n')}` }],
        };
      } catch (error: any) {
        console.error("Error setting view columns:", error);
        return { content: [{ type: "text", text: `Failed to set view columns: ${error.message}` }] };
      }
    }
  );
}
