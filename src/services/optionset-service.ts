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
}
