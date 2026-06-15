export const loadTemplateIntoApp = async (appId: string, templatePath: string): Promise<void> => {
    const app = document.getElementById(appId);
    if (!app) {
        return;
    }

    const html = await fetch(templatePath).then((response) => response.text());
    app.innerHTML = html;
    await resolveTemplateIncludes();
};

export const resolveTemplateIncludes = async (): Promise<void> => {
    let nodes = Array.from(document.querySelectorAll("[data-include]"));

    while (nodes.length > 0) {
        for (const node of nodes) {
            const path = node.getAttribute("data-include");
            if (!path) {
                continue;
            }

            const html = await fetch(path).then((response) => response.text());
            node.outerHTML = html;
        }

        nodes = Array.from(document.querySelectorAll("[data-include]"));
    }
};
