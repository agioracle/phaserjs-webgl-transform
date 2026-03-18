import * as fs from 'node:fs';
import * as path from 'node:path';
import inquirer from 'inquirer';
import { generateFullTemplate } from '../templates/full.js';

interface NewOptions {
  template: string;
}

export async function newCommand(
  projectName: string,
  options: NewOptions
): Promise<void> {
  const targetDir = path.resolve(process.cwd(), projectName);

  // Guard: directory already exists
  if (fs.existsSync(targetDir)) {
    console.error(`\n❌ Directory "${projectName}" already exists.`);
    process.exit(1);
    return;
  }

  // Prompt for project configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'appid',
      message: 'WeChat Mini-Game AppID:',
      validate: (input: string) => {
        if (!input.startsWith('wx')) return 'AppID must start with "wx"';
        return true;
      },
    },
    {
      type: 'list',
      name: 'orientation',
      message: 'Screen orientation:',
      choices: ['landscape', 'portrait'],
    },
    {
      type: 'input',
      name: 'cdn',
      message: 'CDN base URL for remote assets:',
      validate: (input: string) => {
        try {
          const url = new URL(input);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return 'CDN URL must start with http:// or https://';
          }
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
  ]);

  // Generate template files
  const files = generateFullTemplate({
    projectName,
    appid: answers.appid,
    orientation: answers.orientation,
    cdn: answers.cdn,
  });

  // Write all files
  for (const [relPath, content] of files) {
    const fullPath = path.join(targetDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  console.log(`\n✅ Created project "${projectName}"!\n`);
  console.log(`Next steps:\n`);
  console.log(`  cd ${projectName}`);
  console.log(`  npm install`);
  console.log(`  npm run dev`);
  console.log(`  phaser-wx build\n`);
}
