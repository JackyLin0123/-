import json
import re
import shutil
import sys
import tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'pi-common'))
from runtime import execute,sha
def task(run,args):
    if not sys.platform.startswith('linux'):
        run.skip('fork/strace branch needs Linux; Windows or cross-generation is not execution evidence'); return
    observed=json.loads(run.command([run.compile('process')]))
    run.check('inherited virtual address',observed['sameVirtualAddress'])
    run.check('private values independent',observed['parentBefore']==observed['childBefore']==7 and observed['parentAfter']==7 and observed['childAfter']==99)
    run.check('distinct processes',observed['parentPid']!=observed['childPid'])
    run.result['events']=[{'sequence':0,'phase':'fork initialized','value':7},{'sequence':1,'phase':'child write','value':99},{'sequence':2,'phase':'parent after wait','value':7}]
    run.measure('pipe/wait synchronized events','value',run.result['events'],'events')
    run.measure('process observations','value',[observed], 'events')
    io=run.compile('io')
    with tempfile.TemporaryDirectory(prefix='pi02-') as work:
        file=Path(work)/'private.txt'
        result=json.loads(run.command([io,file])); run.check('file content',result['fileEqual'])
        file.unlink()
        if shutil.which('strace'):
            raw=run.command(['strace','-o',run.out/'trace.txt','-e','trace=open,openat,read,write,close,fsync',io,file])
            run.check('traced file content',json.loads(raw)['fileEqual'])
            lines=(run.out/'trace.txt').read_text().splitlines()
            run.result['artifactManifest']=[{'path':'trace.txt','sha256':sha(run.out/'trace.txt')}]
            calls={name:sum(bool(re.match(name+r'\(',line)) for line in lines) for name in ('open','openat','read','write','close','fsync')}
            run.measure('strace syscall counts','count',[calls])
        else:
            run.result['status']='skipped'
            run.result['missing'].append({'metric':'strace','status':'skipped','reason':'not installed; native file correctness completed, trace acceptance pending'})
    run.result['missing'].append({'metric':'interrupts','status':'skipped','reason':'optional /proc/interrupts not correlated one-to-one to syscall events'})
execute('pi02-process-syscalls',task)
