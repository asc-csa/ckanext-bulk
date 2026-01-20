from __future__ import annotations

import logging
from typing import Any

import ckan.plugins.toolkit as tk
from ckan.lib.search.index import RESERVED_FIELDS
from ckan.lib.search.query import escape_legacy_argument
from ckan.model import Package

from ckanext.bulk import const
from ckanext.bulk.entity_managers import base

log = logging.getLogger(__name__)

# Fields that exist at top level in Solr (no extras_ prefix needed)
_PACKAGE_FIELDS = frozenset(col.name for col in Package.__table__.columns)
_SOLR_CORE_FIELDS = _PACKAGE_FIELDS | frozenset(RESERVED_FIELDS)


def _to_solr_field(field: str) -> str:
    """Convert CKAN API field name to Solr field name.

    Core package fields and reserved Solr fields stay as-is.
    Extra fields (e.g., from scheming) need 'extras_' prefix.
    """
    if field in _SOLR_CORE_FIELDS:
        return field
    return f"extras_{field}"


def _build_word_query(field: str, value: str, negate: bool = False) -> str:
    """Build a query matching all words in value.

    For "Contribution Program", produces:
    - (field:Contribution AND field:Program) if negate=False
    - -(field:Contribution AND field:Program) if negate=True
    """
    words = value.split()
    if not words:
        return f"{field}:*" if not negate else f"-{field}:*"

    word_clauses = [f"{field}:{escape_legacy_argument(w)}" for w in words]

    if len(word_clauses) == 1:
        return f"-{word_clauses[0]}" if negate else word_clauses[0]

    combined = " AND ".join(word_clauses)
    return f"-({combined})" if negate else f"({combined})"


class DatasetEntityManager(base.EntityManager):
    entity_type = "dataset"
    show_action = "package_show"
    patch_action = "package_patch"
    delete_action = "package_delete"

    @classmethod
    def get_fields(cls) -> list[base.FieldItem]:
        if fields := cls.get_fields_from_redis():
            return fields

        result = tk.get_action("package_search")(
            {"ignore_auth": True},
            {"rows": 1, "include_private": True, "q": f'type:"{cls.entity_type}"'},
        )

        if not result["results"]:
            return []

        fields = [
            base.FieldItem(value=field, text=field) for field in result["results"][0]
        ]

        cls.cache_fields_to_redis(fields)

        return fields

    @classmethod
    def search_entities_by_filters(
        cls, filters: list[base.FilterItem], global_operator: str = const.GLOBAL_AND
    ) -> list[dict[str, Any]]:
        """Search entities by the provided filters.

        Example of filters:
        [
            {'field': 'author', 'operator': 'is', 'value': 'Alex'},
            {'field': 'author', 'operator': 'is_not', 'value': 'John'},
            {'field': 'title', 'operator': 'contains', 'value': 'data'},
        ]

        The filters are combined with an AND operator.
        """
        q_list = []

        for f in filters:
            operator = f["operator"]
            field = _to_solr_field(f["field"])
            value = f["value"]

            if operator == const.OP_IS:
                q_list.append(f"{field}:\"{value}\"")
            elif operator == const.OP_IS_NOT:
                q_list.append(f"-{field}:\"{value}\"")
            elif operator == const.OP_CONTAINS:
                q_list.append(_build_word_query(field, value))
            elif operator == const.OP_DOES_NOT_CONTAIN:
                q_list.append(_build_word_query(field, value, negate=True))
            elif operator == const.OP_STARTS_WITH:
                q_list.append(f"{field}:{escape_legacy_argument(value)}*")
            elif operator == const.OP_ENDS_WITH:
                q_list.append(f"{field}:*{escape_legacy_argument(value)}")
            elif operator == const.OP_IS_EMPTY:
                q_list.append(f"(*:* AND -{field}:*)")
            elif operator == const.OP_IS_NOT_EMPTY:
                q_list.append(f"{field}:*")

        return cls._fetch_search_results(
            f'type:"{cls.entity_type}" AND ({f" {global_operator} ".join(q_list)})'
        )

    @classmethod
    def _fetch_search_results(cls, query: str) -> list[dict[str, Any]]:
        log.debug(f"Bulk. Performing search with query: {query} for {cls.entity_type}")

        rows = 1000
        start = 0
        results = []

        while True:
            result = tk.get_action("package_search")(
                {"ignore_auth": True},
                {
                    "q": query,
                    "rows": rows,
                    "start": start,
                    "include_private": True,
                    "include_drafts": True,
                },
            )

            results.extend(result["results"])
            start += len(result["results"])

            if start >= result["count"]:
                break

        return results
