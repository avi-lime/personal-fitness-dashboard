/** Shapes shared by the assistant runner, its routes and the dialog. */

export interface AssistantAction {
  tool: string;
  summary: string;
}

/** A destructive call the assistant wants to make but has not executed. */
export interface PendingAction {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
}

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantResponse {
  reply: string;
  actions: AssistantAction[];
  pending?: PendingAction;
  /** False when the model could not turn the request into anything useful. */
  understood: boolean;
}
