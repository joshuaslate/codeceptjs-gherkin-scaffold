import { Transform } from 'stream';

export class StepTransformer {
  static TOKENS: { [key: string]: string } = {
    FEATURE: 'Feature:',
    SCENARIO: 'Scenario:',
    GIVEN: 'Given',
    WHEN: 'When',
    THEN: 'Then',
    AND: 'And',
  };

  private previousToken: string = '';
  private inScenario: string = '';
  private scenarioBlockEnd = '});\n\n';
  public transformer: Transform = new Transform({
    transform: (chunk, encoding, callback) => {
      try {
        const lines = chunk.toString().split('\n');

        if (lines.length) {
          const builtChunk: string[] = [];

          lines.forEach(line => {
            builtChunk.push(this.getTokenStepCode(line));
          });

          if (this.inScenario) {
            builtChunk.push(this.scenarioBlockEnd);
          }

          callback(null, builtChunk.join(''));
        } else {
          callback(null, lines);
        }
      } catch (err) {
        callback(err);
      }
    }
  });

  private findToken = (line: string): string => {
    const lineStart = line.trimLeft().split(' ')[0];
    const tokenKeys = Object.keys(StepTransformer.TOKENS);
    let currentToken = '';

    for (const token of tokenKeys) {
      if (lineStart === StepTransformer.TOKENS[token]) {
        currentToken = StepTransformer.TOKENS[token];
        break;
      }
    }

    if (currentToken && currentToken === StepTransformer.TOKENS.AND) {
      currentToken = this.previousToken;
    }

    return currentToken;
  }

  private findDescription = (line: string, token: string): string => {
    const [ _, ...rest ] = line.trimLeft().split(' ');

    return (rest || []).join(' ');
  }

  public getTokenStepCode = (line: string): string => {
    const token = this.findToken(line);
    const description = this.findDescription(line, token);
    const indent = this.inScenario ? '  ' : '';
    this.previousToken = token;

    switch (token) {
      case StepTransformer.TOKENS.FEATURE:
        return `/* ${line} */\n`;
      case StepTransformer.TOKENS.SCENARIO:
        const scenarioBlockStart = `Scenario('${description}', (I) => {\n`;

        if (this.inScenario) {
          this.inScenario = description;
          return `${this.scenarioBlockEnd}${scenarioBlockStart}`;
        }

        this.inScenario = description;
        return scenarioBlockStart;
      case StepTransformer.TOKENS.GIVEN:
        return `${indent}Given('${description}', () => {});\n`;
      case StepTransformer.TOKENS.WHEN:
        return `${indent}When('${description}', () => {});\n`;
      case StepTransformer.TOKENS.THEN:
        return `${indent}Then('${description}', () => {});\n`;
      default:
        return '';
    }
  }
}
