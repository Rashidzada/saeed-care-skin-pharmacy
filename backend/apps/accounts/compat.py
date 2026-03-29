import sys
from copy import copy

import django
from django.template.context import BaseContext


def patch_django_template_context_copy():
    """
    Django 4.2 uses copy(super()) inside BaseContext.__copy__().
    Python 3.14 changed super() copying semantics, which breaks admin template
    rendering with AttributeError on changelist pages.

    Django 5.2.8+ includes Python 3.14 support, so only patch older versions.
    """
    if sys.version_info < (3, 14):
        return
    if django.VERSION >= (5, 2, 8):
        return

    def _base_context_copy(self):
        duplicate = object.__new__(self.__class__)
        duplicate.__dict__ = self.__dict__.copy()
        duplicate.dicts = self.dicts[:]
        return duplicate

    def _context_copy(self):
        duplicate = _base_context_copy(self)
        duplicate.render_context = copy(self.render_context)
        return duplicate

    BaseContext.__copy__ = _base_context_copy

    from django.template.context import Context

    Context.__copy__ = _context_copy
