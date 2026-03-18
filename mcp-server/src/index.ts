#!/usr/bin/env node
/**
 * GuitarForge MCP Server
 *
 * Provides tools for managing GuitarForge content: exercises, songs,
 * tab search, constants, and project statistics.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerExerciseTools } from "./tools/exercises.js";
import { registerSongTools } from "./tools/songs.js";
import { registerTabTools } from "./tools/tabs.js";
import { registerConstantTools } from "./tools/constants.js";
import { registerStatsTools } from "./tools/stats.js";

const server = new McpServer({
  name: "guitarforge-mcp-server",
  version: "1.0.0",
});

// Register all tool groups
registerExerciseTools(server);
registerSongTools(server);
registerTabTools(server);
registerConstantTools(server);
registerStatsTools(server);

// Start server with stdio transport
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GuitarForge MCP server running via stdio");
}

main().catch(error => {
  console.error("Server error:", error);
  process.exit(1);
});
