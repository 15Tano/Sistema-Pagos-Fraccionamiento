"""Entrega HTTP acotada; nunca carga el SDK ni modifica vigencias."""
import email.utils
import json
import random
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request

from protocolo import digest, json_bytes, validate_ack


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class HttpTransport:
    def __init__(self, base_url, token, *, local_trial=False, timeout=10):
        parsed = urllib.parse.urlsplit(base_url)
        try:
            port = parsed.port
        except ValueError as exc:
            raise ValueError('Puerto invalido.') from exc
        if (parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username is not None or
                parsed.password is not None or parsed.query or parsed.fragment or
                (parsed.scheme == 'http' and not (local_trial and parsed.hostname in ('127.0.0.1', '::1')))):
            raise ValueError('Usar HTTPS; HTTP solo con ensayo explicito y loopback literal.')
        if not isinstance(token, str) or not re.fullmatch(r'sica_[a-f0-9]{64}', token):
            raise ValueError('Formato de credencial invalido.')
        if not 0 < timeout <= 15 or port == 0:
            raise ValueError('Timeout o puerto fuera de limites.')
        self.url, self.token, self.timeout = base_url.rstrip('/'), token, timeout
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(),
                                                  urllib.request.HTTPSHandler(context=ssl.create_default_context()))

    def send(self, endpoint, body):
        if endpoint not in ('estado', 'lotes'):
            raise ValueError('Endpoint invalido.')
        request = urllib.request.Request(self.url + '/' + endpoint, data=body, method='POST',
                                         headers={'Authorization': 'Bearer ' + self.token,
                                                  'Content-Type': 'application/json', 'Accept': 'application/json'})
        try:
            result = self.opener.open(request, timeout=self.timeout)
        except urllib.error.HTTPError as error:
            result = error
        with result:
            # Nunca incluir cuerpos de error/headers completos en logs.
            status = result.code
            retry_after = result.headers.get('Retry-After')
            raw = result.read(65537) if status in (200, 201) else b''
        if len(raw) > 65536:
            raise ValueError('ACK demasiado grande.')
        try:
            ack = json.loads(raw) if raw else None
        except (ValueError, UnicodeError):
            ack = None
        return status, ack, retry_after


class Sender:
    def __init__(self, outbox, transport, *, random_fraction=random.random):
        self.outbox, self.transport, self.random_fraction = outbox, transport, random_fraction

    def _delay(self, attempts, retry_after):
        delay = min(300, 2 ** min(attempts, 8)) + self.random_fraction()
        if retry_after:
            try:
                server_delay = int(retry_after)
            except (ValueError, TypeError):
                try:
                    parsed = email.utils.parsedate_to_datetime(retry_after)
                    server_delay = parsed.timestamp() - self.outbox.clock()
                except (ValueError, TypeError, OverflowError):
                    server_delay = 0
            delay = max(delay, server_delay)
        return delay

    def once(self):
        message = self.outbox.claim()
        if message is None:
            return 'idle'
        try:
            payload = json.loads(message['body'])
            if digest(message['body']) != message['sha256'] or json_bytes(payload) != message['body']:
                raise ValueError('Contenido local alterado.')
        except (ValueError, UnicodeError):
            self.outbox.finish(message, error='local_integrity', blocked=True)
            return 'blocked'
        try:
            status, ack, retry_after = self.transport.send(message['endpoint'], message['body'])
        except (OSError, urllib.error.URLError):
            self.outbox.finish(message, error='network', retry_in=self._delay(message['attempts'], None))
            return 'retry'
        except ValueError:
            self.outbox.finish(message, error='invalid_ack', blocked=True)
            return 'blocked'
        if status in (408, 429) or 500 <= status <= 599:
            self.outbox.finish(message, error='http_' + str(status),
                               retry_in=self._delay(message['attempts'], retry_after))
            return 'retry'
        if status not in (200, 201):
            self.outbox.finish(message, error='http_' + str(status), blocked=True)
            return 'blocked'
        try:
            validate_ack(status, ack, payload, message['sha256'])
        except (ValueError, TypeError):
            self.outbox.finish(message, error='invalid_ack', blocked=True)
            return 'blocked'
        return 'acked' if self.outbox.finish(message, ack=ack) else 'lease_reassigned'

    def run(self, maximum=20):
        if type(maximum) is not int or not 1 <= maximum <= 100:
            raise ValueError('Cantidad de envios fuera de limites.')
        outcomes = []
        for _ in range(maximum):
            outcome = self.once()
            outcomes.append(outcome)
            if outcome != 'acked':
                break
        return outcomes
