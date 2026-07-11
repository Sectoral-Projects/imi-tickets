import type { Hono } from 'hono';
import type { ApiEnv } from './context';

export abstract class Route {
	abstract register(app: Hono<ApiEnv>, path: string): void;
}