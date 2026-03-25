#!/usr/bin/env node
/**
 * Validate sub-agent JSON output against a JSON Schema using Ajv.
 * Checks types, enums, required fields, numeric bounds, additionalProperties, etc.
 * Use before accepting any sub-agent output (orchestrator step gate).
 *
 * Usage: node migration-work/navigation-validation/scripts/validate-output.js <path-to-output.json> <path-to-schema.json>
 * Exit: 0 if valid, 1 if invalid (errors to stderr).
 */

import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node validate-output.js <output.json> <schema.json>');
    process.exit(1);
  }
  const outputPath = path.resolve(args[0]);
  const schemaPath = path.resolve(args[1]);
  if (!fs.existsSync(outputPath)) {
    console.error('Error: output file not found:', outputPath);
    process.exit(1);
  }
  if (!fs.existsSync(schemaPath)) {
    console.error('Error: schema file not found:', schemaPath);
    process.exit(1);
  }
  let data, schema;
  try {
    data = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  } catch (e) {
    console.error('Error: invalid JSON in output:', e.message);
    process.exit(1);
  }
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (e) {
    console.error('Error: invalid JSON in schema:', e.message);
    process.exit(1);
  }

  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    console.error('Validation FAILED:');
    for (const err of validate.errors) {
      const loc = err.instancePath || '';
      console.error(`  ${loc ? loc + ': ' : ''}${err.message}${err.params ? ' ' + JSON.stringify(err.params) : ''}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main();
