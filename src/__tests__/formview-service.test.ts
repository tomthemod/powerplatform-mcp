import { describe, it, expect, vi } from 'vitest';
import { FormViewService } from '../services/formview-service.js';
import type { PowerPlatformClient } from '../powerplatform-client.js';

const FORM_ID = '00000000-0000-0000-0000-000000000001';
const ENTITY = 'opportunity';

function buildFormXml(fields: string[]): string {
  const rows = fields
    .map(
      (f) =>
        `<row><cell id="{00000000-0000-0000-0000-00000000c${f.length.toString().padStart(3, '0')}}" showlabel="true" locklevel="0"><labels><label description="${f}" languagecode="1033" /></labels><control id="${f}" classid="{4273EDBD-AC1D-40d3-9FB2-095C621B552D}" datafieldname="${f}" /></cell></row>`,
    )
    .join('');
  return `<form><tabs><tab><columns><column><sections><section><rows>${rows}</rows></section></sections></column></columns></tab></tabs></form>`;
}

interface MockClient {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
}

function buildClient(formxml: string): MockClient {
  const client: MockClient = {
    get: vi.fn(async (endpoint: string) => {
      if (endpoint.includes('?$select=name,ismanaged,iscustomizable')) {
        return { name: 'Test Form', ismanaged: false, iscustomizable: { Value: true } };
      }
      if (endpoint.includes('?$select=formxml')) {
        return { formxml };
      }
      if (endpoint.startsWith('api/data/v9.2/EntityDefinitions')) {
        return {
          AttributeType: 'String',
          AttributeTypeName: { Value: 'StringType' },
          LogicalName: endpoint.match(/Attributes\(LogicalName='([^']+)'\)/)?.[1] ?? 'unknown',
        };
      }
      throw new Error(`Mock client: unexpected GET ${endpoint}`);
    }),
    patch: vi.fn(async () => undefined),
    post: vi.fn(async () => undefined),
  };
  return client;
}

function makeService(client: MockClient): FormViewService {
  return new FormViewService(client as unknown as PowerPlatformClient);
}

describe('FormViewService.removeFormField', () => {
  it('removes only the target row when the target is the 4th of 7 contiguous rows (sc-466 regression)', async () => {
    const xml = buildFormXml(['field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7']);
    const client = buildClient(xml);
    const svc = makeService(client);

    const result = await svc.removeFormField(FORM_ID, 'field4', ENTITY);

    expect(result).toEqual({ removed: true });
    expect(client.patch).toHaveBeenCalledOnce();
    const patchBody = client.patch.mock.calls[0][1] as { formxml: string };
    const patchedXml = patchBody.formxml;

    // The target row must be gone.
    expect(patchedXml).not.toContain('datafieldname="field4"');

    // All other rows must be preserved — this is the specific assertion against the original bug,
    // where field1/field2/field3 were also wiped out alongside field4.
    for (const survivor of ['field1', 'field2', 'field3', 'field5', 'field6', 'field7']) {
      expect(patchedXml).toContain(`datafieldname="${survivor}"`);
    }

    // Exactly 6 rows remain.
    const rowCount = (patchedXml.match(/<row\b/gi) ?? []).length;
    expect(rowCount).toBe(6);
  });

  it('returns { removed: false } and does not PATCH when the field is not on the form', async () => {
    const xml = buildFormXml(['field1', 'field2', 'field3']);
    const client = buildClient(xml);
    const svc = makeService(client);

    const result = await svc.removeFormField(FORM_ID, 'nonexistent_field', ENTITY);

    expect(result).toEqual({ removed: false });
    expect(client.patch).not.toHaveBeenCalled();
  });

  it('removes the row when the target is the only field on the form', async () => {
    const xml = buildFormXml(['only_field']);
    const client = buildClient(xml);
    const svc = makeService(client);

    const result = await svc.removeFormField(FORM_ID, 'only_field', ENTITY);

    expect(result).toEqual({ removed: true });
    const patchBody = client.patch.mock.calls[0][1] as { formxml: string };
    expect(patchBody.formxml).not.toContain('datafieldname="only_field"');
    expect((patchBody.formxml.match(/<row\b/gi) ?? []).length).toBe(0);
  });
});

describe('FormViewService.addFormFieldRelative', () => {
  it('inserts the new row immediately before the 4th of 7 contiguous rows (sc-466 mirror case)', async () => {
    const xml = buildFormXml(['field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7']);
    const client = buildClient(xml);
    const svc = makeService(client);

    const result = await svc.addFormFieldRelative(FORM_ID, 'newField', 'field4', 'before', ENTITY);

    expect(result).toEqual({ added: true });
    const patchBody = client.patch.mock.calls[0][1] as { formxml: string };
    const patchedXml = patchBody.formxml;

    // 8 rows total (7 original + 1 new).
    expect((patchedXml.match(/<row\b/gi) ?? []).length).toBe(8);

    // Critical: newField must appear between field3's row and field4's row, not somewhere upstream.
    // Walk row by row in order — the sequence must be field1, field2, field3, newField, field4, ...
    const orderedFields = [...patchedXml.matchAll(/datafieldname="([^"]+)"/g)].map((m) => m[1]);
    expect(orderedFields).toEqual(['field1', 'field2', 'field3', 'newField', 'field4', 'field5', 'field6', 'field7']);
  });

  it('throws when the reference field is not on the form', async () => {
    const xml = buildFormXml(['field1', 'field2']);
    const client = buildClient(xml);
    const svc = makeService(client);

    await expect(svc.addFormFieldRelative(FORM_ID, 'newField', 'nonexistent', 'before', ENTITY)).rejects.toThrow(
      /Reference field 'nonexistent' was not found/,
    );
    expect(client.patch).not.toHaveBeenCalled();
  });
});
