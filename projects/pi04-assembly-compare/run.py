import json
import os
import shutil
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'pi-common'))
from runtime import execute,ROOT,sha
def task(run,args):
    cc=os.environ.get('CC','gcc');build=run.build_directory();source=build/'functions.c'
    shutil.copyfile(ROOT/'projects/pi04-assembly-compare/functions.c',source)
    run.result['environment']['compiler']=run.command([cc,'--version']).splitlines()[0]
    target=run.command([cc,'-dumpmachine']).strip();run.result['environment']['compilerTarget']=target
    observations=[]
    for optimization in ('-O0','-O2'):
        run.guard();base=build/optimization[1:]
        run.command([cc,'-std=c11',optimization,'-S',source,'-o',str(base)+'.s'])
        run.command([cc,'-std=c11',optimization,'-c',source,'-o',str(base)+'.o'])
        exe=str(base)+('.exe' if os.name=='nt' else '.bin')
        run.command([cc,'-std=c11',optimization,source,'-o',exe])
        value=json.loads(run.command([exe]));run.check(optimization+' vectors',value=={'vectors':5,'sum10':55,'branchMinus7':7,'call10':66})
        observations.append({'optimization':optimization,'compilerTarget':target,**value})
        if shutil.which('objdump'):
            disassembly=run.command(['objdump','-f','-d',str(base)+'.o']);(run.out/(base.name+'.objdump.txt')).write_text(disassembly,encoding='utf-8')
        else:run.result['missing'].append({'metric':'disassembly','status':'skipped','reason':'objdump unavailable; assembly generated, object target confirmation pending'})
        for suffix in ('.s','.o'):
            shutil.copyfile(str(base)+suffix,run.out/(base.name+suffix))
    run.measure('executed test vectors','value',observations)
    artifacts=sorted(p for p in run.out.iterdir() if p.suffix in ('.s','.o') or p.name.endswith('.objdump.txt'))
    run.result['artifactManifest']=[{'path':p.name,'sha256':sha(p)} for p in artifacts]
    run.result['missing'].append({'metric':'second Linux architecture','status':'skipped','reason':'this result covers only actual compiler target; run separately on Linux x86-64 and Pi Linux AArch64, never infer from Windows ABI'})
execute('pi04-assembly-compare',task)
