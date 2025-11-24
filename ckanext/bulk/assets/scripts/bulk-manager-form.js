ckan.module("bulk-manager-form", function () {
    "use strict";

    return {
        const: {
            filterBlock: ".filters-list",
            updateToBlock: ".update-to-fields-wrapper",
            entitySelect: ".bulk-select-entity select",
            searchBtn: ".bulk-search-btn",
            deleteBtn: ".bulk-delete-btn",
            updateBtn: ".bulk-update-btn",
            globalOperator: "#global_operator",
            actionField: ".bulk-action-field",
            infoBlock: ".bulk-info-status",
            bulkResultContainer: "#bulk-result-container",
            bulkFormIdField: "#bulk_form_id",
            exportResultBtn: "#export-result-btn",
            exportLogsBtn: "#export-logs-btn",
        },
        htmx: {
            addFilter: "/bulk/htmx/create_filter_item",
            addUpdate: "/bulk/htmx/create_update_item",
        },
        options: {
            resultMaxEntries: 50,
            logsMaxEntries: 50,
        },

        initialize() {
            $.proxyAll(this, /_/);

            this.managerForm = this.el.find("form");
            this.filterBlock = $(this.const.filterBlock);
            this.updateToBlock = $(this.const.updateToBlock);
            this.entitySelect = $(this.const.entitySelect);
            this.searchBtn = $(this.const.searchBtn);
            this.deleteBtn = $(this.const.deleteBtn);
            this.updateBtn = $(this.const.updateBtn);
            this.globalOperator = $(this.const.globalOperator);
            this.actionField = $(this.const.actionField);
            this.infoBlock = $(this.const.infoBlock);
            this.bulkResultContainer = $(this.const.bulkResultContainer);
            this.bulkFormIdField = $(this.const.bulkFormIdField);
            this.exportResultBtn = $(this.const.exportResultBtn);
            this.exportLogsBtn = $(this.const.exportLogsBtn);

            this.entitySelect.on("change", this._onEntitySelectChange);
            this.searchBtn.on("click", this._onSearchBtnClick);
            this.deleteBtn.on("click", this._onDeleteBtnClick);
            this.updateBtn.on("click", this._onUpdateBtnClick);
            this.exportResultBtn.on("click", this._onExportResultBtnClick);
            this.exportLogsBtn.on("click", this._onExportLogsBtnClick);

            window.onbeforeunload = function (_) {
                return "Are you sure you want to leave this page? The bulk action is in progress.";
            };

            // global setup for toast messages
            this.toast = Swal.mixin({
                toast: true,
                position: "bottom-end",
                showConfirmButton: false,
                showCloseButton: true,
                timer: 3000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.onmouseenter = Swal.stopTimer;
                    toast.onmouseleave = Swal.resumeTimer;
                }
            });

            // Add event listeners on dynamic elements
            $('body').on('click', '.btn-item-remove', this._onFilterItemRemove);

            // initialize CKAN modules for HTMX loaded pages
            htmx.on("htmx:afterSettle", this._HTMXAfterSettle);

            // ON INIT
            this.bulkEntitiesToUpdate = [];
            this.bulkLogs = [];

            this._initFieldSelectors(this.filterBlock.find(".bulk-field-select select"));
            this._initFieldSelectors(this.updateToBlock.find("select"));
        },

        /**
         * This event is triggered after the DOM has settled.
         *
         * @param {Event} event
         */
        _HTMXAfterSettle(event) {
            if (event.detail.pathInfo.requestPath == this.htmx.addFilter) {
                this._initFieldSelectors(this.filterBlock.find(".bulk-field-select select"));
            } else if (event.detail.pathInfo.requestPath == this.htmx.addUpdate) {
                this._initFieldSelectors(this.updateToBlock.find("select"));
            }
        },

        /**
         * Triggers when user tries to change the entity type.
         *
         * Suggest user to clear the filters, because different entities might
         * have different fields.
         *
         * @param {Event} e
         */
        _onEntitySelectChange(e) {
            this._initFieldSelectors(this.filterBlock.find(".bulk-field-select select"), true);
            this._initFieldSelectors(this.updateToBlock.find("select"), true);

            if (!this._getFilters().length) {
                return;
            }

            // HACK: select an input because swal will focus the last focused element
            // and we don't want it to be an entity selector
            $("#value").get(0).focus()

            Swal.fire({
                title: "Do you want to clear the filters?",
                showDenyButton: true,
                confirmButtonText: "Yes",
                denyButtonText: "No"
            }).then((result) => {
                if (result.isConfirmed) {
                    this._clearFilters();
                }
            });
        },

        /**
         * Clear all filters
         */
        _clearFilters() {
            this.filterBlock.find("select").get(0).tomselect.clear();
            this.filterBlock.find("input").val("");
            this.filterBlock.find(".bulk-fieldset-item:not(:first)").remove();
        },

        /**
         * Clear all update fields. For now we're not using it.
         */
        _clearUpdateOn() {
            this.updateToBlock.find("select").get(0).tomselect.clear();
            this.updateToBlock.find("input").val("");
            this.updateToBlock.find(".bulk-fieldset-item:not(:first)").remove();
        },

        /**
         * Triggers when user tries to remove a filter item.
         *
         * If there is only one item left, show an error message and do not allow
         * to remove it.
         *
         * If the item is removed, trigger the change event on the form, to recalculate
         * the number of entities that will be updated.
         *
         * @param {Event} e
         */
        _onFilterItemRemove(e) {
            if ($(e.target).closest(".bulk-list").find(".bulk-fieldset-item").length <= 1) {
                return this.toast.fire({
                    icon: "error",
                    title: "You can't remove the last item"
                });
            };

            $(e.target).closest(".bulk-fieldset-item").remove();

            this.managerForm.trigger("change");
        },

        _getFilters() {
            const filters = [];

            this.filterBlock.find(".filter-item").each((_, el) => {
                const field = $(el).find(".bulk-field-select select").val();
                const operator = $(el).find(".bulk-operator-select select").val();
                const value = $(el).find(".bulk-value-input input").val() || "";

                if (field && operator) {
                    filters.push({ field, operator, value });
                }
            });

            return filters;
        },

        _getUpdateOn() {
            const updateOn = [];

            this.updateToBlock.find(".update-field-item").each((_, el) => {
                const field = $(el).find("#update_field").val();
                const value = $(el).find("#update_value").val();

                // allow null value so we can empty the field
                if (field) {
                    updateOn.push({ field, value });
                }
            });

            return updateOn;
        },

        _onSearchBtnClick(e) {
            const data = {
                entity_type: this.entitySelect.val(),
                action: "update", // Required by backend but not used for search
                filters: this._getFilters(),
                global_operator: this.globalOperator.is(":checked") ? "AND" : "OR",
                bulk_form_id: this.bulkFormIdField.val(),
            }

            this._toggleLoadSpinner(true);

            if (!data.filters.length) {
                this.infoBlock.find(".counter").html("There will be information about how many entities will be changed.");
                return this._toggleLoadSpinner(false);
            }

            this.sandbox.client.call(
                "POST",
                "bulk_get_entities_by_filters",
                data,
                (data) => {
                    if (!data.result || data.result.error || data.result.entities.length === 0) {
                        if (data.result.error) {
                            this._toggleLoadSpinner(false);

                            return this.toast.fire({
                                icon: "error",
                                title: data.result.error
                            });
                        }

                        this.bulkResultContainer.html("<p>No results yet</p>");
                        this.infoBlock.find(".counter").html("Found 0 entities");
                        this.bulkEntitiesToUpdate = [];

                        this.toast.fire({
                            icon: "success",
                            title: "Found 0 entities"
                        });

                        return this._toggleLoadSpinner(false);
                    }

                    this.bulkEntitiesToUpdate = data.result.entities;
                    this.infoBlock.find(".counter").html("Found " + data.result.entities.length + " entities");

                    // Enable action buttons
                    this.deleteBtn.prop('disabled', false);
                    this.updateBtn.prop('disabled', false);

                    // Get rendered HTML from server
                    $.post('/bulk/htmx/render_results', {
                        entity_type: this.entitySelect.val(),
                        bulk_form_id: this.bulkFormIdField.val()
                    }, (html) => {
                        $('#bulk-result-container').html(html);
                        this.toast.fire({
                            icon: "success",
                            title: `Found ${data.result.entities.length} entities`
                        });
                        this._toggleLoadSpinner(false);
                    }).fail(() => {
                        this.toast.fire({
                            icon: "error",
                            title: "Failed to render results"
                        });
                        this._toggleLoadSpinner(false);
                    });
                },
                (resp) => {
                    this.toast.fire({
                        icon: "error",
                        title: resp
                    });
                    this._toggleLoadSpinner(false);
                }
            );
        },

        /**
         * Limit the number of entries in the result to avoid performance issues.
         *
         * Also remove some fields that are not needed for the user.
         *
         * @param {Array<Object>} entities
         *
         * @returns {Array<Object>}
         */
        _limitResultEntries: function (entities) {
            entities = entities.slice(0, this.options.resultMaxEntries);

            entities.forEach(entity => {
                delete entity.resources;
                delete entity.organization;
                delete entity.groups;

                delete entity.relationships_as_subject,
                    delete entity.relationships_as_object;
            });

            return entities;
        },

        /**
         * Limit the number of entries in the logs to avoid performance issues.
         *
         * @param {Array<Object>} logs
         *
         * @returns {Array<Object>}
         */
        _limitLogsEntries: function (logs) {
            return logs.slice(logs.length - this.options.logsMaxEntries, logs.length);
        },

        _initFieldSelectors: function (selectItems, reinit = false) {
            let prevValue = "";

            selectItems.each((_, el) => {
                if (el.tomselect !== undefined) {
                    if (reinit) {
                        prevValue = el.tomselect.getValue();
                        el.tomselect.destroy();
                    } else {
                        return;
                    }
                }

                const self = this;

                new TomSelect(el, {
                    valueField: "value",
                    labelField: "text",
                    plugins: ['dropdown_input'],
                    placeholder: "Search for field name",
                    create: true,
                    preload: true,
                    load: function (query, callback) {
                        var url = `/api/action/bulk_search_fields?query=${encodeURIComponent(query)}&entity_type=${self.entitySelect.val()}`;
                        fetch(url)
                            .then(response => response.json())
                            .then(json => {
                                callback(json.result);
                            }).catch(() => {
                                callback();
                            });
                    },
                    onInitialize: function () {
                        if (prevValue) {
                            this.input.tomselect.addOption({
                                text: prevValue,
                                value: prevValue,
                            });
                            this.input.tomselect.setValue(prevValue, true);
                        };
                    }
                });
            });
        },

        _toggleLoadSpinner: function (show) {
            this.infoBlock.find(".spinner").toggle(show);
        },

        _onDeleteBtnClick: async function (e) {
            const entity_type = this.entitySelect.val();
            const action = "delete";
            const bulk_form_id = this.bulkFormIdField.val();

            if (!this.bulkEntitiesToUpdate.length) {
                return this.toast.fire({
                    icon: "error",
                    title: "Please search for entities first"
                });
            }

            // Confirmation dialog
            const result = await Swal.fire({
                title: 'Delete all matches?',
                html: `You are about to <strong>permanently delete ${this.bulkEntitiesToUpdate.length} ${entity_type}(s)</strong>.<br><br>This action cannot be undone!`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete them',
                cancelButtonText: 'Cancel'
            });

            if (!result.isConfirmed) {
                return;
            }

            this.bulkProgressBar = this._initProgressBar();

            for (let i = 0; i < this.bulkEntitiesToUpdate.length; i++) {
                const entity = this.bulkEntitiesToUpdate[i];

                try {
                    await this._callUpdateEntity(entity, entity_type, [], action, bulk_form_id);
                    this.bulkProgressBar.animate(
                        this.bulkProgressBar.value() + this.bulkProgressBarPercent
                    );
                } catch (error) {
                    this.toast.fire({
                        icon: "error",
                        title: error
                    });
                }
            };

            this.bulkProgressBar.destroy();

            // Get rendered logs from server
            $.post('/bulk/htmx/render_logs', {
                bulk_form_id: this.bulkFormIdField.val()
            }, (html) => {
                $('#bulk-logs-container').html(html).show();
                this.toast.fire({
                    icon: "success",
                    title: "Bulk delete completed. Check the logs below"
                });
            }).fail(() => {
                this.toast.fire({
                    icon: "error",
                    title: "Failed to render logs"
                });
            });
        },

        _onUpdateBtnClick: async function (e) {
            const entity_type = this.entitySelect.val();
            const action = "update";
            const update_on = this._getUpdateOn();
            const bulk_form_id = this.bulkFormIdField.val();

            if (!this.bulkEntitiesToUpdate.length) {
                return this.toast.fire({
                    icon: "error",
                    title: "Please search for entities first"
                });
            }

            if (!update_on.length) {
                return this.toast.fire({
                    icon: "error",
                    title: "Please specify at least one field to update"
                });
            }

            // Build update summary for confirmation
            const updateSummary = update_on.map(u => `<li><strong>${u.field}</strong> = "${u.value || '(empty)'}"</li>`).join('');

            // Confirmation dialog
            const result = await Swal.fire({
                title: 'Update all matches?',
                html: `You are about to update <strong>${this.bulkEntitiesToUpdate.length} ${entity_type}(s)</strong> with the following changes:<br><br><ul style="text-align: left;">${updateSummary}</ul>`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#aaa',
                confirmButtonText: 'Yes, update them',
                cancelButtonText: 'Cancel'
            });

            if (!result.isConfirmed) {
                return;
            }

            this.bulkProgressBar = this._initProgressBar();

            for (let i = 0; i < this.bulkEntitiesToUpdate.length; i++) {
                const entity = this.bulkEntitiesToUpdate[i];

                try {
                    await this._callUpdateEntity(entity, entity_type, update_on, action, bulk_form_id);
                    this.bulkProgressBar.animate(
                        this.bulkProgressBar.value() + this.bulkProgressBarPercent
                    );
                } catch (error) {
                    this.toast.fire({
                        icon: "error",
                        title: error
                    });
                }
            };

            this.bulkProgressBar.destroy();

            // Get rendered logs from server
            $.post('/bulk/htmx/render_logs', {
                bulk_form_id: this.bulkFormIdField.val()
            }, (html) => {
                $('#bulk-logs-container').html(html).show();
                this.toast.fire({
                    icon: "success",
                    title: "Bulk update completed. Check the logs below"
                });
            }).fail(() => {
                this.toast.fire({
                    icon: "error",
                    title: "Failed to render logs"
                });
            });
        },

        _initProgressBar: function () {
            const bulkProgressBar = new BulkProgressBar("#bulk-progress-container", {});

            bulkProgressBar.animate(0);

            this.bulkProgressBarPercent = 100 / this.bulkEntitiesToUpdate.length;

            return bulkProgressBar;
        },

        _callUpdateEntity: function (entity, entity_type, update_on, action, bulk_form_id) {
            return new Promise((done, fail) => {
                this.sandbox.client.call("POST", "bulk_update_entity", {
                    entity_type: entity_type,
                    entity_id: entity.id,
                    update_on: update_on,
                    action: action,
                    bulk_form_id: bulk_form_id,
                }, (resp) => {
                    this.bulkLogs.push(resp.result);

                    done(resp);
                }, (resp) => {
                    fail(resp)
                });
            });
        },

        _onExportResultBtnClick: function (e) {
            this._exportAsCSV("result");
        },

        _onExportLogsBtnClick: function (e) {
            this._exportAsCSV("logs");
        },

        _exportAsCSV: function (type) {
            const bulk_form_id = this.bulkFormIdField.val();

            this.sandbox.client.call("POST", "bulk_export", {
                bulk_form_id: bulk_form_id,
                type: type,
            }, (data) => {
                if (!data.result || !data.result.length) {
                    return this.toast.fire({
                        icon: "error",
                        title: `No ${type} found`
                    });
                }

                const csv = this._convertToCSV(data.result);
                this._downloadCSV(csv, 'data.csv');
            });
        },

        _convertToCSV: function (data) {
            const header = Object.keys(data[0]);
            const rows = data.map(row => header.map(
                field => JSON.stringify(row[field], this._replacer)).join(',')
            );
            return [header.join(','), ...rows].join('\r\n');
        },

        _replacer: function (key, value) {
            return value === null ? '' : value;
        },

        _downloadCSV: function (csv, filename) {
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
})

class BulkProgressBar {
    /**
     * Create a new progress bar instance inside a container
     *
     * @param {String} container - container selector
     * @param {Object} options - progress bar options
     */
    constructor(container, options) {
        this.container = $(container);

        if (!this.container) {
            throw new Error("Container not found");
        }

        this.options = options;
        this.progress = 0;

        this.container.addClass("bulk-progress-bar");
        this.container.append(`
            <div id='pb-runner-wrapper'>
                <div id='pb-runner'></div>
            </div>
        `);
        this.container.append("<div id='pb-status'></div>");
    }

    /**
     * Animate the progress bar
     *
     * @param {Number} value - progress value from 0 to 100
     */
    animate(value) {
        value = Math.round(value * 100) / 100;

        if (value > 100) {
            value = 100;
        }

        this.progress = value;

        this.container.find("#pb-runner").width(`${value}%`);
        this.container.find("#pb-status").html(`${value}%`);
    }

    /**
     * Get current progress value
     *
     * @returns {Number} - current progress value
     */
    value() {
        return this.progress;
    }

    /**
     * Destroy the progress bar inside a container
     */
    destroy() {
        this.container.removeClass("bulk-progress-bar");
        this.container.empty();
    }
}
