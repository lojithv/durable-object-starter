import { DurableObject } from "cloudflare:workers";
import { updateFile } from "./github-utils";

// TODO: Replace these with your actual details
const GITHUB_OWNER = "lojithv";
const GITHUB_REPO = "durable-object-starter";
const GITHUB_BRANCH = "main";
const GITHUB_PAT = "";

export class MyDurableObject extends DurableObject<Env> {
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        // Initialize count if not present
        this.ctx.blockConcurrencyWhile(async () => {
            let stored = await this.ctx.storage.get<number>("count");
            if (stored === undefined) {
                await this.ctx.storage.put("count", 0);
            }
        });
    }

    async increment(): Promise<number> {
        let count = (await this.ctx.storage.get<number>("count")) || 0;
        count++;
        await this.ctx.storage.put("count", count);
        return count;
    }

    async decrement(): Promise<number> {
        let count = (await this.ctx.storage.get<number>("count")) || 0;
        count--;
        await this.ctx.storage.put("count", count);
        return count;
    }

    async getCount(): Promise<number> {
        return (await this.ctx.storage.get<number>("count")) || 0;
    }

    async syncToGithub(): Promise<string> {
        const count = await this.getCount();
        const content = JSON.stringify({ count, updatedAt: new Date().toISOString() }, null, 2);
        return await this.uploadTestFile("state.json", content);
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

    async uploadTestFile(filename: string, content: string): Promise<string> {
        try {
            const result = await updateFile(
                GITHUB_OWNER,
                GITHUB_REPO,
                GITHUB_BRANCH,
                filename,
                GITHUB_PAT,
                content
            );
            return JSON.stringify(result, null, 2);
        } catch (e: any) {
            return `Error: ${e.message}`;
        }
    }

}
export default {
    async fetch(request, env, ctx): Promise<Response> {
        const url = new URL(request.url);
        const stub = env.MY_DURABLE_OBJECT.getByName("counter");

        if (url.pathname === "/api/increment") {
            const count = await stub.increment();
            return new Response(JSON.stringify({ count }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === "/api/decrement") {
            const count = await stub.decrement();
            return new Response(JSON.stringify({ count }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === "/api/count") {
            const count = await stub.getCount();
            return new Response(JSON.stringify({ count }), { headers: { "Content-Type": "application/json" } });
        }

        if (url.pathname === "/api/sync") {
            const result = await stub.syncToGithub();
            return new Response(result, { headers: { "Content-Type": "application/json" } });
        }

        // Serve UI
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Durable Counter Sync</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Outfit:wght@700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --primary: #38bdf8;
            --primary-hover: #0ea5e9;
            --text: #f8fafc;
            --text-dim: #94a3b8;
            --accent: #818cf8;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
            background-color: var(--bg);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-image: radial-gradient(circle at top right, rgba(56, 189, 248, 0.1), transparent),
                              radial-gradient(circle at bottom left, rgba(129, 140, 248, 0.1), transparent);
        }
        .container {
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            padding: 3rem;
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            text-align: center;
            width: 100%;
            max-width: 400px;
            transition: transform 0.3s ease;
        }
        h1 {
            font-family: 'Outfit', sans-serif;
            margin-bottom: 2rem;
            font-size: 2.5rem;
            background: linear-gradient(to right, var(--primary), var(--accent));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .counter-display {
            font-size: 5rem;
            font-weight: 700;
            margin: 2rem 0;
            color: var(--primary);
            text-shadow: 0 0 20px rgba(56, 189, 248, 0.3);
            transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .controls {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-bottom: 2rem;
        }
        button {
            padding: 1rem 2rem;
            font-size: 1.25rem;
            cursor: pointer;
            border: none;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text);
            transition: all 0.2s ease;
            font-weight: 600;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        button:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: translateY(-2px);
        }
        button:active {
            transform: translateY(0);
        }
        .btn-sync {
            width: 100%;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: white;
            border: none;
            font-size: 1.1rem;
            margin-top: 1rem;
        }
        .btn-sync:hover {
            filter: brightness(1.1);
            box-shadow: 0 10px 20px -10px rgba(56, 189, 248, 0.5);
        }
        .btn-sync:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        .status {
            margin-top: 1.5rem;
            font-size: 0.9rem;
            color: var(--text-dim);
            min-height: 1.2rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Counter</h1>
        <div id="counter" class="counter-display">...</div>
        <div class="controls">
            <button onclick="updateCount('/api/decrement')">−</button>
            <button onclick="updateCount('/api/increment')">+</button>
        </div>
        <button id="syncBtn" class="btn-sync" onclick="syncGithub()">Sync to GitHub</button>
        <div id="status" class="status"></div>
    </div>

    <script>
        const counterEl = document.getElementById('counter');
        const statusEl = document.getElementById('status');
        const syncBtn = document.getElementById('syncBtn');

        async function fetchCount() {
            try {
                const res = await fetch('/api/count');
                const data = await res.json();
                counterEl.textContent = data.count;
            } catch (e) {
                counterEl.textContent = 'Error';
            }
        }

        async function updateCount(url) {
            const oldValue = counterEl.textContent;
            counterEl.style.transform = 'scale(0.8)';
            try {
                const res = await fetch(url);
                const data = await res.json();
                counterEl.textContent = data.count;
                counterEl.style.transform = 'scale(1.1)';
                setTimeout(() => counterEl.style.transform = 'scale(1)', 100);
            } catch (e) {
                statusEl.textContent = 'Error updating count';
                counterEl.textContent = oldValue;
            }
        }

        async function syncGithub() {
            syncBtn.disabled = true;
            statusEl.textContent = 'Syncing...';
            try {
                const res = await fetch('/api/sync');
                const data = await res.json();
                statusEl.textContent = 'Synced successfully!';
                setTimeout(() => statusEl.textContent = '', 3000);
            } catch (e) {
                statusEl.textContent = 'Sync fail: ' + e.message;
            } finally {
                syncBtn.disabled = false;
            }
        }

        fetchCount();
    </script>
</body>
</html>
		`;

        return new Response(html, { headers: { "Content-Type": "text/html" } });
    },
} satisfies ExportedHandler<Env>;