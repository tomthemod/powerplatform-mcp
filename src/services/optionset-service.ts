import { PowerPlatformClient } from '../powerplatform-client.js';

/**
 * Service for option set operations.
 * Handles global option set definitions.
 */
export class OptionSetService {
  constructor(private client: PowerPlatformClient) {}

  /**
   * Get a global option set definition by name
   * @param optionSetName The name of the global option set
   * @returns The global option set definition
   */
  async getGlobalOptionSet(optionSetName: string): Promise<any> {
    return this.client.get(`api/data/v9.2/GlobalOptionSetDefinitions(Name='${optionSetName}')`);
  }

  /**
   * Create a global option set (Choice) usable across multiple entities.
   *
   * @param name Schema name including publisher prefix (e.g. 'new_priority')
   * @param displayName Display name shown in the maker portal
   * @param options Array of { value, label } pairs
   * @param description Optional description
   * @param languageCode Language code for labels (default 1045)
   * @param solutionName Optional solution unique name to add the component to
   */
  async createGlobalOptionSet(
    name: string,
    displayName: string,
    options: { value: number; label: string }[],
    description?: string,
    languageCode: number = 1045,
    solutionName?: string,
  ): Promise<{ optionSetId: string }> {
    const mkLabel = (text: string) => ({
      '@odata.type': 'Microsoft.Dynamics.CRM.Label',
      LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: languageCode }],
    });

    const body: Record<string, unknown> = {
      '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
      Name: name,
      DisplayName: mkLabel(displayName),
      IsGlobal: true,
      OptionSetType: 'Picklist',
      Options: options.map(o => ({
        Value: o.value,
        Label: mkLabel(o.label),
      })),
    };
    if (description) {
      body.Description = mkLabel(description);
    }

    const headers = solutionName ? { 'MSCRM.SolutionUniqueName': solutionName } : undefined;
    const result = await this.client.post<{ entityId?: string }>(
      'api/data/v9.2/GlobalOptionSetDefinitions',
      body,
      headers,
    );
    return { optionSetId: result?.entityId ?? 'created' };
  }

  /**
   * Update the display label of an existing attribute on an entity.
   * Uses GET-then-PUT with `MSCRM.MergeLabels: true` so labels in other
   * languages are preserved.
   *
   * Note: this does NOT publish customizations — call publish-customizations
   * once at the end of the build.
   */
  async updateAttributeLabel(
    entityName: string,
    attributeName: string,
    displayName: string,
    languageCode: number = 1045,
    solutionName?: string,
  ): Promise<void> {
    const url = `api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')`;
    const current = await this.client.get<any>(url);

    const existingLabels: any[] = current?.DisplayName?.LocalizedLabels ?? [];
    const filtered = existingLabels
      .filter(l => l && l.LanguageCode !== languageCode)
      .map(l => ({
        '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
        Label: l.Label,
        LanguageCode: l.LanguageCode,
      }));

    const body = {
      ...current,
      DisplayName: {
        '@odata.type': 'Microsoft.Dynamics.CRM.Label',
        LocalizedLabels: [
          ...filtered,
          {
            '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
            Label: displayName,
            LanguageCode: languageCode,
          },
        ],
      },
    };

    const headers: Record<string, string> = { 'MSCRM.MergeLabels': 'true' };
    if (solutionName) headers['MSCRM.SolutionUniqueName'] = solutionName;
    await this.client.put(url, body, headers);
  }

  /**
   * Add an option to a local picklist (entityName + attributeName) or to a
   * global option set (optionSetName). Pass either entity+attribute OR optionSetName.
   *
   * @param value Optional explicit option value. If omitted, Dataverse auto-assigns
   *   one within the publisher's custom value range.
   * @returns The (new or provided) option value.
   */
  async insertOptionValue(params: {
    entityName?: string;
    attributeName?: string;
    optionSetName?: string;
    label: string;
    value?: number;
    languageCode?: number;
    solutionName?: string;
  }): Promise<{ value: number }> {
    this.assertTarget(params);
    const languageCode = params.languageCode ?? 1045;

    const body: Record<string, unknown> = {
      Label: {
        '@odata.type': 'Microsoft.Dynamics.CRM.Label',
        LocalizedLabels: [
          {
            '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
            Label: params.label,
            LanguageCode: languageCode,
          },
        ],
      },
    };
    if (params.optionSetName) body.OptionSetName = params.optionSetName;
    else {
      body.EntityLogicalName = params.entityName;
      body.AttributeLogicalName = params.attributeName;
    }
    if (typeof params.value === 'number') body.Value = params.value;
    if (params.solutionName) body.SolutionUniqueName = params.solutionName;

    const result = await this.client.post<{ NewOptionValue?: number }>(
      'api/data/v9.2/InsertOptionValue',
      body,
    );
    return { value: typeof result?.NewOptionValue === 'number' ? result.NewOptionValue : (params.value ?? -1) };
  }

  /**
   * Remove an option from a local picklist or a global option set.
   * Records that previously held this value will keep the orphan integer.
   */
  async deleteOptionValue(params: {
    entityName?: string;
    attributeName?: string;
    optionSetName?: string;
    value: number;
    solutionName?: string;
  }): Promise<void> {
    this.assertTarget(params);
    const body: Record<string, unknown> = { Value: params.value };
    if (params.optionSetName) body.OptionSetName = params.optionSetName;
    else {
      body.EntityLogicalName = params.entityName;
      body.AttributeLogicalName = params.attributeName;
    }
    if (params.solutionName) body.SolutionUniqueName = params.solutionName;

    await this.client.post('api/data/v9.2/DeleteOptionValue', body);
  }

  /**
   * Update the label of an existing option in a local picklist or global option set.
   * Other languages' labels are preserved by Dataverse merge semantics.
   */
  async updateOptionValue(params: {
    entityName?: string;
    attributeName?: string;
    optionSetName?: string;
    value: number;
    label: string;
    languageCode?: number;
    solutionName?: string;
  }): Promise<void> {
    this.assertTarget(params);
    const languageCode = params.languageCode ?? 1045;

    const body: Record<string, unknown> = {
      Value: params.value,
      Label: {
        '@odata.type': 'Microsoft.Dynamics.CRM.Label',
        LocalizedLabels: [
          {
            '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
            Label: params.label,
            LanguageCode: languageCode,
          },
        ],
      },
      MergeLabels: true,
    };
    if (params.optionSetName) body.OptionSetName = params.optionSetName;
    else {
      body.EntityLogicalName = params.entityName;
      body.AttributeLogicalName = params.attributeName;
    }
    if (params.solutionName) body.SolutionUniqueName = params.solutionName;

    await this.client.post('api/data/v9.2/UpdateOptionValue', body);
  }

  private assertTarget(params: { entityName?: string; attributeName?: string; optionSetName?: string }): void {
    const hasGlobal = !!params.optionSetName;
    const hasLocal = !!(params.entityName && params.attributeName);
    if (hasGlobal === hasLocal) {
      throw new Error('Specify either optionSetName (global) OR entityName + attributeName (local), not both.');
    }
  }
}
