/**
 * Code executed on every page.
 *
 * Avoid using this function and try extracting logic into CKAN JS modules.
 */
jQuery(function () {
    // register plugin helpers inside Sandbox object, available as `this.sandbox`
    // inside every module instance.
    ckan.sandbox.extend({
        "bulk": {
            selectRender() {
                return {
                    no_results: (_, escape) => '<div class="no-results">' + escape(ckan.i18n._("No results found")) + '</div>',
                    loading: (_, escape) => '<div class="spinner">' + escape(ckan.i18n._("Loading...")) + '</div>',
                    option_create: (data, escape) => '<div class="create">' + escape(ckan.i18n._("Add %(input)s", {input: data.input})) + '</div>',
                };
            },

            /**
             * Transform `{hello_world_prop: 1}` into `{hello:{world:{prop: 1}}}`
             */
            nestedOptions(options) {
                const nested = {};

                for (let name in options) {
                    if (typeof name !== "string") continue;

                    const path = name.split("_");
                    const prop = path.pop();
                    const target = path.reduce((container, part) => {
                        container[part] = container[part] || {};
                        return container[part];
                    }, nested);
                    target[prop] = options[name];
                }

                return nested;
            },
        },
    });

    // initialize CKAN modules inside fragments loaded by HTMX
    if (typeof htmx !== "undefined") {
        htmx.on("htmx:afterSettle", function (event) {
            var elements = event.target.querySelectorAll("[data-module]");

            for (let node of elements) {
                if (node.getAttribute("dm-initialized")) {
                    continue;
                }

                ckan.module.initializeElement(node);
                node.setAttribute("dm-initialized", true)
            }
        });
    }
});
