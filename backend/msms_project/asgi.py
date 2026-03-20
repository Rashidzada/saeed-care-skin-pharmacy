# G:/msms/backend/msms_project/asgi.py
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'msms_project.settings.dev')
application = get_asgi_application()
