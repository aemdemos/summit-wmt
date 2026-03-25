/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * Fetches the helix-importer.js library from the helix-importer-ui repository.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const resp = await fetch('https://raw.githubusercontent.com/adobe/helix-importer-ui/main/js/dist/helix-importer.js');

  if (!resp.ok) {
    throw new Error(`Failed to fetch helix-importer.js: ${resp.status} ${resp.statusText}`);
  }

  const text = await resp.text();

  // Write to both locations which require a copy of this file
  const helixImporterDestinations = [
    path.join(__dirname, '..', 'inject'),
    path.join(__dirname, '..', '..', '..', '..', 'skills', 'excat-content-import', 'scripts', 'static', 'inject'),
  ];

  for (const destination of helixImporterDestinations) {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    fs.writeFileSync(path.join(destination, 'helix-importer.js'), text);
    console.log(`Successfully wrote helix-importer.js to ${destination}`);
  }
} catch (e) {
  console.error('Failed to fetch helix-importer.js', e);
  process.exit(1);
}
