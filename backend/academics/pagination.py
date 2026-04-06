from rest_framework.pagination import PageNumberPagination


class AcademicsPagination(PageNumberPagination):
    page_size = 8
