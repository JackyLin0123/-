import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'pi-common'))
from runtime import execute
def task(run,args):
    result=json.loads(run.command([run.compile('smoke')]))
    run.check('C compile, link, pointer and array smoke',result=={'sum':10,'pointer_first':2})
    run.measure('compiler smoke','value',[result])
    for capability in ('perf','strace'):
        import shutil
        run.result['environment'][capability]=bool(shutil.which(capability))
    run.result['missing'].append({'metric':'power/cooling','status':'skipped','reason':'record actual supply, cable and cooler manually; no automatic assumption'})
execute('pi00-setup',task)
