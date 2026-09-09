#!/usr/bin/env node
/** Spustitelný vstupní bod. Vlastní logika je v cli.ts, aby šla testovat bez vedlejších efektů. */
import { hlavni } from './cli.js';

process.exitCode = await hlavni(process.argv.slice(2));
