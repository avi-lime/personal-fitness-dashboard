import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// Deterministic defaults so unit tests never depend on a developer's .env.local.
process.env.AUTH_USERNAME ??= "owner";
process.env.AUTH_PASSWORD ??= "test-password-1234";
process.env.AUTH_SECRET ??= "test-secret-that-is-at-least-32-characters-long";
process.env.MCP_TOKEN ??= "test-mcp-token-that-is-long-enough-000";
