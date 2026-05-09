import { PowerPlatformClient } from '../powerplatform-client.js';
import type { ApiCollectionResponse } from '../models/index.js';
import { randomUUID } from 'crypto';

/** Standard classid for a generic form control (works for text, money, picklist, lookup, etc.) */
const STANDARD_CONTROL_CLASSID = '{4273EDBD-AC1D-40d3-9FB2-095C621B552D}';

export interface FormSummary {
  formid: string;
  name: string;
  type: number;       // 2 = Main, 5 = Quick View, 6 = Quick Create, 7 = Dashboard
  description?: string;
}

export interface ViewSummary {
  savedqueryid: string;
  name: string;
  querytype: number;
  isdefault: boolean;
  description?: string;
}

/**
 * Service for managing Dataverse forms (systemform) and views (savedquery).
 */
export class FormViewService {
  constructor(private client: PowerPlatformClient) {}

  // ─── FORMS ─────────────────────────────────────────────────────────────────

  /**
   * List forms for an entity.
   * @param entityLogicalName The entity logical name
   * @param type Form type filter (default: 2 = Main)
   */
  async getEntityForms(entityLogicalName: string, type?: number): Promise<FormSummary[]> {
    // objecttypecode on systemforms accepts the entity logical name as a string.
    let filter = `objecttypecode eq '${entityLogicalName}'`;
    if (type !== undefined) filter += ` and type eq ${type}`;

    const result = await this.client.get<ApiCollectionResponse<FormSummary>>(
      `api/data/v9.2/systemforms?$select=formid,name,type,description&$filter=${filter}`,
    );
    return result.value ?? [];
  }

