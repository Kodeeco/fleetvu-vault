/**
 * SWC minify has corrupted Radix Progress template literals (nested backticks)
 * into invalid JS on production. Rewrite those helpers to plain concatenation.
 * Runs on postinstall so Netlify Linux builds get the same fix.
 */
const fs = require('fs');
const path = require('path');

const targets = [
  'node_modules/@radix-ui/react-progress/dist/index.mjs',
  'node_modules/@radix-ui/react-progress/dist/index.js',
];

const maxFn = `function getInvalidMaxError(propValue, componentName) {
  return "Invalid prop 'max' of value '" + propValue + "' supplied to '" + componentName + "'. Only numbers greater than 0 are valid max values. Defaulting to '" + DEFAULT_MAX + "'.";
}`;

const valueFn = `function getInvalidValueError(propValue, componentName) {
  return "Invalid prop 'value' of value '" + propValue + "' supplied to '" + componentName + "'. The 'value' prop must be a positive number <= max (default " + DEFAULT_MAX + "), or null/undefined if indeterminate. Defaulting to null.";
}`;

for (const rel of targets) {
  const file = path.join(process.cwd(), rel);
  if (!fs.existsSync(file)) {
    console.log('skip missing', rel);
    continue;
  }
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  src = src.replace(
    /function getInvalidMaxError\(propValue, componentName\) \{[\s\S]*?\n\}/,
    maxFn
  );
  src = src.replace(
    /function getInvalidValueError\(propValue, componentName\) \{[\s\S]*?\n\}/,
    valueFn
  );
  if (src !== before) {
    fs.writeFileSync(file, src);
    console.log('patched', rel);
  } else if (src.includes(maxFn)) {
    console.log('already patched', rel);
  } else {
    console.log('WARN: pattern not found', rel);
  }
}
