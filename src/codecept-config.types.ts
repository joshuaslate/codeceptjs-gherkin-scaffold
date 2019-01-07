export type GherkinConfig = {
  features: string,
  steps: string[],
};

export type CodeceptConfig = {
  gherkin: GherkinConfig,
};
