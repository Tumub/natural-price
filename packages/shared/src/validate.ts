import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

/**
 * The outbound payload contract, docs/payload-schema.json, enforced at the
 * door. `additionalProperties: false` in the schema means any field the
 * extension starts sending without a PRIVACY.md change is rejected here.
 */
const schemaPath = join(import.meta.dirname, '..', '..', '..', 'docs', 'payload-schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateFn = ajv.compile(schema);

export function validateCheckBody(body: unknown): { ok: true } | { ok: false; errors: string[] } {
  if (validateFn(body)) return { ok: true };
  return { ok: false, errors: (validateFn.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) };
}
