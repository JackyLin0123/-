"""Independent smoke assertions; run from repository root after runners.
Does not claim Pi hardware evidence or rewrite canonical results.
"""
import importlib.util
import json
import sys
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'projects/pi06-edge-inference'))
from model_format import load_model,digest,predict
import numpy as np
import runtime

class Projects(unittest.TestCase):
    def setUp(self):self.results=ROOT/'_build/verify/prd-continuation'
    def read(self,name):return json.loads((self.results/name/'results.json').read_text(encoding='utf-8'))
    def test_c_outputs(self):
        for name in ('pi00','pi03','pi04','pi05'):
            result=self.read(name);self.assertEqual(result['status'],'passed',result['missing']);self.assertTrue(all(a['passed'] for a in result['assertions']))
    def test_atomic_event_oracle(self):
        result=self.read('pi03');rounds=result['config']['rounds'];events=result['events']
        self.assertEqual(len(events),4*rounds)
        for r in range(rounds):
            block=events[4*r:4*r+4];self.assertEqual([e['value'] for e in block],[r,r,r+1,r+1]);self.assertEqual({e['thread'] for e in block[:2]},{0,1})
    def test_sequential_and_cycle_checksum_oracle(self):
        samples=self.read('pi05')['measurements'][0]['data']
        # At 4 KiB, 4096 accesses visit a full 1024-element permutation four
        # times. This arithmetic oracle is independent of C's scan implementation.
        small=[x for x in samples if x['bytes']==4096 and x['accesses']==4096]
        self.assertEqual(len(small),10)
        for s in small:self.assertEqual(s['checksum'],4*1024*1023//2)
        for summary in self.read('pi05')['measurements'][1]['data']:
            values=sorted(x['nsPerAccess'] for x in samples if x['bytes']==summary['bytes'] and x['mode']==summary['mode'])
            self.assertEqual(summary['median'],values[2]);self.assertAlmostEqual(summary['iqr'],values[3]-values[1])
    def test_model_corruption_and_contract(self):
        path=self.results/'pi06-model.json';p=load_model(path)
        self.assertTrue(np.allclose(predict(p,p['testInput']),p['referencePrediction'],atol=1e-6,rtol=1e-5))
        with tempfile.TemporaryDirectory() as temporary:
            file=Path(temporary)/'model.json'
            for field in ('weight','scale'):
                bundle=json.loads(path.read_text());bundle['payload'][field][0]+=1;file.write_text(json.dumps(bundle))
                with self.assertRaises(ValueError):load_model(file)
            for field,value in [('formatVersion',2),('inputShape',[None,4]),('scale',[1,0,1]),('atol',.1)]:
                bundle=json.loads(path.read_text());bundle['payload'][field]=value;bundle['sha256']=digest(bundle['payload']);file.write_text(json.dumps(bundle))
                with self.assertRaises(ValueError):load_model(file)
        with self.assertRaises(ValueError):predict(p,[[1,2]])
    def test_thermal_guard_and_budget(self):
        class Args:budget=1
        with tempfile.TemporaryDirectory() as temporary:
            Args.out=temporary;run=runtime.Run('pi00-setup',Args)
            original=runtime.thermal
            try:
                runtime.thermal=lambda:{'temperatureC':45,'frequencyKHz':1000,'throttling':{'current':0,'historical':15}}
                run.guard() # Historical bits alone do not block this run.
                runtime.thermal=lambda:{'temperatureC':45,'frequencyKHz':1000,'throttling':{'current':1,'historical':0}}
                with self.assertRaises(RuntimeError):run.guard()
                self.assertEqual(run.result['performanceStatus'],'affected')
                run.start-=10
                with self.assertRaises(TimeoutError):run.remaining()
            finally:runtime.thermal=original
    def test_local_source_identity(self):
        for name in ('pi00','pi03','pi04','pi05','pi06'):
            for record in self.read(name)['sourceManifest']:
                self.assertEqual(runtime.sha(ROOT/record['path']),record['sha256'],record['path'])
    def test_timeout_reclaims_child_tree(self):
        class Args:budget=1
        with tempfile.TemporaryDirectory() as temporary:
            Args.out=temporary;run=runtime.Run('pi00-setup',Args)
            marker=Path(temporary)/'late-child.txt'
            descendant="import time;from pathlib import Path;time.sleep(3);Path("+repr(str(marker))+").write_text('leaked')"
            parent="import subprocess,sys,time;subprocess.Popen([sys.executable,'-c',"+repr(descendant)+"]);time.sleep(30)"
            with self.assertRaises((TimeoutError,subprocess.TimeoutExpired)):run.command([sys.executable,'-c',parent])
            time.sleep(3)
            self.assertFalse(marker.exists(),'descendant wrote after parent timeout')
    def test_architecture_and_input_scope(self):
        environment=runtime.environment()
        self.assertIn(environment['architecture'],('aarch64','x86_64','unspecified'))
        self.assertTrue(environment['architectureSource'])
        self.assertTrue(environment['processArchitecture'])
        known=runtime.input_record(self.results/'pi06-model.json')
        self.assertEqual(known['scope'],'repository')
        self.assertEqual(known['path'],'_build/verify/prd-continuation/pi06-model.json')
        with tempfile.TemporaryDirectory() as temporary:
            path=Path(temporary)/'user-input.json';path.write_text('{}')
            external=runtime.input_record(path)
            self.assertEqual(external['scope'],'external')
            self.assertEqual(external['path'],'external/user-input.json')

if __name__=='__main__':unittest.main()
