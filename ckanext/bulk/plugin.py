from __future__ import annotations

import os

import ckan.plugins as p
import ckan.plugins.toolkit as tk
from ckan.common import CKANConfig


@tk.blanket.actions
@tk.blanket.auth_functions
@tk.blanket.blueprints
@tk.blanket.helpers
@tk.blanket.validators
class BulkPlugin(p.SingletonPlugin):
    p.implements(p.IConfigurer)
    p.implements(p.ITranslation)

    # IConfigurer
    def update_config(self, config_: CKANConfig):
        tk.add_template_directory(config_, "templates")
        tk.add_public_directory(config_, "public")
        tk.add_resource("assets", "bulk")

    # ITranslation
    def i18n_directory(self):
        return os.path.join(os.path.dirname(__file__), "i18n")

    def i18n_locales(self):
        return ["fr"]

    def i18n_domain(self):
        return "ckanext-bulk"
