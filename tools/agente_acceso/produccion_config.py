"""Contrato de produccion: motor r2 original, identidad nueva y HTTPS definitivo.

No convierte una simulacion en evidencia de escritura del aplicador candidato.
La activacion conserva consentimiento de este release, no checks de prueba inventados.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import referencia_vigencias as reference
from rutas_operativas import checked_path

AGENT='54d110e4-313a-45e3-bcc6-7761f3df8721'
SERIAL='CO2K225060027'
URL='https://api.sanisidro.info/api/control-acceso/agente'
ENGINE='r2_reference_unchanged'


@dataclass(frozen=True)
class Settings:
    enabled: bool
    agent_id: str
    serial: str
    url: str
    archive_acknowledged: bool
    release_sha256: str


def read(path):
    path=checked_path(path)
    if path.stat().st_size>16384: raise ValueError('Configuracion excedida.')
    value=json.loads(path.read_bytes())
    if not isinstance(value,dict): raise ValueError('Objeto requerido.')
    return value


def load(root):
    value=read(Path(root)/'servicio-config.json')
    if (set(value)!={'protocol','enabled','agent_id','serial','url','archive_acknowledged','release_sha256','dates_engine'} or
            type(value['protocol']) is not int or value['protocol']!=1 or
            value['agent_id']!=AGENT or value['serial']!=SERIAL or value['url']!=URL or value['dates_engine']!=ENGINE or
            type(value['enabled']) is not bool or type(value['archive_acknowledged']) is not bool or
            not isinstance(value['release_sha256'],str) or len(value['release_sha256'])!=64 or
            any(c not in '0123456789abcdef' for c in value['release_sha256'])):
        raise ValueError('Configuracion de produccion ajena.')
    return Settings(**{key:value[key] for key in Settings.__dataclass_fields__})


def activation(root,settings):
    root=Path(root)
    value=read(root/'activacion-integrada.json')
    expected={'protocol':1,'purpose':'production_r2_reference','agent_id':AGENT,'serial':SERIAL,
        'release_sha256':settings.release_sha256,
        'config_sha256':hashlib.sha256((root/'servicio-config.json').read_bytes()).hexdigest(),
        'dates_engine':ENGINE,'reference_sources':reference.EXPECTED}
    if (set(value)!=set(expected)|{'authorized_utc'} or type(value['protocol']) is not int or
            any(value.get(k)!=v for k,v in expected.items())):
        raise PermissionError('Activacion ajena a este release/configuracion/motor.')
    stamp=datetime.fromisoformat(value['authorized_utc'])
    if (stamp.tzinfo is None or stamp.utcoffset()!=timezone.utc.utcoffset(stamp) or
            stamp>datetime.now(timezone.utc) or not settings.enabled or not settings.archive_acknowledged):
        raise PermissionError('Activacion no vigente.')
    return value
