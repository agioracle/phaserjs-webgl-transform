import * as fs from 'node:fs';
import * as path from 'node:path';
import inquirer from 'inquirer';

interface NewOptions {
  template: string;
}

/**
 * Walk up from `startDir` until we find a directory containing `pnpm-workspace.yaml`.
 */
function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        'Could not find monorepo root (no pnpm-workspace.yaml found). ' +
          'phaser-wx new must be run within the monorepo.'
      );
    }
    dir = parent;
  }
}

/**
 * Filter function for fs.cpSync — excludes node_modules, dist-wx, .DS_Store, package-lock.json.
 */
function copyFilter(src: string): boolean {
  const basename = path.basename(src);
  if (
    basename === 'node_modules' ||
    basename === 'dist-wx' ||
    basename === '.DS_Store' ||
    basename === 'package-lock.json'
  ) {
    return false;
  }
  return true;
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

  // Locate example directory from monorepo root
  const monorepoRoot = findMonorepoRoot(__dirname);
  const exampleDir = path.join(monorepoRoot, 'example');

  if (!fs.existsSync(exampleDir)) {
    console.error(`\n❌ Example directory not found at "${exampleDir}".`);
    process.exit(1);
    return;
  }

  // Copy example directory to target, excluding unwanted files
  fs.cpSync(exampleDir, targetDir, { recursive: true, filter: copyFilter });

  // Replace parameterized values in copied files
  // 1. package.json — replace "name" field
  const pkgPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg.name = projectName;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  // 2. phaser-wx.config.json — replace appid, orientation, cdn
  const configPath = path.join(targetDir, 'phaser-wx.config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config.appid = answers.appid;
    config.orientation = answers.orientation;
    config.cdn = answers.cdn;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  }

  // 3. README.md — replace first-line title with project name
  const readmePath = path.join(targetDir, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf-8');
    const updatedReadme = readmeContent.replace(/^# .+/, `# ${projectName}`);
    fs.writeFileSync(readmePath, updatedReadme);
  }

  console.log(`\n✅ Created project "${projectName}"!\n`);
  console.log(`Next steps:\n`);
  console.log(`  cd ${projectName}`);
  console.log(`  npm install`);
  console.log(`  npm run dev`);
  console.log(`  phaser-wx build\n`);
}
