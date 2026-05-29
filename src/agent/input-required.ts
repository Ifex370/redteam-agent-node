import { InputRequest } from "../domain/schemas.js";

export class InputRequiredError extends Error {
  readonly request: InputRequest;

  constructor(request: InputRequest) {
    super(request.question);
    this.name = "InputRequiredError";
    this.request = request;
  }
}

export function isInputRequiredError(error: unknown): error is InputRequiredError {
  return error instanceof InputRequiredError;
}
