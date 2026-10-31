"""Errors the service layer raises. Adapters translate them: REST -> HTTP status, MCP -> tool error text."""


class ServiceError(Exception):
    """Base class. The message is written to be shown to the user (or to Claude) as-is."""


class NotFoundError(ServiceError):
    pass


class ConflictError(ServiceError):
    pass


class InvalidInputError(ServiceError):
    pass
