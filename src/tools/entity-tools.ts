import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EnvironmentRegistry } from "../environment-config.js";

/**
 * Register entity metadata tools with the MCP server.
 */
export function registerEntityTools(server: McpServer, registry: EnvironmentRegistry): void {
  // Get Entity Metadata
  server.registerTool(
    "get-entity-metadata",
    {
      title: "Get Entity Metadata",
      description: "Get metadata about a PowerPlatform entity",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entityName: z.string(),
        metadata: z.any(),
      }),
    },
    async ({ entityName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const metadata = await service.getEntityMetadata(entityName);

        return {
          structuredContent: { entityName, metadata },
          content: [
            {
              type: "text",
              text: `Entity metadata for '${entityName}':\n\n${JSON.stringify(metadata, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting entity metadata:", error);
        return {
          structuredContent: { entityName, metadata: null },
          content: [
            {
              type: "text",
              text: `Failed to get entity metadata: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Entity Attributes
  server.registerTool(
    "get-entity-attributes",
    {
      title: "Get Entity Attributes",
      description: "Get attributes/fields of a PowerPlatform entity",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entityName: z.string(),
        attributes: z.any(),
      }),
    },
    async ({ entityName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const attributes = await service.getEntityAttributes(entityName);

        return {
          structuredContent: { entityName, attributes },
          content: [
            {
              type: "text",
              text: `Attributes for entity '${entityName}':\n\n${JSON.stringify(attributes, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting entity attributes:", error);
        return {
          structuredContent: { entityName, attributes: [] },
          content: [
            {
              type: "text",
              text: `Failed to get entity attributes: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Attribute Options
  server.registerTool(
    "get-attribute-options",
    {
      title: "Get Attribute Options",
      description: "Get the options (value + localized label) of a choice attribute (Picklist / MultiSelect / State / Status / Boolean). Returns FR (1036) labels by default. Use this instead of get-entity-attribute (which omits the OptionSet) or the stringmaps workaround.",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        attributeName: z.string().describe("The logical name of the choice attribute"),
        languageCode: z.number().optional().describe("Locale for labels (default 1036 — French)"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entityName: z.string(),
        attributeName: z.string(),
        attributeType: z.string(),
        isGlobal: z.boolean(),
        optionSetName: z.string().nullable(),
        options: z.any(),
      }),
    },
    async ({ entityName, attributeName, languageCode, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.getAttributeOptions(entityName, attributeName, languageCode ?? 1036);
        return {
          structuredContent: { entityName, attributeName, ...result },
          content: [
            {
              type: "text",
              text: `Options for '${entityName}.${attributeName}' (${result.attributeType}${result.isGlobal ? `, global: ${result.optionSetName}` : ', local'}):\n\n${result.options.map((o: any) => `  ${o.value} = ${o.label}`).join('\n')}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting attribute options:", error);
        return {
          structuredContent: { entityName, attributeName, attributeType: "", isGlobal: false, optionSetName: null, options: [] },
          content: [{ type: "text", text: `Failed to get attribute options: ${error.message}` }],
        };
      }
    }
  );

  // Get Entity Attribute
  server.registerTool(
    "get-entity-attribute",
    {
      title: "Get Entity Attribute",
      description: "Get a specific attribute/field of a PowerPlatform entity",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        attributeName: z.string().describe("The logical name of the attribute"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entityName: z.string(),
        attributeName: z.string(),
        attribute: z.any(),
      }),
    },
    async ({ entityName, attributeName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const attribute = await service.getEntityAttribute(entityName, attributeName);

        return {
          structuredContent: { entityName, attributeName, attribute },
          content: [
            {
              type: "text",
              text: `Attribute '${attributeName}' for entity '${entityName}':\n\n${JSON.stringify(attribute, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting entity attribute:", error);
        return {
          structuredContent: { entityName, attributeName, attribute: null },
          content: [
            {
              type: "text",
              text: `Failed to get entity attribute: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Create Entity String Attribute
  server.registerTool(
    "create-entity-string-attribute",
    {
      title: "Create Entity String Attribute",
      description: "Create a new Single Line of Text attribute/column on a Dataverse entity",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        schemaName: z.string().describe("The schema name for the new attribute (e.g. br_hospitableid)"),
        displayName: z.string().describe("The display name for the attribute"),
        maxLength: z.number().optional().describe("Maximum text length (default: 100)"),
        requiredLevel: z.enum(["None", "ApplicationRequired", "SystemRequired"]).optional().describe("Required level (default: None)"),
        description: z.string().optional().describe("Description for the attribute"),
        solutionName: z.string().optional().describe("Solution unique name to add the component to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entityName: z.string(),
        schemaName: z.string(),
        attributeId: z.string(),
      }),
    },
    async ({ entityName, schemaName, displayName, maxLength, requiredLevel, description, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createStringAttribute(
          entityName, schemaName, displayName,
          maxLength ?? 100, requiredLevel ?? 'None', description,
          undefined, solutionName,
        );

        return {
          structuredContent: { entityName, schemaName, attributeId: result.attributeId },
          content: [
            {
              type: "text",
              text: `Created string attribute '${schemaName}' on entity '${entityName}' (ID: ${result.attributeId})`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error creating entity attribute:", error);
        return {
          structuredContent: { entityName, schemaName, attributeId: "" },
          content: [
            {
              type: "text",
              text: `Failed to create entity attribute: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get Entity Keys
  server.registerTool(
    "get-entity-keys",
    {
      title: "Get Entity Keys",
      description: "Get alternate keys defined on a Dataverse entity",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entityName: z.string(),
        keys: z.any(),
      }),
    },
    async ({ entityName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.getEntityKeys(entityName);

        return {
          structuredContent: { entityName, keys: result.value },
          content: [
            {
              type: "text",
              text: `Found ${result.value.length} alternate keys on entity '${entityName}':\n\n${JSON.stringify(result.value, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting entity keys:", error);
        return {
          structuredContent: { entityName, keys: [] },
          content: [
            {
              type: "text",
              text: `Failed to get entity keys: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Create Entity Alternate Key
  server.registerTool(
    "create-entity-alternate-key",
    {
      title: "Create Entity Alternate Key",
      description: "Create an alternate key on a Dataverse entity",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        schemaName: z.string().describe("The schema name for the key"),
        displayName: z.string().describe("The display name for the key"),
        keyAttributes: z.array(z.string()).describe("Array of attribute logical names that make up the key"),
        solutionName: z.string().optional().describe("Solution unique name to add the component to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entityName: z.string(),
        schemaName: z.string(),
        keyId: z.string(),
      }),
    },
    async ({ entityName, schemaName, displayName, keyAttributes, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createAlternateKey(entityName, schemaName, displayName, keyAttributes, undefined, solutionName);

        return {
          structuredContent: { entityName, schemaName, keyId: result.keyId },
          content: [
            {
              type: "text",
              text: `Created alternate key '${schemaName}' on entity '${entityName}' with attributes [${keyAttributes.join(', ')}] (ID: ${result.keyId})`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error creating alternate key:", error);
        return {
          structuredContent: { entityName, schemaName, keyId: "" },
          content: [
            {
              type: "text",
              text: `Failed to create alternate key: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Create Entity (Table)
  server.registerTool(
    "create-entity",
    {
      title: "Create Entity (Table)",
      description: "Create a new custom Dataverse table with a primary name attribute. Add additional columns afterwards via the create-entity-* tools.",
      inputSchema: {
        schemaName: z.string().describe("Schema name (must start with publisher prefix, e.g. 'new_FinancialLine')"),
        displayName: z.string().describe("Singular display name (e.g. 'Financial Line')"),
        displayCollectionName: z.string().describe("Plural display name (e.g. 'Financial Lines')"),
        primaryNameSchemaName: z.string().describe("Schema name for the primary name attribute (e.g. 'new_Name')"),
        primaryNameDisplayName: z.string().describe("Display name for the primary name attribute (e.g. 'Name')"),
        description: z.string().optional().describe("Optional description for the entity"),
        ownershipType: z.enum(["UserOwned", "OrganizationOwned"]).optional().describe("Ownership type (default: UserOwned)"),
        hasActivities: z.boolean().optional().describe("Track activities (default: false)"),
        hasNotes: z.boolean().optional().describe("Support notes (default: false)"),
        languageCode: z.number().optional().describe("Language code for labels (default: 1045)"),
        solutionName: z.string().optional().describe("Solution unique name to add the entity to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        schemaName: z.string(),
        entityId: z.string(),
      }),
    },
    async ({ schemaName, displayName, displayCollectionName, primaryNameSchemaName, primaryNameDisplayName, description, ownershipType, hasActivities, hasNotes, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createEntity(
          schemaName, displayName, displayCollectionName,
          primaryNameSchemaName, primaryNameDisplayName,
          description, ownershipType ?? 'UserOwned',
          hasActivities ?? false, hasNotes ?? false,
          languageCode ?? 1045, solutionName,
        );
        return {
          structuredContent: { schemaName, entityId: result.entityId },
          content: [{ type: "text", text: `Created entity '${schemaName}' (ID: ${result.entityId})` }],
        };
      } catch (error: any) {
        console.error("Error creating entity:", error);
        return {
          structuredContent: { schemaName, entityId: "" },
          content: [{ type: "text", text: `Failed to create entity: ${error.message}` }],
        };
      }
    }
  );

  // Set Entity Icon Vector
  server.registerTool(
    "set-entity-icon-vector",
    {
      title: "Set Entity Icon Vector",
      description: "Set the SVG vector icon used in the unified-interface app navigation. The web resource must already exist (type 11=Vector).",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        iconVectorName: z.string().describe("Web resource name (e.g. 'new_property_icon.svg')"),
        solutionName: z.string().optional().describe("Solution unique name to scope the change to. Dynamics derives it from the display name by removing spaces, dashes, special characters, and accented letters (e.g. '20260501 - Service Commercial évolutions #1' → '20260501ServiceCommercialvolutions1')"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
    },
    async ({ entityName, iconVectorName, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        await service.setEntityIconVector(entityName, iconVectorName, solutionName);
        return { content: [{ type: "text", text: `Set icon vector '${iconVectorName}' on entity '${entityName}'` }] };
      } catch (error: any) {
        console.error("Error setting entity icon vector:", error);
        return { content: [{ type: "text", text: `Failed to set entity icon vector: ${error.message}` }] };
      }
    }
  );

  // Create Picklist Attribute (local options OR link to global option set)
  server.registerTool(
    "create-entity-picklist-attribute",
    {
      title: "Create Entity Picklist (Choice) Attribute",
      description: "Create a Choice / Option Set attribute on a Dataverse entity. Either pass `options` for a LOCAL picklist, or `globalOptionSetName` to link to an existing GLOBAL option set. Mutually exclusive.",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        schemaName: z.string().describe("Schema name for the new attribute"),
        displayName: z.string().describe("Display name"),
        options: z.array(z.object({ value: z.number(), label: z.string() })).optional().describe("List of options for a LOCAL picklist. Omit when linking to a global."),
        globalOptionSetName: z.string().optional().describe("Logical name of an existing global option set to link to. Mutually exclusive with `options`."),
        requiredLevel: z.enum(["None", "ApplicationRequired", "SystemRequired"]).optional().describe("Required level (default: None)"),
        description: z.string().optional(),
        languageCode: z.number().optional().describe("Language code for labels (default: 1045)"),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({
        entityName: z.string(),
        schemaName: z.string(),
        attributeId: z.string(),
      }),
    },
    async ({ entityName, schemaName, displayName, options, globalOptionSetName, requiredLevel, description, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createPicklistAttribute(
          entityName, schemaName, displayName, options,
          requiredLevel ?? 'None', description,
          languageCode ?? 1045, solutionName, globalOptionSetName,
        );
        const detail = globalOptionSetName ? `linked to global '${globalOptionSetName}'` : `with ${options?.length ?? 0} local options`;
        return {
          structuredContent: { entityName, schemaName, attributeId: result.attributeId },
          content: [{ type: "text", text: `Created picklist attribute '${schemaName}' on entity '${entityName}' ${detail} (ID: ${result.attributeId})` }],
        };
      } catch (error: any) {
        console.error("Error creating picklist attribute:", error);
        return {
          structuredContent: { entityName, schemaName, attributeId: "" },
          content: [{ type: "text", text: `Failed to create picklist attribute: ${error.message}` }],
        };
      }
    }
  );

  // Create Many-to-Many Relationship
  server.registerTool(
    "create-entity-many-to-many-relationship",
    {
      title: "Create Entity Many-to-Many Relationship",
      description: "Create an N:N relationship between two Dataverse entities. Dataverse auto-creates the intersect entity (or reuses an existing one).",
      inputSchema: {
        entity1LogicalName: z.string().describe("First entity logical name (e.g. 'contact')"),
        entity2LogicalName: z.string().describe("Second entity logical name (e.g. 'new_property')"),
        relationshipSchemaName: z.string().describe("Schema name of the N:N relationship (e.g. 'new_contact_property')"),
        intersectEntitySchemaName: z.string().optional().describe("Schema name of the intersect entity (default: same as relationshipSchemaName)"),
        entity1NavLabel: z.string().optional().describe("Display label of the related-entity menu shown on entity1 (default: collection name of entity2)"),
        entity2NavLabel: z.string().optional().describe("Display label of the related-entity menu shown on entity2 (default: collection name of entity1)"),
        languageCode: z.number().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ relationshipSchemaName: z.string(), relationshipId: z.string() }),
    },
    async ({ entity1LogicalName, entity2LogicalName, relationshipSchemaName, intersectEntitySchemaName, entity1NavLabel, entity2NavLabel, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createManyToManyRelationship(
          entity1LogicalName, entity2LogicalName, relationshipSchemaName,
          intersectEntitySchemaName, entity1NavLabel, entity2NavLabel,
          languageCode ?? 1045, solutionName,
        );
        return {
          structuredContent: { relationshipSchemaName, relationshipId: result.relationshipId },
          content: [{ type: "text", text: `Created N:N relationship '${relationshipSchemaName}' between '${entity1LogicalName}' and '${entity2LogicalName}' (ID: ${result.relationshipId})` }],
        };
      } catch (error: any) {
        console.error("Error creating N:N relationship:", error);
        return {
          structuredContent: { relationshipSchemaName, relationshipId: "" },
          content: [{ type: "text", text: `Failed to create N:N relationship: ${error.message}` }],
        };
      }
    }
  );

  // Delete Entity Attribute
  server.registerTool(
    "delete-entity-attribute",
    {
      title: "Delete Entity Attribute",
      description: "Delete an attribute from an entity. IRREVERSIBLE — the column and all data in it are dropped. Fails if any component still depends on it.",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        attributeName: z.string().describe("The logical name of the attribute to delete"),
        environment: z.string().optional(),
      },
    },
    async ({ entityName, attributeName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        await service.deleteEntityAttribute(entityName, attributeName);
        return { content: [{ type: "text", text: `Deleted attribute '${attributeName}' from entity '${entityName}'` }] };
      } catch (error: any) {
        console.error("Error deleting entity attribute:", error);
        return { content: [{ type: "text", text: `Failed to delete entity attribute: ${error.message}` }] };
      }
    }
  );

  // Create Money Attribute
  server.registerTool(
    "create-entity-money-attribute",
    {
      title: "Create Entity Money (Currency) Attribute",
      description: "Create a Money/Currency attribute on a Dataverse entity. The first Money column adds a transactioncurrencyid lookup if missing.",
      inputSchema: {
        entityName: z.string(),
        schemaName: z.string(),
        displayName: z.string(),
        precisionSource: z.enum(["0", "1", "2"]).optional().describe("0=SimpleFixed (uses precision), 1=Pricing, 2=Currency (default 2)"),
        precision: z.number().optional().describe("Display precision when precisionSource=0 (default 2)"),
        minValue: z.number().optional(),
        maxValue: z.number().optional(),
        requiredLevel: z.enum(["None", "ApplicationRequired", "SystemRequired"]).optional(),
        description: z.string().optional(),
        languageCode: z.number().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ entityName: z.string(), schemaName: z.string(), attributeId: z.string() }),
    },
    async ({ entityName, schemaName, displayName, precisionSource, precision, minValue, maxValue, requiredLevel, description, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const ps = precisionSource ? (parseInt(precisionSource, 10) as 0 | 1 | 2) : 2;
        const result = await service.createMoneyAttribute(
          entityName, schemaName, displayName,
          ps, precision ?? 2,
          minValue ?? -100_000_000_000, maxValue ?? 100_000_000_000,
          requiredLevel ?? 'None', description,
          languageCode ?? 1045, solutionName,
        );
        return {
          structuredContent: { entityName, schemaName, attributeId: result.attributeId },
          content: [{ type: "text", text: `Created money attribute '${schemaName}' on entity '${entityName}' (ID: ${result.attributeId})` }],
        };
      } catch (error: any) {
        console.error("Error creating money attribute:", error);
        return {
          structuredContent: { entityName, schemaName, attributeId: "" },
          content: [{ type: "text", text: `Failed to create money attribute: ${error.message}` }],
        };
      }
    }
  );

  // Create Decimal Attribute
  server.registerTool(
    "create-entity-decimal-attribute",
    {
      title: "Create Entity Decimal Attribute",
      description: "Create a Decimal Number attribute on a Dataverse entity (no currency lookup needed, unlike Money).",
      inputSchema: {
        entityName: z.string(),
        schemaName: z.string(),
        displayName: z.string(),
        precision: z.number().optional().describe("Digits after decimal (default 2, max 10)"),
        minValue: z.number().optional(),
        maxValue: z.number().optional(),
        requiredLevel: z.enum(["None", "ApplicationRequired", "SystemRequired"]).optional(),
        description: z.string().optional(),
        languageCode: z.number().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ entityName: z.string(), schemaName: z.string(), attributeId: z.string() }),
    },
    async ({ entityName, schemaName, displayName, precision, minValue, maxValue, requiredLevel, description, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createDecimalAttribute(
          entityName, schemaName, displayName,
          precision ?? 2,
          minValue ?? -100_000_000_000, maxValue ?? 100_000_000_000,
          requiredLevel ?? 'None', description,
          languageCode ?? 1045, solutionName,
        );
        return {
          structuredContent: { entityName, schemaName, attributeId: result.attributeId },
          content: [{ type: "text", text: `Created decimal attribute '${schemaName}' on entity '${entityName}' (ID: ${result.attributeId})` }],
        };
      } catch (error: any) {
        console.error("Error creating decimal attribute:", error);
        return {
          structuredContent: { entityName, schemaName, attributeId: "" },
          content: [{ type: "text", text: `Failed to create decimal attribute: ${error.message}` }],
        };
      }
    }
  );

  // Create DateTime Attribute
  server.registerTool(
    "create-entity-datetime-attribute",
    {
      title: "Create Entity DateTime Attribute",
      description: "Create a DateTime attribute on a Dataverse entity.",
      inputSchema: {
        entityName: z.string(),
        schemaName: z.string(),
        displayName: z.string(),
        format: z.enum(["DateOnly", "DateAndTime"]).optional().describe("Default: DateOnly"),
        behavior: z.enum(["UserLocal", "DateOnly", "TimeZoneIndependent"]).optional().describe("Default: UserLocal"),
        requiredLevel: z.enum(["None", "ApplicationRequired", "SystemRequired"]).optional(),
        description: z.string().optional(),
        languageCode: z.number().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ entityName: z.string(), schemaName: z.string(), attributeId: z.string() }),
    },
    async ({ entityName, schemaName, displayName, format, behavior, requiredLevel, description, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createDateTimeAttribute(
          entityName, schemaName, displayName,
          format ?? 'DateOnly', behavior ?? 'UserLocal',
          requiredLevel ?? 'None', description,
          languageCode ?? 1045, solutionName,
        );
        return {
          structuredContent: { entityName, schemaName, attributeId: result.attributeId },
          content: [{ type: "text", text: `Created datetime attribute '${schemaName}' on entity '${entityName}' (ID: ${result.attributeId})` }],
        };
      } catch (error: any) {
        console.error("Error creating datetime attribute:", error);
        return {
          structuredContent: { entityName, schemaName, attributeId: "" },
          content: [{ type: "text", text: `Failed to create datetime attribute: ${error.message}` }],
        };
      }
    }
  );

  // Create Integer Attribute
  server.registerTool(
    "create-entity-integer-attribute",
    {
      title: "Create Entity Integer (Whole Number) Attribute",
      description: "Create an Integer attribute on a Dataverse entity.",
      inputSchema: {
        entityName: z.string(),
        schemaName: z.string(),
        displayName: z.string(),
        minValue: z.number().optional().describe("Default: -2147483648"),
        maxValue: z.number().optional().describe("Default: 2147483647"),
        requiredLevel: z.enum(["None", "ApplicationRequired", "SystemRequired"]).optional(),
        description: z.string().optional(),
        languageCode: z.number().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ entityName: z.string(), schemaName: z.string(), attributeId: z.string() }),
    },
    async ({ entityName, schemaName, displayName, minValue, maxValue, requiredLevel, description, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createIntegerAttribute(
          entityName, schemaName, displayName,
          minValue ?? -2147483648, maxValue ?? 2147483647,
          requiredLevel ?? 'None', description,
          languageCode ?? 1045, solutionName,
        );
        return {
          structuredContent: { entityName, schemaName, attributeId: result.attributeId },
          content: [{ type: "text", text: `Created integer attribute '${schemaName}' on entity '${entityName}' (ID: ${result.attributeId})` }],
        };
      } catch (error: any) {
        console.error("Error creating integer attribute:", error);
        return {
          structuredContent: { entityName, schemaName, attributeId: "" },
          content: [{ type: "text", text: `Failed to create integer attribute: ${error.message}` }],
        };
      }
    }
  );

  // Create Boolean Attribute
  server.registerTool(
    "create-entity-boolean-attribute",
    {
      title: "Create Entity Boolean (Yes/No) Attribute",
      description: "Create a Two-Option (boolean) attribute on a Dataverse entity.",
      inputSchema: {
        entityName: z.string(),
        schemaName: z.string(),
        displayName: z.string(),
        trueLabel: z.string().optional().describe("Label for the true option (default: 'Yes')"),
        falseLabel: z.string().optional().describe("Label for the false option (default: 'No')"),
        defaultValue: z.boolean().optional().describe("Default: false"),
        requiredLevel: z.enum(["None", "ApplicationRequired", "SystemRequired"]).optional(),
        description: z.string().optional(),
        languageCode: z.number().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ entityName: z.string(), schemaName: z.string(), attributeId: z.string() }),
    },
    async ({ entityName, schemaName, displayName, trueLabel, falseLabel, defaultValue, requiredLevel, description, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createBooleanAttribute(
          entityName, schemaName, displayName,
          trueLabel ?? 'Yes', falseLabel ?? 'No', defaultValue ?? false,
          requiredLevel ?? 'None', description,
          languageCode ?? 1045, solutionName,
        );
        return {
          structuredContent: { entityName, schemaName, attributeId: result.attributeId },
          content: [{ type: "text", text: `Created boolean attribute '${schemaName}' on entity '${entityName}' (ID: ${result.attributeId})` }],
        };
      } catch (error: any) {
        console.error("Error creating boolean attribute:", error);
        return {
          structuredContent: { entityName, schemaName, attributeId: "" },
          content: [{ type: "text", text: `Failed to create boolean attribute: ${error.message}` }],
        };
      }
    }
  );

  // Create Memo Attribute
  server.registerTool(
    "create-entity-memo-attribute",
    {
      title: "Create Entity Memo (Multiline Text) Attribute",
      description: "Create a Memo (multi-line text) attribute on a Dataverse entity.",
      inputSchema: {
        entityName: z.string(),
        schemaName: z.string(),
        displayName: z.string(),
        maxLength: z.number().optional().describe("Default: 2000"),
        requiredLevel: z.enum(["None", "ApplicationRequired", "SystemRequired"]).optional(),
        description: z.string().optional(),
        languageCode: z.number().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ entityName: z.string(), schemaName: z.string(), attributeId: z.string() }),
    },
    async ({ entityName, schemaName, displayName, maxLength, requiredLevel, description, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createMemoAttribute(
          entityName, schemaName, displayName,
          maxLength ?? 2000, requiredLevel ?? 'None', description,
          languageCode ?? 1045, solutionName,
        );
        return {
          structuredContent: { entityName, schemaName, attributeId: result.attributeId },
          content: [{ type: "text", text: `Created memo attribute '${schemaName}' on entity '${entityName}' (ID: ${result.attributeId})` }],
        };
      } catch (error: any) {
        console.error("Error creating memo attribute:", error);
        return {
          structuredContent: { entityName, schemaName, attributeId: "" },
          content: [{ type: "text", text: `Failed to create memo attribute: ${error.message}` }],
        };
      }
    }
  );

  // Create Lookup Attribute
  server.registerTool(
    "create-entity-lookup-attribute",
    {
      title: "Create Entity Lookup (N:1) Attribute",
      description: "Create a lookup column on a Dataverse entity. Wraps CreateOneToManyRelationship — creates both the relationship AND the lookup column.",
      inputSchema: {
        referencingEntity: z.string().describe("Child entity that holds the new lookup column (e.g. 'new_reservation')"),
        referencedEntity: z.string().describe("Parent entity the lookup points to (e.g. 'contact')"),
        relationshipSchemaName: z.string().describe("Schema name for the 1:N relationship (e.g. 'new_reservation_contact')"),
        lookupSchemaName: z.string().describe("Schema name for the lookup column (e.g. 'new_ContactId')"),
        displayName: z.string().describe("Display name of the lookup column"),
        requiredLevel: z.enum(["None", "ApplicationRequired", "SystemRequired"]).optional(),
        description: z.string().optional(),
        cascadeDelete: z.enum(["NoCascade", "RemoveLink", "Restrict", "Cascade"]).optional().describe("Default: RemoveLink"),
        languageCode: z.number().optional(),
        solutionName: z.string().optional(),
        environment: z.string().optional(),
      },
      outputSchema: z.object({ referencingEntity: z.string(), lookupSchemaName: z.string(), attributeId: z.string() }),
    },
    async ({ referencingEntity, referencedEntity, relationshipSchemaName, lookupSchemaName, displayName, requiredLevel, description, cascadeDelete, languageCode, solutionName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const result = await service.createLookupAttribute(
          referencingEntity, referencedEntity, relationshipSchemaName, lookupSchemaName, displayName,
          requiredLevel ?? 'None', description, cascadeDelete ?? 'RemoveLink',
          languageCode ?? 1045, solutionName,
        );
        return {
          structuredContent: { referencingEntity, lookupSchemaName, attributeId: result.attributeId },
          content: [{ type: "text", text: `Created lookup '${lookupSchemaName}' on entity '${referencingEntity}' → '${referencedEntity}' (ID: ${result.attributeId})` }],
        };
      } catch (error: any) {
        console.error("Error creating lookup attribute:", error);
        return {
          structuredContent: { referencingEntity, lookupSchemaName, attributeId: "" },
          content: [{ type: "text", text: `Failed to create lookup attribute: ${error.message}` }],
        };
      }
    }
  );

  // Get Entity Relationships
  server.registerTool(
    "get-entity-relationships",
    {
      title: "Get Entity Relationships",
      description: "Get relationships (one-to-many and many-to-many) for a PowerPlatform entity",
      inputSchema: {
        entityName: z.string().describe("The logical name of the entity"),
        environment: z.string().optional().describe("Environment name (e.g. DEV, UAT). Uses default if omitted."),
      },
      outputSchema: z.object({
        entityName: z.string(),
        relationships: z.any(),
      }),
    },
    async ({ entityName, environment }) => {
      try {
        const ctx = registry.getContext(environment);
        const service = ctx.getEntityService();
        const relationships = await service.getEntityRelationships(entityName);

        return {
          structuredContent: { entityName, relationships },
          content: [
            {
              type: "text",
              text: `Relationships for entity '${entityName}':\n\n${JSON.stringify(relationships, null, 2)}`,
            },
          ],
        };
      } catch (error: any) {
        console.error("Error getting entity relationships:", error);
        return {
          structuredContent: { entityName, relationships: [] },
          content: [
            {
              type: "text",
              text: `Failed to get entity relationships: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}
