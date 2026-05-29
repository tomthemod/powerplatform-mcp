import { readFile } from 'node:fs/promises';

/**
 * Resolve binary content from either inline base64 (`content`) or an on-disk
 * file path (`filePath`). The `filePath` form avoids forcing the caller
 * (typically a model) to regenerate the entire file contents in its output
 * just to upload it — large web resources, plugin assemblies (.dll) and
 * plugin packages (.nupkg) are read straight from disk and base64-encoded
 * server-side. Exactly one of the two must be set.
 *
 * When `content` is supplied it MUST be a valid base64 string. Otherwise the
 * Dataverse PATCH succeeds silently but Dataverse stores raw garbage that
 * later fails to decode (e.g. "Encodage de fichier non pris en charge" in
 * the maker portal for a corrupted web resource, or an unloadable assembly
 * at plugin invocation time). Reject up-front so the failure surfaces here.
 */
export async function resolveBinaryContent(input: {
  content?: string;
  filePath?: string;
}): Promise<string> {
  const hasContent = typeof input.content === 'string' && input.content.length > 0;
  const hasFilePath = typeof input.filePath === 'string' && input.filePath.length > 0;
  if (hasContent && hasFilePath) {
    throw new Error("Provide either 'content' (base64) or 'filePath' — not both.");
  }
  if (!hasContent && !hasFilePath) {
    throw new Error("One of 'content' (base64) or 'filePath' is required.");
  }
  if (hasContent) {
    const raw = input.content as string;
    assertValidBase64(raw);
    return raw;
  }
  const buf = await readFile(input.filePath as string);
  return buf.toString('base64');
}

/**
 * Verify that `value` is a syntactically valid base64 string AND that the
 * decoded bytes round-trip exactly. Node's Buffer.from(_, 'base64') silently
 * skips invalid characters, which is how the `}},name: "..."` JSON tail of a
 * mis-pasted previous tool result got uploaded as-is to Dataverse. Re-encoding
 * and comparing catches that case.
 */
function assertValidBase64(value: string): void {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error(
      "'content' is not a valid base64 string (contains non-base64 characters). " +
      "Prefer 'filePath' to upload the file directly from disk — this avoids " +
      "having to emit and round-trip a multi-KB base64 payload in the model output."
    );
  }
  const decoded = Buffer.from(value, 'base64');
  const reencoded = decoded.toString('base64');
  if (reencoded !== value.replace(/=+$/, '').padEnd(reencoded.length, '=')) {
    // Tolerate trailing padding differences but reject true mismatches.
    if (reencoded.replace(/=+$/, '') !== value.replace(/=+$/, '')) {
      throw new Error(
        "'content' did not round-trip as base64 — looks corrupted. Use 'filePath' instead."
      );
    }
  }
}
