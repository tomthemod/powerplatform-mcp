/**
 * BusinessRuleService
 *
 * Read-only service for business rules in Dynamics 365.
 */

import { PowerPlatformClient } from '../powerplatform-client.js';
import type { ApiCollectionResponse } from '../models/index.js';

export class BusinessRuleService {
  constructor(private client: PowerPlatformClient) {}

  /**
   * Get all business rules in the environment
   */
  async getBusinessRules(
    activeOnly: boolean = false,
    maxRecords: number = 100
  ): Promise<{
    totalCount: number;
    businessRules: unknown[];
  }> {
    // Category 2 = Business Rule
    // StateCode: 0=Draft, 1=Activated, 2=Suspended
    // Type: 1=Definition
    const stateFilter = activeOnly ? ' and statecode eq 1' : '';

    // NOTE: `ownerid` on workflow is a polymorphic Owner lookup (user OR team) and is
    // NOT directly expandable in OData. We use the typed nav property `owninguser`
    // which only resolves when the owner is a systemuser — the dominant case for BRs.
    const businessRules = await this.client.get<
      ApiCollectionResponse<Record<string, unknown>>
    >(
      `api/data/v9.2/workflows?$filter=category eq 2${stateFilter}&$select=workflowid,name,statecode,statuscode,description,createdon,modifiedon,type,ismanaged,primaryentity&$expand=owninguser($select=fullname),modifiedby($select=fullname)&$orderby=modifiedon desc&$top=${maxRecords}`
    );

    const formattedBusinessRules = (businessRules.value ?? []).map((rule) => ({
      workflowid: rule.workflowid,
      name: rule.name,
      description: rule.description,
      state:
        rule.statecode === 0
          ? 'Draft'
          : rule.statecode === 1
            ? 'Activated'
            : 'Suspended',
      statecode: rule.statecode,
      statuscode: rule.statuscode,
      type:
        rule.type === 1
          ? 'Definition'
          : rule.type === 2
            ? 'Activation'
            : 'Template',
      primaryEntity: rule.primaryentity,
      isManaged: rule.ismanaged,
      owner: (rule.owninguser as { fullname?: string })?.fullname,
      modifiedOn: rule.modifiedon,
      modifiedBy: (rule.modifiedby as { fullname?: string })?.fullname,
      createdOn: rule.createdon,
    }));

    return {
      totalCount: formattedBusinessRules.length,
      businessRules: formattedBusinessRules,
    };
  }

  /**
   * Get a specific business rule with its complete XAML definition
   */
  async getBusinessRule(workflowId: string): Promise<unknown> {
    // See note in getBusinessRules() — `ownerid` is polymorphic, use `owninguser` instead.
    const businessRule = await this.client.get<Record<string, unknown>>(
      `api/data/v9.2/workflows(${workflowId})?$select=workflowid,name,statecode,statuscode,description,createdon,modifiedon,type,category,ismanaged,primaryentity,xaml&$expand=owninguser($select=fullname),modifiedby($select=fullname),createdby($select=fullname)`
    );

    // Verify it's actually a business rule
    if (businessRule.category !== 2) {
      throw new Error(
        `Workflow ${workflowId} is not a business rule (category: ${businessRule.category})`
      );
    }

    return {
      workflowid: businessRule.workflowid,
      name: businessRule.name,
      description: businessRule.description,
      state:
        businessRule.statecode === 0
          ? 'Draft'
          : businessRule.statecode === 1
            ? 'Activated'
            : 'Suspended',
      statecode: businessRule.statecode,
      statuscode: businessRule.statuscode,
      type:
        businessRule.type === 1
          ? 'Definition'
          : businessRule.type === 2
            ? 'Activation'
            : 'Template',
      category: businessRule.category,
      primaryEntity: businessRule.primaryentity,
      isManaged: businessRule.ismanaged,
      owner: (businessRule.owninguser as { fullname?: string })?.fullname,
      createdOn: businessRule.createdon,
      createdBy: (businessRule.createdby as { fullname?: string })?.fullname,
      modifiedOn: businessRule.modifiedon,
      modifiedBy: (businessRule.modifiedby as { fullname?: string })?.fullname,
      xaml: businessRule.xaml,
    };
  }

  /**
   * Get a structured summary of a business rule (parsed from xaml).
   *
   * Useful for cross-entity copy: gives the primary entity, all referenced
   * attributes/controls, conditions (with their descriptions) and actions
   * (SetVisibility, SetAttributeValue, SetBusinessRequired, ...) — enough to
   * reproduce the rule manually in the maker portal pointing at a different
   * entity's equivalent attributes.
   */
  async getBusinessRuleSummary(workflowId: string): Promise<{
    workflowid: string;
    name: string;
    primaryEntity: string | null;
    state: string;
    isManaged: boolean;
    attributesReferenced: string[];
    controlsReferenced: string[];
    conditions: { description: string | null; operator: string | null }[];
    actions: { type: string; controlId?: string; attribute?: string; isVisible?: boolean; value?: string; displayName?: string }[];
    rawXamlSize: number;
  }> {
    const br = (await this.getBusinessRule(workflowId)) as Record<string, unknown>;
    const xaml = (br.xaml as string) ?? '';

    return {
      workflowid: br.workflowid as string,
      name: br.name as string,
      primaryEntity: (br.primaryEntity as string) ?? null,
      state: br.state as string,
      isManaged: Boolean(br.isManaged),
      ...this.parseBusinessRuleXaml(xaml),
      rawXamlSize: xaml.length,
    };
  }

