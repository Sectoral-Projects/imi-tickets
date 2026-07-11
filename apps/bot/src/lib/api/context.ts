export interface ApiVariables {
	session: { id: string; userId: string } | null;
	user: { id: string } | null;
}

export interface ApiEnv {
	Variables: ApiVariables;
}
