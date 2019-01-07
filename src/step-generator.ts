import * as path from 'path';
import * as fs from 'fs';

import { VSCodeWindow } from './vscode.interface';
import { StepExistsError } from './errors/step-exists-error';
import { ensureFile, getFilesRecursively, getFile } from './utils/fs-utils';
import { StepTransformer } from './step-transformer';
import { CodeceptConfig } from './codecept-config.types';

export class StepGenerator {
  private readonly featureExtension = '.feature';
  private readonly extension = '.js';
  private readonly stepNamingScheme = '-steps';
  private readonly wildcardDir = '**/';
  private readonly wildcardFile = `*${this.featureExtension}`;

  constructor(
    private stepDefinitionRoot: string,
    private resolvedStepDefinitionRoot: string,
    private featureDefinitionRoot: string,
    private featurePath: string,
    private codeceptConfigPath: string,
    private window: VSCodeWindow,
  ) {}

  private getFeatureName(featurePath: string): string {
    return path.basename(featurePath, this.featureExtension);
  }

  private getFeaturePathRoot(): string {
    return this.featureDefinitionRoot
      .split(this.wildcardDir)
      .join('')
      .split(this.wildcardFile)
      .join('');
  }

  private getRelativeFeaturePath(featurePath: string): string {
    const base = this.getFeaturePathRoot();

    return featurePath.substr(base.length);
  }

  private getStepPath(featurePath: string): string {
    const relativePath = this.getRelativeFeaturePath(featurePath).replace(this.featureExtension, `${this.stepNamingScheme}${this.extension}`);
    return path.resolve(this.resolvedStepDefinitionRoot, relativePath);
  }

  private async marshalFeatureToStep(stepPath: string, featurePath: string): Promise<boolean> {
    try {
      // Ensure the file and parent directories exists
      await ensureFile(stepPath);

      const succeeded: boolean = await new Promise((resolve, reject) => {
        // Open a read stream from the feature
        const readStream = fs.createReadStream(featurePath);
        const stepsFile = fs.createWriteStream(stepPath);
        const transformer = new StepTransformer();

        readStream
          .pipe(transformer.transformer)
          .pipe(stepsFile)
          .on('finish', () => {
            resolve(true);
          })
          .on('error', err => {
            console.error(err);
            reject(false);
          });        
      });

      return succeeded;
    } catch (err) {
      return false;
    }
  }

  private async updateCodeceptConfig(...newStepsPaths: string[]): Promise<boolean> {
    const usablePaths = newStepsPaths.reduce((accum: string[], stepPath: string) => {
      if (stepPath) {
        const fileName = path.basename(stepPath);
        const directory = path.dirname(stepPath);
        const cleanStepPath = this.stepDefinitionRoot.split(path.sep).filter(x => x && x !== '.').join(path.sep);
        const extraPath = directory.split(cleanStepPath).pop() || '';
        const finalPath = path.join(this.stepDefinitionRoot, extraPath, fileName);

        accum.push(`${this.stepDefinitionRoot.startsWith(`.${path.sep}`) ? `.${path.sep}` : ''}${finalPath}`);
      }

      return accum;
    }, []);

    const succeeded: boolean = await new Promise(async (resolve, reject) => {
      try {
        const configFile = await getFile(this.codeceptConfigPath);
        const newConfig: CodeceptConfig = JSON.parse(configFile);
        newConfig.gherkin.steps = [...newConfig.gherkin.steps, ...usablePaths];

        const codeceptConfigWriter = fs.createWriteStream(this.codeceptConfigPath);
        codeceptConfigWriter.once('open', () => {
          codeceptConfigWriter.write(JSON.stringify(newConfig, null, 4));
          codeceptConfigWriter.end();
          resolve(true);
        });
      } catch (err) {
        reject(err);
      }
    });

    return succeeded;
  }

  public async execute(featurePath: string = this.featurePath, isAll: boolean): Promise<string> {
    try {
      const newStepPath = await this.create(featurePath);

      if (!isAll && newStepPath) {
        await this.updateCodeceptConfig(newStepPath);
      }

      this.window.showInformationMessage(`Steps Definition: '${this.getFeatureName(featurePath)}' successfully created.`);
      return newStepPath;
    } catch (err) {
      if (err instanceof StepExistsError) {
        this.window.showErrorMessage(`Steps Definition: '${featurePath}' already exists`);
      } else {
        this.window.showErrorMessage(`Error: ${err.message}`);
      }

      return '';
    }
  }

  // Find all features and ensure a step definition exists for all of them
  public async executeAll() {
    const files = await getFilesRecursively(this.getFeaturePathRoot());
    const generatedSteps = await Promise.all(files.map(file => this.execute(file, true)));
    await this.updateCodeceptConfig(...generatedSteps);
  }

  private async create(featurePath: string): Promise<string> {
    if (!featurePath || !featurePath.includes(this.featureExtension)) {
      throw new Error('You do not have a feature file open, please open a .feature file and re-run the command.');
    }

    const stepPath = this.getStepPath(featurePath);

    if (fs.existsSync(stepPath)) {
      throw new StepExistsError(`'${stepPath}' already exists`);
    }

    const writeSucceeded = await this.marshalFeatureToStep(stepPath, featurePath);

    if (!writeSucceeded) {
      throw new Error(`Failed to generate a steps file at ${stepPath}`);
    }

    return stepPath;
  }
}