  /**
   * Get the fields currently on a form by parsing its formxml.
   * Returns the list of `datafieldname` values found in `<control>` elements.
   */
  async getFormFields(formId: string): Promise<string[]> {
    const form = await this.client.get<{ formxml: string }>(
      `api/data/v9.2/systemforms(${formId})?$select=formxml`,
    );
    const xml = form.formxml ?? '';
    const fields: string[] = [];
    const re = /datafieldname="([^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(xml)) !== null) {
      fields.push(match[1]);
    }
    return fields;
  }

  /**
   * Add a field to a form. Appends a new row/cell/control at the end of the first
   * section in the first tab. If the field is already present, this is a no-op.
   *
   * @param formId The systemform GUID
   * @param attributeName The logical name of the attribute to add
   * @param entityLogicalName Used only for publishing after the change
   */
  async addFormField(formId: string, attributeName: string, entityLogicalName: string): Promise<{ added: boolean }> {
    const form = await this.client.get<{ formxml: string }>(
      `api/data/v9.2/systemforms(${formId})?$select=formxml`,
    );
    let xml = form.formxml ?? '';

    // Check if the field is already on the form.
    if (xml.toLowerCase().includes(`datafieldname="${attributeName.toLowerCase()}"`)) {
      return { added: false };
    }

    // Build the new row element.
    const cellId = `{${randomUUID()}}`;
    const newRow = `<row><cell id="${cellId}" showlabel="true" locklevel="0"><labels><label description="${attributeName}" languagecode="1033" /></labels><control id="${attributeName}" classid="${STANDARD_CONTROL_CLASSID}" datafieldname="${attributeName}" /></cell></row>`;

    // Insert before the closing </rows> of the first section.
    const rowsCloseIdx = xml.indexOf('</rows>');
    if (rowsCloseIdx === -1) {
      throw new Error('Could not find </rows> in formxml — form may have an unexpected structure.');
    }
    xml = xml.substring(0, rowsCloseIdx) + newRow + xml.substring(rowsCloseIdx);

    // Patch the form.
    await this.client.patch(`api/data/v9.2/systemforms(${formId})`, { formxml: xml });

    // Publish the entity.
    await this.publishEntity(entityLogicalName);

    return { added: true };
  }

  /**
   * Add a field to a form, positioned before or after another existing field.
   * The new field is placed in the same `<row>` neighborhood as the reference field —
   * specifically, a new `<row>` is inserted immediately before or after the `<row>`
   * containing the reference field's `<control>`.
   *
   * If `attributeName` is already on the form, this is a no-op.
   * If `relativeToField` is not on the form, throws.
   *
   * @param formId The systemform GUID
   * @param attributeName The logical name of the attribute to add
   * @param relativeToField The logical name of the existing reference field on the form
   * @param position 'before' (insert before the reference row) or 'after' (insert after)
   * @param entityLogicalName Used only for publishing after the change
   */
  async addFormFieldRelative(
    formId: string,
    attributeName: string,
    relativeToField: string,
    position: 'before' | 'after',
    entityLogicalName: string,
  ): Promise<{ added: boolean }> {
    const form = await this.client.get<{ formxml: string }>(
      `api/data/v9.2/systemforms(${formId})?$select=formxml`,
    );
    let xml = form.formxml ?? '';

    // No-op if the field is already on the form.
    if (xml.toLowerCase().includes(`datafieldname="${attributeName.toLowerCase()}"`)) {
      return { added: false };
    }

    // Locate the <row>...</row> block containing the reference field.
    const escaped = relativeToField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rowRegex = new RegExp(`<row[^>]*>[\\s\\S]*?datafieldname="${escaped}"[\\s\\S]*?<\\/row>`, 'i');
    const match = xml.match(rowRegex);
    if (!match) {
      throw new Error(
        `Reference field '${relativeToField}' was not found on form ${formId} — cannot position '${attributeName}' relative to it.`,
      );
    }

    // Build the new row element (same shape as addFormField).
    const cellId = `{${randomUUID()}}`;
    const newRow = `<row><cell id="${cellId}" showlabel="true" locklevel="0"><labels><label description="${attributeName}" languagecode="1033" /></labels><control id="${attributeName}" classid="${STANDARD_CONTROL_CLASSID}" datafieldname="${attributeName}" /></cell></row>`;

    const replacement = position === 'before' ? `${newRow}${match[0]}` : `${match[0]}${newRow}`;
    xml = xml.replace(match[0], replacement);

    await this.client.patch(`api/data/v9.2/systemforms(${formId})`, { formxml: xml });
    await this.publishEntity(entityLogicalName);

    return { added: true };
  }

  /**
   * Remove a field from a form. Removes the entire `<row>` containing the field's control.
   * If the field is not on the form, this is a no-op.
   *
   * @param formId The systemform GUID
   * @param attributeName The logical name of the attribute to remove
   * @param entityLogicalName Used only for publishing after the change
   */
  async removeFormField(formId: string, attributeName: string, entityLogicalName: string): Promise<{ removed: boolean }> {
    const form = await this.client.get<{ formxml: string }>(
      `api/data/v9.2/systemforms(${formId})?$select=formxml`,
    );
    let xml = form.formxml ?? '';

    // Build a regex that matches the <row> containing the target control.
    // Use a non-greedy match between <row> and </row> to avoid over-matching.
    const escaped = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rowRegex = new RegExp(`<row>[\\s\\S]*?datafieldname="${escaped}"[\\s\\S]*?<\\/row>`, 'i');
    const newXml = xml.replace(rowRegex, '');

    if (newXml === xml) {
      return { removed: false };
    }

    await this.client.patch(`api/data/v9.2/systemforms(${formId})`, { formxml: newXml });
    await this.publishEntity(entityLogicalName);

    return { removed: true };
  }

  // ─── FORM LIBRARIES ────────────────────────────────────────────────────────

  /**
   * Register a JS web resource as a form library so handlers can reference it.
   * Looks up the web resource by name to get its webresourceid, then injects
   * `<Library name="..." libraryUniqueId="{webresourceid}" />` into the form's
   * `<formLibraries>` block (creating the block if missing).
   *
   * @param formId The systemform GUID
   * @param libraryName Web resource name (e.g. 'new_Simpliciti_Opportunity.js')
   * @param entityLogicalName Used for publishing
   */
  async addFormLibrary(
    formId: string,
    libraryName: string,
    entityLogicalName: string,
  ): Promise<{ added: boolean }> {
    // Resolve the web resource id by name.
    const wr = await this.client.get<ApiCollectionResponse<{ webresourceid: string }>>(
      `api/data/v9.2/webresourceset?$filter=name eq '${libraryName}'&$select=webresourceid&$top=1`,
    );
    if (!wr.value || wr.value.length === 0) {
      throw new Error(`Web resource '${libraryName}' not found in Dataverse — deploy it first via create-web-resource or upsert-web-resource.`);
    }
    const wrId = wr.value[0].webresourceid;

    const form = await this.client.get<{ formxml: string }>(
      `api/data/v9.2/systemforms(${formId})?$select=formxml`,
    );
    let xml = form.formxml ?? '';

    const escName = libraryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`<Library[^>]*name="${escName}"`, 'i').test(xml)) {
      return { added: false };
    }

    const libraryXml = `<Library name="${libraryName}" libraryUniqueId="{${wrId}}" />`;

    if (/<formLibraries>[\s\S]*?<\/formLibraries>/i.test(xml)) {
      xml = xml.replace(/<\/formLibraries>/i, `${libraryXml}</formLibraries>`);
    } else if (/<\/form>\s*$/i.test(xml)) {
      xml = xml.replace(/<\/form>\s*$/i, `<formLibraries>${libraryXml}</formLibraries></form>`);
    } else {
      throw new Error('Form xml does not contain a <form> root — unexpected structure.');
    }

    await this.client.patch(`api/data/v9.2/systemforms(${formId})`, { formxml: xml });
    await this.publishEntity(entityLogicalName);
    return { added: true };
  }

  /**
   * Unregister a JS web resource from a form's `<formLibraries>`.
   * By default refuses to remove a library that is still referenced by an event handler;
   * pass `force=true` to bypass the safety check.
   *
   * @param formId The systemform GUID
   * @param libraryName Web resource name
   * @param force Bypass the "still referenced" check (default: false)
   * @param entityLogicalName Used for publishing
   */
  async removeFormLibrary(
    formId: string,
    libraryName: string,
    force: boolean,
    entityLogicalName: string,
  ): Promise<{ removed: boolean }> {
    const form = await this.client.get<{ formxml: string }>(
      `api/data/v9.2/systemforms(${formId})?$select=formxml`,
    );
    let xml = form.formxml ?? '';

    const escName = libraryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (!force) {
      const handlerRefRegex = new RegExp(`<Handler[^>]*libraryName="${escName}"`, 'i');
      if (handlerRefRegex.test(xml)) {
        throw new Error(
          `Library '${libraryName}' is still referenced by at least one event handler on this form. ` +
          `Remove the handlers first via remove-form-event-handler, or pass force=true to remove anyway (handlers will silently fail at runtime).`,
        );
      }
    }

    const libRegex = new RegExp(`\\s*<Library[^>]*name="${escName}"[^>]*/>\\s*`, 'gi');
    let newXml = xml.replace(libRegex, '');
    if (newXml === xml) {
      return { removed: false };
    }
    newXml = newXml.replace(/<formLibraries>\s*<\/formLibraries>/gi, '');

    await this.client.patch(`api/data/v9.2/systemforms(${formId})`, { formxml: newXml });
    await this.publishEntity(entityLogicalName);
    return { removed: true };
  }

  // ─── FORM EVENT HANDLERS ───────────────────────────────────────────────────

  /**
   * Attach a JS event handler to a Dataverse form.
   *
   * For form-level events (`onload`, `onsave`), the handler goes under `<form>/<events>`.
   * For field-level events (`onchange`), the handler goes under the matching
   * `<control datafieldname="X">/<events>`. Pass `attributeName` only for `onchange`.
   *
   * IMPORTANT — the JS library (web resource) must already be listed in the form's
   * `<formLibraries>`. This function does NOT auto-register libraries, so handlers
   * referencing an unregistered library will silently fail to fire at runtime.
   * Register the library through the form designer or by patching `<formLibraries>`
   * directly.
   *
   * @param formId The systemform GUID
   * @param eventName 'onload' | 'onsave' (form-level) | 'onchange' (field-level — requires attributeName)
   * @param functionName Fully-qualified JS function name (e.g. 'Simpliciti.Opportunity.onLoad')
   * @param libraryName Web resource name of the JS file (e.g. 'new_Simpliciti_Opportunity.js')
   * @param attributeName Required for 'onchange'; must match a field already on the form
   * @param passExecutionContext Pass the executionContext as the first arg (default: true)
   * @param parameters Comma-separated extra parameters string (default: '')
   * @param entityLogicalName Used for publishing
   */
  async addFormEventHandler(
    formId: string,
    eventName: 'onload' | 'onsave' | 'onchange',
    functionName: string,
    libraryName: string,
    attributeName: string | undefined,
    passExecutionContext: boolean,
    parameters: string,
    entityLogicalName: string,
  ): Promise<{ added: boolean }> {
    if (eventName === 'onchange' && !attributeName) {
      throw new Error("`attributeName` is required for 'onchange' events.");
    }
    if (eventName !== 'onchange' && attributeName) {
      throw new Error(`'${eventName}' is a form-level event — do not pass attributeName.`);
    }

    const form = await this.client.get<{ formxml: string }>(
      `api/data/v9.2/systemforms(${formId})?$select=formxml`,
    );
    let xml = form.formxml ?? '';

    // No-op if the same handler is already on the same event.
    const existsRegex = new RegExp(
      `<Handler[^>]*functionName="${functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*libraryName="${libraryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
      'i',
    );
    if (existsRegex.test(xml)) {
      return { added: false };
    }

    const handlerXml = `<Handler functionName="${functionName}" libraryName="${libraryName}" enabled="true" parameters="${parameters}" passExecutionContext="${passExecutionContext}" />`;

    if (eventName === 'onchange') {
      // Locate the <control datafieldname="X">...</control> block.
      const escaped = attributeName!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const controlRegex = new RegExp(`<control[^>]*datafieldname="${escaped}"[^>]*>(?:[\\s\\S]*?<\\/control>)?`, 'i');
      const controlMatch = xml.match(controlRegex);
      if (!controlMatch) {
        throw new Error(`Field '${attributeName}' is not on form ${formId} — add it first via add-form-field.`);
      }

      let updated = controlMatch[0];
      const isSelfClosing = updated.trimEnd().endsWith('/>');
      if (isSelfClosing) {
        // Convert `<control ... />` → `<control ...><events>...</events></control>`
        const openTag = updated.replace(/\s*\/>\s*$/, '>');
        updated = `${openTag}<events><event name="onchange"><Handlers>${handlerXml}</Handlers></event></events></control>`;
      } else {
        // Already has a body. Look for an existing <events> block.
        if (/<events>[\s\S]*?<\/events>/i.test(updated)) {
          // Merge into existing events block.
          updated = updated.replace(/<events>([\s\S]*?)<\/events>/i, (_, inner) => {
            if (/<event\s+name="onchange"[^>]*>[\s\S]*?<\/event>/i.test(inner)) {
              // onchange event exists — inject handler into Handlers
              const newInner = inner.replace(/(<event\s+name="onchange"[^>]*>[\s\S]*?<Handlers>)([\s\S]*?)(<\/Handlers>)/i, `$1$2${handlerXml}$3`);
              return `<events>${newInner}</events>`;
            }
            return `<events>${inner}<event name="onchange"><Handlers>${handlerXml}</Handlers></event></events>`;
          });
        } else {
          // No <events> yet, inject just before </control>
          updated = updated.replace(/<\/control>$/, `<events><event name="onchange"><Handlers>${handlerXml}</Handlers></event></events></control>`);
        }
      }
      xml = xml.replace(controlMatch[0], updated);
    } else {
      // Form-level event: onload / onsave under <form>/<events>.
      // Look for an existing top-level <events> block (one that closes with </events> at form root, not nested).
      // Simpler: find or create <events> block immediately before </form>.
      if (!/<\/form>/i.test(xml)) {
        throw new Error('Form xml does not contain a <form> root — unexpected structure.');
      }

      // Find a top-level <events>...</events>: heuristic = the one that immediately precedes </form>
      // and isn't inside a <control>. We use the LAST <events>...</events> in the doc.
      const lastEventsIdx = xml.lastIndexOf('<events>');
      const lastEventsCloseIdx = xml.lastIndexOf('</events>');
      const formCloseIdx = xml.lastIndexOf('</form>');

      // A reliable test: the last </events> right before </form> is the form-level one.
      const isFormLevelEventsBlock =
        lastEventsCloseIdx > -1 &&
        formCloseIdx > -1 &&
        lastEventsCloseIdx < formCloseIdx &&
        // No </control> between them = events are at form scope.
        !/<\/control>/i.test(xml.substring(lastEventsCloseIdx, formCloseIdx));

      if (isFormLevelEventsBlock && lastEventsIdx > -1) {
        // Patch the top-level events block.
        const before = xml.substring(0, lastEventsIdx);
        const eventsBlock = xml.substring(lastEventsIdx, lastEventsCloseIdx + '</events>'.length);
        const after = xml.substring(lastEventsCloseIdx + '</events>'.length);

        const eventRegex = new RegExp(`<event\\s+name="${eventName}"[^>]*>[\\s\\S]*?</event>`, 'i');
        let newEventsBlock: string;
        if (eventRegex.test(eventsBlock)) {
          newEventsBlock = eventsBlock.replace(/(<event\s+name="(?:onload|onsave)"[^>]*>[\s\S]*?<Handlers>)([\s\S]*?)(<\/Handlers>)/i, (m, h1, h2, h3) => {
            // Only patch if the matched event matches the requested eventName
            return m.includes(`name="${eventName}"`) ? `${h1}${h2}${handlerXml}${h3}` : m;
          });
          // Fallback if the global regex didn't match the right one — append in event scope
          if (newEventsBlock === eventsBlock) {
            newEventsBlock = eventsBlock.replace(eventRegex, m => m.replace('</event>', `${handlerXml}</event>`));
          }
        } else {
          newEventsBlock = eventsBlock.replace('</events>', `<event name="${eventName}" application="false"><Handlers>${handlerXml}</Handlers></event></events>`);
        }
        xml = before + newEventsBlock + after;
      } else {
        // No form-level events block — inject it just before </form>.
        xml = xml.replace(/<\/form>\s*$/i, `<events><event name="${eventName}" application="false"><Handlers>${handlerXml}</Handlers></event></events></form>`);
      }
    }

    await this.client.patch(`api/data/v9.2/systemforms(${formId})`, { formxml: xml });
    await this.publishEntity(entityLogicalName);
    return { added: true };
  }

  /**
   * Remove a JS event handler from a form, identified by its functionName (and optionally libraryName).
   * Removes the matching `<Handler ... />` element. If that leaves an empty `<Handlers>`,
   * the surrounding `<event>` is also removed.
   *
   * @param formId The systemform GUID
   * @param functionName Fully-qualified JS function name to remove
   * @param libraryName Optional: also match library name (prevents cross-library collisions)
   * @param entityLogicalName Used for publishing
   */
  async removeFormEventHandler(
    formId: string,
    functionName: string,
    libraryName: string | undefined,
    entityLogicalName: string,
  ): Promise<{ removed: boolean }> {
    const form = await this.client.get<{ formxml: string }>(
      `api/data/v9.2/systemforms(${formId})?$select=formxml`,
    );
    let xml = form.formxml ?? '';

    const escFn = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const libClause = libraryName
      ? `[^>]*libraryName="${libraryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`
      : '';
    const handlerRegex = new RegExp(`\\s*<Handler[^>]*functionName="${escFn}"${libClause}[^>]*/>\\s*`, 'gi');

    let newXml = xml.replace(handlerRegex, '');
    if (newXml === xml) {
      return { removed: false };
    }

    // Clean up empty <Handlers></Handlers>, then empty <event ...></event>, then empty <events></events>.
    newXml = newXml
      .replace(/<Handlers>\s*<\/Handlers>/gi, '')
      .replace(/<event\s+name="[^"]+"[^>]*>\s*<\/event>/gi, '')
      .replace(/<events>\s*<\/events>/gi, '');

    await this.client.patch(`api/data/v9.2/systemforms(${formId})`, { formxml: newXml });
    await this.publishEntity(entityLogicalName);
    return { removed: true };
  }

  // ─── FORM PCF CONTROLS ─────────────────────────────────────────────────────

  /**
   * Attach a PCF (Custom Control) to a field on a form.
   *
   * Replaces (or creates) the `<parameters><CustomControl>...</CustomControl></parameters>`
   * block inside the existing `<control datafieldname="X">`. The PCF must already be
   * registered as a solution component in Dataverse (via `pac pcf push` or import).
   *
   * @param formId The systemform GUID
   * @param attributeName The logical name of the field whose control will host the PCF
   * @param pcfControlName Fully-qualified PCF name (e.g. 'Simpliciti.MyPcf')
   * @param formFactors Bitmask: 1=Phone, 2=Tablet, 3=Both, 4=Web, 7=All (default 3)
   * @param customParameters Optional raw XML for the inner `<Parameters>...</Parameters>` block. If omitted, a minimal binding to the field is generated.
   * @param entityLogicalName Used for publishing
   */
  async addFormPcfControl(
    formId: string,
    attributeName: string,
    pcfControlName: string,
    formFactors: number = 3,
    customParameters: string | undefined,
    entityLogicalName: string,
  ): Promise<{ added: boolean }> {
    const form = await this.client.get<{ formxml: string }>(
      `api/data/v9.2/systemforms(${formId})?$select=formxml`,
    );
    let xml = form.formxml ?? '';

    const escaped = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const controlRegex = new RegExp(`<control[^>]*datafieldname="${escaped}"[^>]*(?:/>|>[\\s\\S]*?<\\/control>)`, 'i');
    const match = xml.match(controlRegex);
    if (!match) {
      throw new Error(`Field '${attributeName}' is not on form ${formId} — add it first via add-form-field.`);
    }

    const innerParams = customParameters && customParameters.trim().length > 0
      ? customParameters
      : `<data><static /><type>SingleLine.Text</type><value>${attributeName}</value></data>`;
    const customControlXml = `<parameters><CustomControl name="${pcfControlName}"><FormFactors>${formFactors}</FormFactors><Parameters>${innerParams}</Parameters></CustomControl></parameters>`;

    let updated: string;
    const original = match[0];
    if (original.trimEnd().endsWith('/>')) {
      // Self-closing: convert and inject.
      const openTag = original.replace(/\s*\/>\s*$/, '>');
      updated = `${openTag}${customControlXml}</control>`;
    } else if (/<parameters>[\s\S]*?<\/parameters>/i.test(original)) {
      // Replace existing <parameters> block.
      updated = original.replace(/<parameters>[\s\S]*?<\/parameters>/i, customControlXml);
    } else {
      // Has a body but no <parameters>: inject before </control>.
      updated = original.replace(/<\/control>$/, `${customControlXml}</control>`);
    }

    xml = xml.replace(original, updated);
    await this.client.patch(`api/data/v9.2/systemforms(${formId})`, { formxml: xml });
    await this.publishEntity(entityLogicalName);
    return { added: true };
  }

  /**
   * Remove the PCF custom control from a field — restores the standard control.
   *
   * @param formId The systemform GUID
   * @param attributeName The logical name of the field
   * @param entityLogicalName Used for publishing
   */
  async removeFormPcfControl(
    formId: string,
    attributeName: string,
    entityLogicalName: string,
  ): Promise<{ removed: boolean }> {
    const form = await this.client.get<{ formxml: string }>(
      `api/data/v9.2/systemforms(${formId})?$select=formxml`,
    );
    let xml = form.formxml ?? '';

    const escaped = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const controlRegex = new RegExp(`<control[^>]*datafieldname="${escaped}"[^>]*>[\\s\\S]*?<\\/control>`, 'i');
    const match = xml.match(controlRegex);
    if (!match) {
      return { removed: false };
    }

    if (!/<parameters>[\s\S]*?<CustomControl[\s\S]*?<\/parameters>/i.test(match[0])) {
      return { removed: false };
    }

    const updated = match[0].replace(/<parameters>[\s\S]*?<\/parameters>/i, '');
    xml = xml.replace(match[0], updated);

    await this.client.patch(`api/data/v9.2/systemforms(${formId})`, { formxml: xml });
    await this.publishEntity(entityLogicalName);
    return { removed: true };
  }

  // ─── VIEWS ─────────────────────────────────────────────────────────────────

  /**
   * List views (saved queries) for an entity.
   * @param entityLogicalName The entity logical name
   */
  async getEntityViews(entityLogicalName: string): Promise<ViewSummary[]> {
    // returnedtypecode on savedqueries accepts the entity logical name as a string.
    const result = await this.client.get<ApiCollectionResponse<ViewSummary>>(
      `api/data/v9.2/savedqueries?$select=savedqueryid,name,querytype,isdefault,description&$filter=returnedtypecode eq '${entityLogicalName}'`,
    );
    return result.value ?? [];
  }

  /**
   * Get the columns currently in a view by parsing its layoutxml.
   */
  async getViewColumns(viewId: string): Promise<string[]> {
    const view = await this.client.get<{ layoutxml: string }>(
      `api/data/v9.2/savedqueries(${viewId})?$select=layoutxml`,
    );
    return this.parseLayoutColumns(view.layoutxml ?? '');
  }

  /** Extract column names from <cell name="..."> elements in layoutxml. */
  private parseLayoutColumns(layoutxml: string): string[] {
    const cols: string[] = [];
    const re = /<cell\s+name="([^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(layoutxml)) !== null) {
      cols.push(match[1]);
    }
    return cols;
  }

  /**
   * Add a column to a view. Appends to both layoutxml and fetchxml.
   *
   * @param viewId The savedquery GUID
   * @param attributeName The logical name of the attribute to add
   * @param width Column width in pixels (default 150)
   * @param entityLogicalName Used only for publishing
   */
  async addViewColumn(viewId: string, attributeName: string, entityLogicalName: string, width: number = 150): Promise<{ added: boolean }> {
    const view = await this.client.get<{ layoutxml: string; fetchxml: string }>(
      `api/data/v9.2/savedqueries(${viewId})?$select=layoutxml,fetchxml`,
    );
    let layoutxml = view.layoutxml ?? '';
    let fetchxml = view.fetchxml ?? '';

    // Check if already present.
    if (layoutxml.toLowerCase().includes(`name="${attributeName.toLowerCase()}"`)) {
      return { added: false };
    }

    // Add to layoutxml: insert <cell name="..." width="..." /> before </row>
    const rowCloseIdx = layoutxml.indexOf('</row>');
    if (rowCloseIdx === -1) {
      throw new Error('Could not find </row> in layoutxml.');
    }
    layoutxml = layoutxml.substring(0, rowCloseIdx)
      + `<cell name="${attributeName}" width="${width}" />`
      + layoutxml.substring(rowCloseIdx);

    // Add to fetchxml: insert <attribute name="..." /> before </entity>
    const entityCloseIdx = fetchxml.indexOf('</entity>');
    if (entityCloseIdx === -1) {
      throw new Error('Could not find </entity> in fetchxml.');
    }
    fetchxml = fetchxml.substring(0, entityCloseIdx)
      + `<attribute name="${attributeName}" />`
      + fetchxml.substring(entityCloseIdx);

    await this.client.patch(`api/data/v9.2/savedqueries(${viewId})`, { layoutxml, fetchxml });
    await this.publishEntity(entityLogicalName);

    return { added: true };
  }

  /**
   * Add a column to a view, positioned before or after another column.
   * The new `<cell>` is inserted in the layoutxml relative to the reference cell;
   * the `<attribute>` in fetchxml is appended (fetchxml column order doesn't drive display).
   *
   * @param viewId The savedquery GUID
   * @param attributeName The logical name of the attribute to add
   * @param relativeToField The logical name of the existing reference column in the view
   * @param position 'before' | 'after' the reference column
   * @param width Column width in pixels (default 150)
   * @param entityLogicalName Used for publishing
   */
  async addViewColumnRelative(
    viewId: string,
    attributeName: string,
    relativeToField: string,
    position: 'before' | 'after',
    width: number,
    entityLogicalName: string,
  ): Promise<{ added: boolean }> {
    const view = await this.client.get<{ layoutxml: string; fetchxml: string }>(
      `api/data/v9.2/savedqueries(${viewId})?$select=layoutxml,fetchxml`,
    );
    let layoutxml = view.layoutxml ?? '';
    let fetchxml = view.fetchxml ?? '';

    // No-op if already present.
    if (layoutxml.toLowerCase().includes(`name="${attributeName.toLowerCase()}"`)) {
      return { added: false };
    }

    // Locate the reference cell.
    const escapedRef = relativeToField.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cellRegex = new RegExp(`<cell\\s+name="${escapedRef}"[^/]*/\\s*>`, 'i');
    const cellMatch = layoutxml.match(cellRegex);
    if (!cellMatch) {
      throw new Error(
        `Reference column '${relativeToField}' was not found in view ${viewId} — cannot position '${attributeName}' relative to it.`,
      );
    }

    const newCell = `<cell name="${attributeName}" width="${width}" />`;
    const replacement = position === 'before' ? `${newCell}${cellMatch[0]}` : `${cellMatch[0]}${newCell}`;
    layoutxml = layoutxml.replace(cellMatch[0], replacement);

    // Add the attribute to fetchxml (display order is layout's job, not fetch's).
    const entityCloseIdx = fetchxml.indexOf('</entity>');
    if (entityCloseIdx === -1) {
      throw new Error('Could not find </entity> in fetchxml.');
    }
    fetchxml = fetchxml.substring(0, entityCloseIdx)
      + `<attribute name="${attributeName}" />`
      + fetchxml.substring(entityCloseIdx);

    await this.client.patch(`api/data/v9.2/savedqueries(${viewId})`, { layoutxml, fetchxml });
    await this.publishEntity(entityLogicalName);
    return { added: true };
  }

  /**
   * Remove a column from a view.
   *
   * @param viewId The savedquery GUID
   * @param attributeName The logical name of the attribute to remove
   * @param entityLogicalName Used only for publishing
   */
  async removeViewColumn(viewId: string, attributeName: string, entityLogicalName: string): Promise<{ removed: boolean }> {
    const view = await this.client.get<{ layoutxml: string; fetchxml: string }>(
      `api/data/v9.2/savedqueries(${viewId})?$select=layoutxml,fetchxml`,
    );
    let layoutxml = view.layoutxml ?? '';
    let fetchxml = view.fetchxml ?? '';

    // Prevent removing the last column — Dataverse rejects an empty <row>.
    const currentCols = this.parseLayoutColumns(layoutxml);
    if (currentCols.length <= 1) {
      throw new Error(`Cannot remove '${attributeName}' — it is the only column on the view. Dataverse requires at least one column.`);
    }

    const escaped = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cellRegex = new RegExp(`<cell\\s+name="${escaped}"[^/]*/\\s*>`, 'i');
    const attrRegex = new RegExp(`<attribute\\s+name="${escaped}"[^/]*/\\s*>`, 'i');

    const newLayout = layoutxml.replace(cellRegex, '');
    const newFetch = fetchxml.replace(attrRegex, '');

    if (newLayout === layoutxml && newFetch === fetchxml) {
      return { removed: false };
    }

    await this.client.patch(`api/data/v9.2/savedqueries(${viewId})`, { layoutxml: newLayout, fetchxml: newFetch });
    await this.publishEntity(entityLogicalName);

    return { removed: true };
  }

  /**
   * Replace the entire column set of a view.
   * This is the safest way to reconfigure view columns — it rewrites both layoutxml
   * and fetchxml in one operation, preserving filters and ordering.
   *
   * @param viewId The savedquery GUID
   * @param columns Array of { name: string, width?: number } in display order
   * @param entityLogicalName Used for publishing and for fetchxml entity name
   * @param orderBy Optional attribute to sort by (default: first column ascending)
   * @param orderDescending Sort descending (default false)
   */
  async setViewColumns(
    viewId: string,
    columns: { name: string; width?: number }[],
    entityLogicalName: string,
    orderBy?: string,
    orderDescending: boolean = false,
  ): Promise<{ columns: string[] }> {
    if (columns.length === 0) {
      throw new Error('At least one column is required.');
    }

    // Read current view to preserve the <grid> attributes (object, jump, etc.)
    const view = await this.client.get<{ layoutxml: string; fetchxml: string }>(
      `api/data/v9.2/savedqueries(${viewId})?$select=layoutxml,fetchxml`,
    );
    const currentLayout = view.layoutxml ?? '';

    // Extract the <grid ...> opening tag to preserve object, jump, select, icon, preview attributes.
    const gridMatch = currentLayout.match(/<grid\s[^>]+>/i);
    const gridOpen = gridMatch ? gridMatch[0] : '<grid name="resultset" select="1" icon="1" preview="1">';

    // Extract the row id attribute (usually the entity's primary key).
    const rowIdMatch = currentLayout.match(/id="([^"]+)"/i);
    const rowId = rowIdMatch ? rowIdMatch[1] : `${entityLogicalName}id`;

    // Build layoutxml
    const cells = columns.map(c => `<cell name="${c.name}" width="${c.width ?? 150}" />`).join('');
    const layoutxml = `${gridOpen}<row name="result" id="${rowId}">${cells}</row></grid>`;

    // Build fetchxml — preserve existing filters from the current fetchxml.
    const currentFetch = view.fetchxml ?? '';

    // Extract everything between <entity ...> and </entity> that is NOT an <attribute> or <order> element.
    const entityContentMatch = currentFetch.match(/<entity\s+name="[^"]*">([\s\S]*)<\/entity>/i);
    let preservedContent = '';
    if (entityContentMatch) {
      // Remove existing <attribute> and <order> elements, keep <filter>, <link-entity>, etc.
      preservedContent = entityContentMatch[1]
        .replace(/<attribute\s+name="[^"]*"\s*\/>/gi, '')
        .replace(/<order\s[^/]*\/>/gi, '')
        .trim();
    }

    const attrs = columns.map(c => `<attribute name="${c.name}" />`).join('');
    const pkAttr = `<attribute name="${rowId}" />`;
    const sortAttr = orderBy ?? columns[0].name;
    const order = `<order attribute="${sortAttr}" descending="${orderDescending}" />`;
    const fetchxml = `<fetch version="1.0" output-format="xml-platform" mapping="logical"><entity name="${entityLogicalName}">${attrs}${pkAttr}${order}${preservedContent ? preservedContent : ''}</entity></fetch>`;

    await this.client.patch(`api/data/v9.2/savedqueries(${viewId})`, { layoutxml, fetchxml });
    await this.publishEntity(entityLogicalName);

    return { columns: columns.map(c => c.name) };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async publishEntity(entityLogicalName: string): Promise<void> {
    await this.client.post(
      'api/data/v9.2/PublishXml',
      { ParameterXml: `<importexportxml><entities><entity>${entityLogicalName}</entity></entities></importexportxml>` },
    );
  }
}
