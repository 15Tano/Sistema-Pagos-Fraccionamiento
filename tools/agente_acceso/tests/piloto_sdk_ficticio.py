"""Proceso SDK de prueba: solo mock existente y guardia nativa/DPAPI nueva."""
from pathlib import Path
import sys
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'tests'))
import sdk_proceso_ficticio as fixture
import piloto_sdk_worker as worker
import piloto_vigencias_dell as entry
import respaldo_ciclo as checkpoint


def main():
    original=fixture.transport.worker
    def dispatch(folder,digest,diag):
        launch=Path(folder).parents[2];root=launch.parents[2];sync=root.parent/'ZKSync'
        def inventory(_):
            return {'tasks':[{'name':name,'state':'Disabled' if name.endswith('Vigencias') else 'Ready',
                'enabled':not name.endswith('Vigencias'),'actions_verified':True,'same_user':True,'highest':True,'interactive':True}
                for name in ('SanIsidro-Vigencias','SanIsidro-Vigilancia')]}
        with patch.object(entry,'SYNC',sync):
            guard=lambda:worker.guard_child(folder,digest,root=root,
                maintenance=lambda marker:entry.maintenance(marker,inspect=inventory))
            guard();diag.maintenance_guard=guard
            request,operation=fixture.transport.read_operation(folder,digest)
            return checkpoint.worker(folder,digest,diag) if operation['mode']=='apply' else original(folder,digest,diag)
    with patch.object(fixture.transport,'worker',side_effect=dispatch):return fixture.main()


if __name__=='__main__':raise SystemExit(main())
