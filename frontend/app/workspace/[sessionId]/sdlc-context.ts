"use client";

import { createContext, useContext } from "react";
import type { WorkspaceSdlcContext } from "@/hooks/useWorkspaceContracts";
import type { Session } from "@/lib/types";

export interface WorkspaceSdlcRouteContext extends WorkspaceSdlcContext {
	session: Session | null;
	setEditBA: (value: string) => void;
	setEditSA: (value: string) => void;
	setEditDevLead: (value: string) => void;
}

export const WorkspaceSdlcRouteContextObj =
	createContext<WorkspaceSdlcRouteContext | null>(null);

export function useWorkspaceSdlcRoute() {
	const ctx = useContext(WorkspaceSdlcRouteContextObj);
	if (!ctx)
		throw new Error(
			"useWorkspaceSdlcRoute must be used within WorkspaceSdlcRouteContextObj",
		);
	return ctx;
}
