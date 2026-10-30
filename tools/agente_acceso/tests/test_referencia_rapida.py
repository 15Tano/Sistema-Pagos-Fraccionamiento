"""Integridad en caliente y equivalencia con r2; sin SDK/API/MDB instalados."""
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import referencia_vigencias as reference
import aplicacion_vigencias as app


class ReferenceTests(unittest.TestCase):
    def setUp(self):
        base=ROOT/'datos'/'pruebas_referencia_rapida';base.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=base);self.folder=Path(self.temp.name)
        self.original=reference.ROOT
        for name in (*reference.EXPECTED,'FUENTE.json'):
            (self.folder/name).write_bytes((self.original/name).read_bytes())
        self.patch=patch.object(reference,'ROOT',self.folder);self.patch.start()
        reference._validator.cache_clear();reference._compiled.cache_clear()
        self.rows=[{'card_no':'99000001','expiration':'2026-11-05 23:59:59'}]
        # Baseline es el codigo r2 congelado, no una reimplementacion del parser.
        self.baseline=reference.load_reference().validate_api
    def tearDown(self):
        self.patch.stop();reference._validator.cache_clear();reference._compiled.cache_clear();self.temp.cleanup()
    def test_changed_api_values_are_revalidated_and_return_independent_results(self):
        first=reference.validate_api(self.rows)
        first['99000001']=dt.datetime(2030,1,1)
        self.assertEqual(self.baseline(self.rows),reference.validate_api(self.rows))
        newer=[dict(self.rows[0],expiration='2027-01-31 23:59:59')]
        self.assertEqual(dt.datetime(2027,1,31,23,59,59),reference.validate_api(newer)['99000001'])
    def test_four_source_hashes_are_checked_after_warming_cache(self):
        for name in reference.EXPECTED:
            with self.subTest(name=name):
                reference.validate_api(self.rows)
                path=self.folder/name;old=path.read_bytes();path.write_bytes(old+b'\n# changed fixture\n')
                try:
                    with self.assertRaises(ValueError):reference.validate_api(self.rows)
                    with self.assertRaises(ValueError):reference.load_reference()
                finally:path.write_bytes(old)
    def test_changed_reference_manifest_is_rejected_after_cache_warmup(self):
        reference.validate_api(self.rows)
        path=self.folder/'FUENTE.json';value=json.loads(path.read_text(encoding='utf-8-sig'))
        value['release']='unapproved';path.write_text(json.dumps(value))
        with self.assertRaises(ValueError):reference.validate_api(self.rows)
    def test_adaptor_module_mutations_do_not_change_validator_or_next_adaptor(self):
        reference.validate_api(self.rows)
        one=reference.load_reference();two=reference.load_reference()
        self.assertIsNot(one,two)
        one.ROOT=Path('foreign_fixture');one.worker='changed';one.START=dt.datetime(2035,1,1)
        self.assertNotEqual(one.ROOT,two.ROOT);self.assertTrue(callable(two.worker))
        self.assertEqual(self.baseline(self.rows),reference.validate_api(self.rows))
        self.assertEqual(dt.datetime(2020,1,1),reference.load_reference().START)
    def test_exec_uses_verified_bytes_if_disk_changes_after_verification(self):
        original=reference.load_module;path=self.folder/'sincronizar_vigencias.py';before=path.read_bytes()
        def raced(name,file,source=None):
            if file==path:file.write_bytes(b'raise AssertionError("UNVERIFIED_EXECUTION")')
            return original(name,file,source)
        with patch.object(reference,'load_module',side_effect=raced):
            module=reference.load_reference()
        self.assertEqual(self.baseline(self.rows),module.validate_api(self.rows))
        with self.assertRaises(ValueError):reference.validate_api(self.rows)
        path.write_bytes(before)
    def test_import_registry_is_restored_after_failed_module_initialization(self):
        sentinel=types.ModuleType('fixture_runtime');previous=sys.modules.get('sync_runtime')
        original=reference.load_module
        def failed(name,path,source=None):
            if name=='_coordinador_ciclo_r2':raise RuntimeError('fixture initialization failure')
            return original(name,path,source)
        sys.modules['sync_runtime']=sentinel
        try:
            with patch.object(reference,'load_module',side_effect=failed):
                with self.assertRaises(RuntimeError):reference.load_reference()
            self.assertIs(sentinel,sys.modules['sync_runtime'])
        finally:
            if previous is None:sys.modules.pop('sync_runtime',None)
            else:sys.modules['sync_runtime']=previous
    def test_parallel_adaptors_have_distinct_modules_and_same_api_results(self):
        def read(_):
            module=reference.load_reference()
            return module,module.validate_api(self.rows),reference.validate_api(self.rows)
        with ThreadPoolExecutor(max_workers=4) as pool:values=list(pool.map(read,range(12)))
        self.assertEqual(12,len({id(v[0]) for v in values}))
        self.assertTrue(all(v[1]==v[2]==self.baseline(self.rows) for v in values))
    def test_invalid_api_cases_match_frozen_validator_exactly(self):
        cases=[[],{},None,[{}],[{'card_no':'','expiration':'2026-11-05 23:59:59'}],
            self.rows+self.rows,[dict(self.rows[0],expiration='2026-11-05 12:00:00')],
            [dict(self.rows[0],expiration='2019-11-05 23:59:59')],
            [dict(self.rows[0],expiration='bad')]]
        for rows in cases:
            with self.subTest(rows=rows):
                try:self.baseline(rows)
                except Exception as exc:expected=type(exc)
                else:self.fail('Caso invalido aceptado por baseline.')
                with self.assertRaises(expected):reference.validate_api(rows)
    def test_837_plans_match_old_planner_with_missing_and_changed_dates(self):
        # El metodo anterior construye los mismos planes usando el validador r2.
        original_api=lambda rows:self.baseline(rows)
        cases=[]
        for index in range(837):
            card=str(90000000+index)
            access={'userid':index+1,'card':card,'start':'2020-01-01 00:00:00',
                'end':'2026-11-05 23:59:59','valid_raw':True}
            panel={'CardNo':card,'Pin':str(index+1),'StartTime':'20200101','EndTime':'20261105'}
            if index%3==0:access['end']='2026-10-01 23:59:59'
            if index%5==0:panel['EndTime']='20261001'
            if index%7==0:access['valid_raw']=False
            cases.append((card,[{'card_no':card,'expiration':'2026-11-05 23:59:59'}],access,panel))
        with patch.object(app,'validate_reference_api',side_effect=original_api):
            old=[app.make_plan(*args) for args in cases]
        new=[app.make_plan(*args) for args in cases]
        self.assertEqual(old,new)
        self.assertEqual(app.digest(old),app.digest(new))
    def test_missing_card_and_invalid_prior_inventory_remain_rejected(self):
        card='99000001';access={'userid':1,'card':card,'start':'2020-01-01 00:00:00',
            'end':'2026-11-05 23:59:59','valid_raw':True}
        panel={'CardNo':card,'Pin':'1','StartTime':'20200101','EndTime':'20261105'}
        for args in [(card,[dict(self.rows[0],card_no='99000002')],access,panel),
            (card,self.rows,None,panel),(card,self.rows,access,None),
            (card,self.rows,access,dict(panel,CardNo='99000002'))]:
            with self.assertRaises(PermissionError):app.make_plan(*args)


if __name__=='__main__':unittest.main()
