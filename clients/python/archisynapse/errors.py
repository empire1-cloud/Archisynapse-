class ArchisynapseError(Exception):
    def __init__(self, message, status_code=None, code=None):
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class AuthenticationError(ArchisynapseError):
    pass


class ValidationError(ArchisynapseError):
    pass


class NotFoundError(ArchisynapseError):
    pass


class RateLimitError(ArchisynapseError):
    pass


class ServerError(ArchisynapseError):
    pass
