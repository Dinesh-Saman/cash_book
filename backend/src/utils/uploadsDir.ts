import fs from 'fs';
import path from 'path';

export function createUploadsDir() {
  const dir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
