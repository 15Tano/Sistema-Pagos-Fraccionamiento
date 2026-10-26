"""Configuracion cerrada de operacion; sin tokens, claves o autoridad de vigencias."""
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import uuid

from rutas_operativas import checked_path

URL = 'https://api.sanisidro.info/api/control-acceso/agente'
SERIAL = 'CO2K225060027'
LAB_AGENT = 'c8d7ccdc-991f-497c-8383-92fb52921f8a'


@dataclass(frozen=True)
class Settings:
    enabled: bool
    agent_id: str
    serial: str
    url: str
    archive_acknowledged: bool
    release_sha256: str


def load(root):
    path = checked_path(Path(root)/'servicio-config.json')
    if path.stat().st_size > 16384: raise ValueError('Configuracion excedida.')
    value=json.loads(path.read_bytes())
    if (set(value)!={'protocol','enabled','agent_id','serial','url','archive_acknowledged','release_sha256'} or
            type(value['protocol']) is not int or value['protocol']!=1 or type(value['enabled']) is not bool or
            type(value['archive_acknowledged']) is not bool or value['serial']!=SERIAL or value['url']!=URL or
            str(uuid.UUID(value['agent_id']))!=value['agent_id'] or value['agent_id']==LAB_AGENT or
            not isinstance(value['release_sha256'],str) or len(value['release_sha256'])!=64 or
            any(char not in '0123456789abcdef' for char in value['release_sha256'])):
        raise ValueError('Configuracion operativa fuera de alcance.')
    return Settings(**{key:value[key] for key in Settings.__dataclass_fields__})


def activation(root, settings):
    """Se prepara para revision; no emitir este recibo durante una simulacion real."""
    path=checked_path(Path(root)/'activacion-integrada.json')
    if path.stat().st_size>16384: raise PermissionError('Activacion excedida.')
    value=json.loads(path.read_bytes())
    if (set(value)!={'protocol','purpose','release_sha256','agent_id','serial','config_sha256',
                     'dates_policy','archive_policy','accepted_checks'} or
            type(value['protocol']) is not int or value['protocol']!=1 or value['purpose']!='integrated_operation' or
            value['release_sha256']!=settings.release_sha256 or value['agent_id']!=settings.agent_id or
            value['serial']!=settings.serial or value['config_sha256']!=hashlib.sha256((Path(root)/'servicio-config.json').read_bytes()).hexdigest() or
            value['dates_policy']!='api_existing_only' or value['archive_policy']!='preserve_all_ack_archives' or
            value['accepted_checks']!={'real_date_application':True,'manager_stop_resume':True,
                                      'rollback':True,'definitive_https':True,'capacity':True} or
            not all(type(item) is bool for item in value['accepted_checks'].values()) or
            not settings.enabled or not settings.archive_acknowledged):
        raise PermissionError('Falta aceptacion operativa completa de esta configuracion.')
    return value
