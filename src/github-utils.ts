
export async function updateFile(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    githubPATtoken: string,
    newFile: string
): Promise<any> {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = {
        "Authorization": `Bearer ${githubPATtoken}`,
        "User-Agent": "Cloudflare-Worker-Github-Updater",
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
    };

    // 1. Get current file SHA (if it exists)
    let sha: string | undefined;
    try {
        const getResponse = await fetch(`${apiUrl}?ref=${branch}`, {
            method: "GET",
            headers: headers,
        });

        if (getResponse.ok) {
            const data = await getResponse.json() as { sha: string };
            sha = data.sha;
        } else if (getResponse.status !== 404) {
            const errorText = await getResponse.text();
            console.error(`Error checking file existence: ${getResponse.status} ${errorText}`);
            // If it's not 404, it might be an auth error or something else we should report, 
            // but for now we'll proceed assuming it's a new file if we can't find it, 
            // or let the PUT fail if it's a permission issue.
        }
    } catch (e) {
        console.error("Error fetching file info:", e);
    }

    // 2. Prepare PUT request
    // Content must be base64 encoded
    // Using simple btoa for this environment. 
    // Note: btoa handles latin1 only, so for utf8 strings we might need a better encoding strategy 
    // if users provide complex chars, but for "simple test.json" this is usually enough.
    // A safer way for UTF-8:
    const contentEncoded = btoa(unescape(encodeURIComponent(newFile)));

    const body: any = {
        message: `Update ${path} via Cloudflare Worker`,
        content: contentEncoded,
        branch: branch
    };

    if (sha) {
        body.sha = sha;
    }

    // 3. Send PUT request
    const putResponse = await fetch(apiUrl, {
        method: "PUT",
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!putResponse.ok) {
        const errorText = await putResponse.text();
        throw new Error(`GitHub API Error: ${putResponse.status} ${errorText}`);
    }

    return await putResponse.json();
}
