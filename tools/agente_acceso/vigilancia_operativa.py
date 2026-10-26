"""Salud adicional del lector/emisor; mantiene intacto el criterio r2 de vigencias."""
import base64
import datetime as dt
from pathlib import Path
import subprocess

from emisor_servicio import read,save


def stamp(value):
    result=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
    if result.tzinfo is None or result.utcoffset()!=dt.timedelta(0): raise ValueError('UTC requerido.')
    return result


def assess(state,now):
    if state.get('phase')=='stopped' and state.get('closures_confirmed') is True: return None
    if state.get('phase')=='fault': return 'operacion integrada requiere revision'
    age=(now-stamp(state['heartbeat_utc'])).total_seconds()
    if age < -30: return 'reloj del proceso integrado requiere revision'
    if age>300: return 'operacion integrada sin actividad reciente'
    if state.get('storage_error'): return 'almacen de eventos requiere revision'
    if state.get('reader_error'): return 'lector de eventos pausado por error'
    if state.get('sender_error'): return 'emisor de eventos requiere revision'
    queue=state.get('queue',{})
    if queue.get('paused'): return 'cola de eventos bloqueada'
    if queue.get('pending_count',0)>0 and queue.get('oldest_pending_utc'):
        if (now-stamp(queue['oldest_pending_utc'])).total_seconds()>300: return 'eventos pendientes de envio durante mas de cinco minutos'
    if state.get('capacity',{}).get('warnings'): return 'capacidad del almacen de acceso proxima al limite'
    return None


def transition(previous,state,now,*,minutes=5,repeat_minutes=15):
    reason=assess(state,now)
    result={'checked_utc':now.isoformat(),'reason':reason,'status':'correcto','notify':False}
    if reason is None: return result
    since=previous.get('bad_since_utc') or now.isoformat()
    try:
        if stamp(since)>now: since=now.isoformat()
    except (ValueError,TypeError): since=now.isoformat()
    known=(state.get('queue',{}).get('oldest_pending_utc') if reason.startswith('eventos pendientes') else
           state.get('heartbeat_utc') if reason.startswith('operacion integrada sin actividad') else None)
    if known and stamp(known)<stamp(since): since=known
    result.update(bad_since_utc=since,status='pendiente')
    if (now-stamp(since)).total_seconds()>=minutes*60:
        result['status']='alerta'
        last=previous.get('last_alert_utc')
        if last is None or (now-stamp(last)).total_seconds()>=repeat_minutes*60:
            result.update(notify=True,last_alert_utc=now.isoformat())
        elif last: result['last_alert_utc']=last
    return result


def notify(reason):
    message='San Isidro: '+reason+'. Revisar estado y registros de acceso; no sincronizar todo a ciegas.'
    quoted=message.replace("'","''")
    source=("try { Write-EventLog -LogName Application -Source 'SanIsidro-ZKSync' -EventId 5101 -EntryType Warning -Message '"+
        quoted+"' -ErrorAction Stop } catch {}; (New-Object -ComObject WScript.Shell).Popup('"+quoted+
        "',20,'San Isidro - acceso',48) | Out-Null")
    encoded=base64.b64encode(source.encode('utf-16le')).decode()
    subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',encoded],
        capture_output=True,timeout=30,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))


def run(root):
    root=Path(root);path=root/'registros'/'vigilancia_componentes.json'
    try: previous=read(path)
    except (OSError,ValueError): previous={}
    now=dt.datetime.now(dt.timezone.utc)
    try:
        state=read(root/'registros'/'operacion.json')
        result=transition(previous,state,now)
    except (OSError,ValueError,KeyError,TypeError):
        result=transition(previous,{'phase':'fault','heartbeat_utc':now.isoformat()},now)
    try: official=read(root/'registros'/'vigilancia.json')
    except (OSError,ValueError): official={}
    if official.get('status')=='mantenimiento':
        result={'status':'mantenimiento','reason':None,'checked_utc':now.isoformat(),'notify':False}
    if result['notify'] and official.get('status')!='alerta': notify(result['reason'])
    save(path,result)
    return result
