import { createFileRoute } from "@tanstack/react-router";
import WorkspaceShell from "#/features/workspaces/components/workspace-shell";

export const Route = createFileRoute("/")({ component: WorkspaceShell });
