import { fileURLToPath } from 'url'
import path from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
console.log(__dirname)
console.log(__filename);
console.log(process.cwd());
console.log(import.meta.url);
console.log(import.meta.dirname);
console.log(import.meta.filename);
