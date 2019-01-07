export class StepExistsError extends Error {
  constructor(message: string = 'Step already exists') {
    super(message);

    this.name = 'StepExistsError';
  }
}
