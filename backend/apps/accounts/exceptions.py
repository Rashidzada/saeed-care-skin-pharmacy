# G:/msms/backend/apps/accounts/exceptions.py
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """Return consistent error format: { "error": "message", "details": {} }"""
    response = exception_handler(exc, context)

    if response is not None:
        error_data = {
            'error': 'An error occurred',
            'details': response.data,
        }

        if isinstance(response.data, dict):
            if 'detail' in response.data:
                error_data['error'] = str(response.data['detail'])
                error_data['details'] = {}
            elif 'non_field_errors' in response.data:
                error_data['error'] = str(response.data['non_field_errors'][0])
                error_data['details'] = response.data
            else:
                error_data['error'] = 'Validation failed'
                error_data['details'] = response.data
        elif isinstance(response.data, list):
            error_data['error'] = str(response.data[0]) if response.data else 'Error'
            error_data['details'] = {}

        response.data = error_data

    return response
