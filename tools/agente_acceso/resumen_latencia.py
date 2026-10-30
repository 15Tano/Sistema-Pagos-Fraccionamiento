"""Resumen del ensayo cerrado usando tiempos del mismo PC; no conecta a SDK/API."""
import json
from pathlib import Path

from protocolo import utc
from latencia_politicas import payload_kind


def percentiles(values):
    import math
    values=sorted(values)
    return {'samples':len(values),**({name:round(values[math.ceil(len(values)*p)-1],6)
        for name,p in (('p50_s',.5),('p95_s',.95),('max_s',1))} if values else {})}


def worker_statistics(records):
    inventory=[];readers=[]
    for row in records:
        start,end=utc(row['started_utc']),utc(row['ended_utc'])
        if end<start or row.get('closed') is not True or type(row.get('operation_ok')) is not bool:
            raise ValueError('Trabajador no confirmado para medicion.')
        if row['role']=='vigencias':inventory.append((end-start).total_seconds())
        elif row['role']=='rt':readers.append((start,end))
        else:raise ValueError('Rol de trabajador inesperado.')
    readers.sort()
    gaps=[(b[0]-a[1]).total_seconds() for a,b in zip(readers,readers[1:])]
    # Un salto de reloj no sustituye la prueba de exclusion/cierre del SDK.
    return {'inventory_worker_wall':percentiles(inventory),
        'between_rt_workers':percentiles([v for v in gaps if v>=0]),
        'negative_worker_time_deltas':sum(v<0 for v in gaps),
        'workers_failed_operation':sum(not row['operation_ok'] for row in records)}


def summarize(box,folder,result):
    """Llamar bajo la exclusion del ensayo; no abrir una outbox instalada ajena."""
    folder=Path(folder)
    trace=folder/'emisor'/'http.jsonl'
    rows=[json.loads(line) for line in trace.read_text(encoding='ascii').splitlines()] if trace.exists() else []
    finished={}
    for value in rows:
        if value.get('phase')=='http_finished' and value.get('ack_valid') is True:
            finished.setdefault(value['body_sha256'],value)
    started=utc(result['heartbeat_utc'])  # Solo capturas del run actual, no recuperadas.
    # El primer ciclo marcado precede cualquier captura de este ensayo.
    transitions=folder/'transiciones.jsonl'
    turns=[json.loads(line) for line in transitions.read_text(encoding='ascii').splitlines()] if transitions.exists() else []
    if turns:started=min(utc(row['pc_utc']) for row in turns)
    captured=[];ack_delay=[];batch_delay=[];completed=0
    groups={kind:{'responses':0,'batch':[],'ack':[]} for kind in ('event','status','unknown')}
    for row in box.db.execute('SELECT r.raw,r.metadata,m.created_utc,m.sha256,m.state '
            'FROM responses r LEFT JOIN messages m ON m.id=r.message_id ORDER BY r.rowid'):
        end=utc(json.loads(row['metadata'])['captured_ended_utc'])
        if end<started:continue
        captured.append(end)
        group=groups[payload_kind(row['raw'])];group['responses']+=1
        if row['created_utc']:
            value=(utc(row['created_utc'])-end).total_seconds()
            batch_delay.append(value);group['batch'].append(value)
        ack=finished.get(row['sha256'])
        if ack and row['state']=='acked':
            value=(utc(ack['pc_utc'])-end).total_seconds()
            ack_delay.append(value);group['ack'].append(value);completed+=1
    cycles=[];open_cycle=None
    for turn in turns:
        if turn['phase']=='cycle_started':open_cycle=turn['monotonic_s']
        elif turn['phase']=='cycle_finished' and open_cycle is not None:
            cycles.append(turn['monotonic_s']-open_cycle);open_cycle=None
    return {'scope':'captura_sdk_hasta_ack_mismo_pc_no_tag_hasta_pantalla',
        'responses_this_run':len(captured),'responses_with_confirmed_http_timing':completed,
        'sdk_capture_gap':percentiles([(b-a).total_seconds() for a,b in zip(captured,captured[1:])]),
        'capture_end_to_batch':percentiles(batch_delay),'capture_end_to_http_ack':percentiles(ack_delay),
        'cycle_wall_time':percentiles(cycles),'actual_http_attempts':sum(r.get('phase')=='http_started' for r in rows),
        'groups':{key:{'responses':v['responses'],'without_timed_ack':v['responses']-len(v['ack']),
            'capture_to_batch':percentiles(v['batch']),'capture_to_http_ack':percentiles(v['ack'])}
            for key,v in groups.items()},
        'queue':box.health(),
        'negative_time_deltas':sum(v<0 for v in ack_delay+batch_delay+
            [(b-a).total_seconds() for a,b in zip(captured,captured[1:])]),
        'limits':['No mide presentacion fisica del tag ni pintado web.',
            'Los eventos recibidos pueden ser historicos; no se resta el reloj C3.',
            'Muestras sin ACK/pending no entran al percentil ACK; revisar sus conteos.',
            'No es prueba de capacidad del droplet ni garantia de1..3s.']}
