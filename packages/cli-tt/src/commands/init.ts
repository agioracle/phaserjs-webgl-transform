import * as fs from 'node:fs';
import * as path from 'node:path';
import inquirer from 'inquirer';

interface InitAnswers {
  appid: string;
  orientation: 'portrait' | 'landscape';
  cdn: string;
  entry: string;
  assetsDir: string;
  outputDir: string;
}

export async function initCommand(): Promise<void> {
  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: 'input',
      name: 'appid',
      message: 'Douyin Mini-Game AppID:',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'AppID is required';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'orientation',
      message: 'Screen orientation:',
      choices: ['portrait', 'landscape'],
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
    {
      type: 'input',
      name: 'entry',
      message: 'Entry file path:',
      default: 'src/main.js',
    },
    {
      type: 'input',
      name: 'assetsDir',
      message: 'Assets directory:',
      default: 'public/assets',
    },
    {
      type: 'input',
      name: 'outputDir',
      message: 'Output directory:',
      default: 'dist-tt',
    },
  ]);

  const config = {
    appid: answers.appid,
    orientation: answers.orientation,
    cdn: answers.cdn,
    entry: answers.entry,
    assets: {
      dir: answers.assetsDir,
    },
    output: {
      dir: answers.outputDir,
    },
  };

  const configPath = path.join(process.cwd(), 'phaser-tt.config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`\n✅ Created phaser-tt.config.json`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review the config file: phaser-tt.config.json`);
  console.log(`  2. Run "phaser-tt build" to build your Mini-Game`);
}