  /**
   * Extract conditions, actions and referenced attributes/controls from BR xaml.
   *
   * The xaml structure uses:
   *   - <mxswa:GetEntityProperty Attribute="x" EntityName="y" Value="..."/>  → read attribute
   *   - <mxswa:ActivityReference DisplayName="ConditionBranchStep<N>"> with
   *     <x:String x:Key="Description">human label</x:String>            → branch
   *     ConditionOperator (NotNull, Equal, NotEqual, GreaterThan, ...)
   *   - <mcwc:SetVisibility ControlId="x" IsVisible="True|False"/>      → action
   *   - <mcwc:SetAttributeValue Attribute="x" Value="..."/>             → action
   *   - <mxswa:ActivityReference DisplayName="SetBusinessRequiredStep<N>"...>  → action
   */
  parseBusinessRuleXaml(xaml: string): {
    attributesReferenced: string[];
    controlsReferenced: string[];
    conditions: { description: string | null; operator: string | null }[];
    actions: { type: string; controlId?: string; attribute?: string; isVisible?: boolean; value?: string; displayName?: string }[];
  } {
    const attrs = new Set<string>();
    const controls = new Set<string>();

    for (const m of xaml.matchAll(/Attribute="([^"]+)"/g)) attrs.add(m[1]);
    for (const m of xaml.matchAll(/ControlId="([^"]+)"/g)) controls.add(m[1]);

    // Pull descriptions and operators globally — branches are nested with inner
    // ActivityReference end tags that defeat per-block extraction. The two lists
    // are presented in document order; correlation is left to the reader.
    const descriptions = [...xaml.matchAll(/<x:String x:Key="Description">([^<]*)<\/x:String>/g)]
      .map((m) => m[1])
      .filter((d) => d.length > 0);
    const operators = [...xaml.matchAll(/x:Key="ConditionOperator">([^<]+)</g)].map((m) => m[1]);
    const conditions: { description: string | null; operator: string | null }[] = [];
    const maxLen = Math.max(descriptions.length, operators.length);
    for (let i = 0; i < maxLen; i++) {
      conditions.push({
        description: descriptions[i] ?? null,
        operator: operators[i] ?? null,
      });
    }

    const actions: { type: string; controlId?: string; attribute?: string; isVisible?: boolean; value?: string; displayName?: string }[] = [];

    for (const m of xaml.matchAll(/<mcwc:SetVisibility([^/]*?)\/>/g)) {
      const tag = m[1];
      actions.push({
        type: 'SetVisibility',
        controlId: extractAttr(tag, 'ControlId'),
        isVisible: extractAttr(tag, 'IsVisible')?.toLowerCase() === 'true',
      });
    }
    for (const m of xaml.matchAll(/<mcwc:SetAttributeValue([^/]*?)\/>/g)) {
      const tag = m[1];
      actions.push({
        type: 'SetAttributeValue',
        attribute: extractAttr(tag, 'Attribute'),
        value: extractAttr(tag, 'Value'),
      });
    }
    for (const m of xaml.matchAll(/DisplayName="(SetBusinessRequiredStep\d+:?[^"]*)">/g)) {
      actions.push({ type: 'SetBusinessRequired', displayName: m[1] });
    }
    for (const m of xaml.matchAll(/DisplayName="(SetBusinessRecommendedStep\d+:?[^"]*)">/g)) {
      actions.push({ type: 'SetBusinessRecommended', displayName: m[1] });
    }
    for (const m of xaml.matchAll(/DisplayName="(SetDefaultValueStep\d+:?[^"]*)">/g)) {
      actions.push({ type: 'SetDefaultValue', displayName: m[1] });
    }
    for (const m of xaml.matchAll(/DisplayName="(LockStep\d+:?[^"]*)">/g)) {
      actions.push({ type: 'Lock', displayName: m[1] });
    }
    for (const m of xaml.matchAll(/DisplayName="(ShowErrorMessageStep\d+:?[^"]*)">/g)) {
      actions.push({ type: 'ShowErrorMessage', displayName: m[1] });
    }

    return {
      attributesReferenced: Array.from(attrs).sort(),
      controlsReferenced: Array.from(controls).sort(),
      conditions,
      actions,
    };
  }
}

function extractAttr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m?.[1];
}
