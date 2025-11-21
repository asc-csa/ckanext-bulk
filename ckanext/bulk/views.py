from __future__ import annotations

from flask import Blueprint, request
from flask.views import MethodView

import ckan.plugins.toolkit as tk

from ckanext.bulk.utils import get_data

__all__ = ["bp"]

bp = Blueprint("bulk", __name__, url_prefix="/bulk")


@bp.errorhandler(tk.NotAuthorized)
def not_authorized_handler(_: tk.NotAuthorized) -> tuple[str, int]:
    """Generic handler for NotAuthorized exception."""
    return (
        tk.render(
            "bulk/error.html",
            {
                "code": 403,
                "content": "Not authorized to view this page",
                "name": "Not authorized",
            },
        ),
        403,
    )


def create_filter_item() -> str:
    return tk.render("bulk/snippets/filter_item.html", {"data": {}, "errors": {}})


def create_update_item() -> str:
    return tk.render("bulk/snippets/update_item.html", {"data": {}, "errors": {}})


def render_results() -> str:
    """HTMX endpoint to render search results with proper CKAN templates."""
    entity_type = request.form.get("entity_type", "dataset")
    bulk_form_id = request.form.get("bulk_form_id", "")

    if not bulk_form_id:
        return "<p class='text-muted'>No results yet</p>"

    result = get_data(f"bulk_result_{bulk_form_id}")
    if not result or not result.get("entities"):
        return "<p class='text-muted'>No entities match your current filters</p>"

    entities = result["entities"]
    total = len(entities)
    # Limit display to first 50 entities
    displayed_entities = entities[:50]

    # For datasets, use package_show to get fully expanded entities with organization
    if entity_type == "dataset":
        expanded_entities = []
        for entity in displayed_entities:
            try:
                pkg = tk.get_action("package_show")(
                    {"ignore_auth": True}, {"id": entity["id"]}
                )
                expanded_entities.append(pkg)
            except Exception:
                # If package_show fails, use the original entity
                expanded_entities.append(entity)
        displayed_entities = expanded_entities

    return tk.render(
        "bulk/snippets/result_list.html",
        {
            "entities": displayed_entities,
            "entity_type": entity_type,
            "total": total,
        },
    )


def render_logs() -> str:
    """HTMX endpoint to render logs with proper templates."""
    bulk_form_id = request.form.get("bulk_form_id", "")

    if not bulk_form_id:
        return "<p class='text-muted'>No logs yet</p>"

    logs = get_data(f"bulk_logs_{bulk_form_id}")
    if not logs:
        return "<p class='text-muted'>No operations performed yet</p>"

    total = len(logs)
    # Show last 50 log entries
    displayed_logs = logs[-50:]

    return tk.render(
        "bulk/snippets/log_list.html",
        {
            "logs": displayed_logs,
            "total": total,
        },
    )


class BulkManagerView(MethodView):
    def get(self):
        tk.check_access("bulk_manager", {})

        return tk.render("bulk/manager.html", {"data": {}, "errors": {}})

    def post(self):
        return tk.redirect_to("bulk.manager")


# class ExportCSVView(MethodView):
#     def get(self, ):
#         return tk.render("bulk/export_csv.html", {"data": {}, "errors": {}})


bp.add_url_rule("/manager", view_func=BulkManagerView.as_view("manager"))
bp.add_url_rule("/htmx/create_filter_item", view_func=create_filter_item)
bp.add_url_rule("/htmx/create_update_item", view_func=create_update_item)
bp.add_url_rule(
    "/htmx/render_results",
    view_func=render_results,
    methods=["POST"],
)
bp.add_url_rule(
    "/htmx/render_logs",
    view_func=render_logs,
    methods=["POST"],
)
