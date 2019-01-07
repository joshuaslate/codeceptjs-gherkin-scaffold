import * as path from 'path';
import * as NodeCache from 'node-cache';
import * as fs from 'fs';
import { InputBoxOptions } from 'vscode';
import { useNodeCacheAdapter, Cacheable, CacheClear } from 'type-cacheable';

import { VSCodeWindow } from './vscode.interface';
import { IDisposable } from './disposable.interface';
import { CodeceptConfig, GherkinConfig } from './codecept-config.types';
import { getFile, doesFileExist, canWriteFile, getAbsolutePath } from './utils/fs-utils';
import { StepGenerator } from './step-generator';

const CACHE_KEYS = {
  CODECEPT_CONFIG_LOCATION: 'codecept_config_location',
  FEATURES_DEFINITION_ROOT: 'feature_definitions_root',
  GHERKIN_CONFIG: 'gherkin_config',
  STEP_DEFINITIONS_ROOT: 'step_definitions_root',
};

export class CodeceptContext implements IDisposable {
  private readonly defaultConfigFile = 'codecept.json';
  private cacheClient: NodeCache;
  private codeceptConfigPath: string = '';

  constructor(
    private workspaceRoot: string,
    private window: VSCodeWindow
  ) {
    this.cacheClient = new NodeCache();
    useNodeCacheAdapter(this.cacheClient);
  }

  @Cacheable({ cacheKey: args => args[0], hashKey: CACHE_KEYS.GHERKIN_CONFIG })
  private async getGherkinConfig(workspaceRoot: string): Promise<GherkinConfig> {
    let configPath: string;
    let configFile: string;
    // Try to find configuration automatically
    try {
      configPath = path.resolve(workspaceRoot, this.defaultConfigFile);
      configFile = await getFile(configPath);
    } catch (err) {
      const userGivenConfigFile = await this.promptForCodeceptConfigPath();
      configPath = getAbsolutePath(userGivenConfigFile || '', workspaceRoot);
      configFile = await getFile(configPath);
    }

    this.watchForCodeceptChanges(configPath);
    this.codeceptConfigPath = configPath;

    const codeceptConfig: CodeceptConfig = JSON.parse(configFile);
    return codeceptConfig.gherkin;
  }

  private watchForCodeceptChanges(configPath: string) {
    fs.watch(configPath, async (event, filename) => {
      if (filename) {
        await Promise.all([
          this.clearCachedGherkinConfig(this.workspaceRoot, configPath),
          this.clearCachedStepDefinitionsRoot(this.workspaceRoot),
          this.clearCachedFeatureDefinitionsRoot(this.workspaceRoot),
        ]);
      }
    });
  }

  @CacheClear({ cacheKey: args => args[0], hashKey: CACHE_KEYS.GHERKIN_CONFIG })
  private async clearCachedGherkinConfig(workspaceRoot: string, configPath: string) {
    console.log(`Gherkin config at ${configPath} refreshed.`);
  }

  @CacheClear({ cacheKey: args => args[0], hashKey: CACHE_KEYS.STEP_DEFINITIONS_ROOT })
  private async clearCachedStepDefinitionsRoot(workspaceRoot: string) {
    console.log('Root step definitions path refreshed.');
  }

  @Cacheable({ cacheKey: args => args[0], hashKey: CACHE_KEYS.FEATURES_DEFINITION_ROOT })
  private async clearCachedFeatureDefinitionsRoot(workspaceRoot: string) {
    console.log('Feature definitions path refreshed.');
  }

  private async promptForCodeceptConfigPath(): Promise<string | undefined> {
    // this can be abstracted out as an argument for prompt
    const options: InputBoxOptions = {
      ignoreFocusOut: true,
      prompt: `Path to Codecept config file (typically codecept.json) relative to ${this.workspaceRoot}, or an absolute path.`,
      placeHolder: 'codecept.json',
      validateInput: this.validateCodeceptConfigPath(this.workspaceRoot),
    };

    return await this.window.showInputBox(options);
  }

  private validateCodeceptConfigPath(workspaceRoot: string) {
    return async (configPath: string): Promise<string | null> => {
      if (!configPath) {
        return 'Path to Codecept config is required';
      }
  
      const givenPath = getAbsolutePath(configPath, workspaceRoot);

      const [ fileExists, canWrite ] = await Promise.all([doesFileExist(givenPath), canWriteFile((givenPath))]);

  
      if (!fileExists) {
        return `File at ${givenPath} does not exist. Please create it.`;
      }
  
      if (!canWrite) {
        return `File at ${givenPath} is not writable. Please review its permissions.`;
      }
  
      // no errors
      return null;
    };
  }

  private async promptForStepDefinitionsPath(guess: string): Promise<string | undefined> {
    // this can be abstracted out as an argument for prompt
    const options: InputBoxOptions = {
      ignoreFocusOut: true,
      prompt: `Path to Gherkin step definition JavaScript files relative to ${this.workspaceRoot}, or an absolute path.`,
      value: guess,
    };

    return await this.window.showInputBox(options);
  }

  @Cacheable({ cacheKey: args => args[0], hashKey: CACHE_KEYS.STEP_DEFINITIONS_ROOT })
  private async getStepDefinitionsRoot(workspaceRoot: string): Promise<string> {
    const gherkinConfig = await this.getGherkinConfig(workspaceRoot);
    // Remove the filenames
    const directories = gherkinConfig.steps.map(stepPath => path.dirname(stepPath));
    // Find the shortest path
    const shortestPath = directories.reduce((accum, curr) => {
      if (!accum || curr.length <= accum.length) {
        return curr;
      }

      return accum;
    });

    let stepDefinitionRootGuess = '';

    for (let i = 0; i < shortestPath.length; ++i) {
      if (directories.every(directory => directory[i] === directories[0][i])) {
        stepDefinitionRootGuess += directories[0][i];
      }
    }

    const stepDefinitionsRoot = await this.promptForStepDefinitionsPath(stepDefinitionRootGuess);

    return stepDefinitionsRoot || '';
  }

  @Cacheable({ cacheKey: args => args[0], hashKey: CACHE_KEYS.FEATURES_DEFINITION_ROOT })
  private async getFeatureDefinitionRoot(workspaceRoot: string): Promise<string> {
    const gherkinConfig = await this.getGherkinConfig(workspaceRoot);
    return path.resolve(workspaceRoot, gherkinConfig.features);
  }

  public async getStepGenerator(featurePath?: string): Promise<StepGenerator> {
    const [
      stepDefinitionRoot,
      featureDefinitionRoot,
    ] = await Promise.all([
      this.getStepDefinitionsRoot(this.workspaceRoot),
      this.getFeatureDefinitionRoot(this.workspaceRoot),
    ]);

    const resolvedStepDefinitionRoot = path.resolve(this.workspaceRoot, stepDefinitionRoot);

    return new StepGenerator(stepDefinitionRoot, resolvedStepDefinitionRoot, featureDefinitionRoot, featurePath || '', this.codeceptConfigPath, this.window);
  }

  public async dispose(): Promise<void> {}
}