from __future__ import annotations

import uuid

import ckan.plugins.toolkit as tk

from ckanext.bulk import const
from ckanext.bulk.utils import get_entity_managers


def bulk_action_options() -> list[dict[str, str]]:
    return [
        {"value": "update", "text": tk._("Update")},
        {"value": "delete", "text": tk._("Delete")},
    ]


def bulk_operator_options() -> list[dict[str, str]]:
    return [
        {"text": tk._("IS"), "value": const.OP_IS},
        {"text": tk._("IS NOT"), "value": const.OP_IS_NOT},
        {"text": tk._("CONTAINS"), "value": const.OP_CONTAINS},
        {"text": tk._("DOES NOT CONTAIN"), "value": const.OP_DOES_NOT_CONTAIN},
        {"text": tk._("STARTS WITH"), "value": const.OP_STARTS_WITH},
        {"text": tk._("ENDS WITH"), "value": const.OP_ENDS_WITH},
        {"text": tk._("IS EMPTY"), "value": const.OP_IS_EMPTY},
        {"text": tk._("IS NOT EMPTY"), "value": const.OP_IS_NOT_EMPTY},
    ]


def bulk_entity_options() -> list[dict[str, str]]:
    return [
        {"value": manager.entity_type, "text": bulk_entity_label(manager.entity_type)}
        for manager in get_entity_managers().values()
    ]


def bulk_entity_label(entity_type: str) -> str:
    return {
        "dataset": tk._("Dataset"),
        "dataset_resource": tk._("Resource"),
        "organization": tk._("Organization"),
        "group": tk._("Group"),
    }.get(entity_type, entity_type)


def bulk_generate_form_id() -> str:
    return str(uuid.uuid4())
