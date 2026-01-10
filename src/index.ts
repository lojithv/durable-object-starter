import { DurableObject } from "cloudflare:workers";
export class MyDurableObject extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		// Required, as we are extending the base class.
		super(ctx, env)
	}

	async sayHello(): Promise<string> {
		let result = this.ctx.storage.sql
			.exec("SELECT 'Hello, World 123456!' as greeting")
			.toArray();
		if (result.length === 0) {
			console.error("SQL query returned no results");
			return "Hello, World! (fallback)";
		}
		const first = result[0] as { greeting: string };
		return first.greeting;
	}

}
export default {
	async fetch(request, env, ctx): Promise<Response> {
		const stub = env.MY_DURABLE_OBJECT.getByName(new URL(request.url).pathname);

		const greeting = await stub.sayHello();

		return new Response(greeting);
	},

} satisfies ExportedHandler<Env>;