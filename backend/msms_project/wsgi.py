# G:/msms/backend/msms_project/wsgi.py
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'msms_project.settings.dev')
application = get_wsgi_application()
